(function () {
  'use strict';
  const { Room } = window.RoomRules;
  const config = window.LUDO_LADDER_CONFIG;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function randomString(length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
  }
  function dice() {
    const value = new Uint8Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= 252);
    return value[0] % 6 + 1;
  }
  function seat(code) {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem('rt-seat-' + code)); } catch (_) { /* A new seat is fine. */ }
    if (saved?.id && saved?.secret) return saved;
    const value = { id: crypto.randomUUID(), secret: crypto.randomUUID() + crypto.randomUUID() };
    try { sessionStorage.setItem('rt-seat-' + code, JSON.stringify(value)); } catch (_) { /* Rejoining after a reload will need a new seat. */ }
    return value;
  }
  function validCode(value) { return /^[A-HJ-NP-Z2-9]{6}$/.test(value); }
  const errors = {
    'peer-unavailable': 'Room not found. Check the code and ask the host to keep their room open.',
    'network': 'Could not reach the connection service. Check your connection and try again.',
    'browser-incompatible': 'This browser does not support online play. Try a recent Chrome, Edge, Safari or Firefox.',
    'socket-error': 'The connection service is unavailable. Please try again shortly.',
    'webrtc': 'The browsers could not connect. Try another network; some restricted networks block direct connections.'
  };

  class Connection {
    constructor(onState, onStatus) {
      this.onState = onState; this.onStatus = onStatus;
      this.peer = null; this.host = null; this.state = null; this.id = null;
      this.connections = new Map(); this.requests = new Map();
      this.disposed = false; this.local = false; this.pending = null;
    }
    announce(text, tone = 'info') { this.onStatus(text, tone); }
    setState(state) {
      if (!state || state.code !== this.code || !Array.isArray(state.players)) return;
      if (this.state && state.version < this.state.version) return;
      this.state = state; this.onState(state);
    }
    broadcast() {
      const state = this.host.snapshot(); this.setState(state);
      for (const connection of this.connections.values()) if (connection.open) connection.send({ kind: 'state', state });
    }
    async createPeer(id) {
      if (!window.Peer) throw new Error('The connection library did not load. Please reload.');
      const peer = new Peer(id, await config.connectionOptions());
      this.peer = peer;
      peer.on('disconnected', () => {
        if (this.disposed) return;
        this.announce('Reconnecting to the room service…', 'warning');
        if (!peer.destroyed) { try { peer.reconnect(); } catch (_) { /* Error handler explains the failure. */ } }
      });
      peer.on('open', () => { if (this.state) this.announce('Connected', 'good'); });
      peer.on('error', error => {
        const message = errors[error.type] || 'Connection interrupted. Please try again.';
        if (this.pending) { this.pending.reject(new Error(message)); this.pending = null; }
        else if (!this.disposed) this.announce(message, 'bad');
      });
      return peer;
    }
    waitForOpen(peer) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { reject(new Error('Connection took too long. Check your internet connection and try again.')); }, 18000);
        const failure = error => { clearTimeout(timeout); reject(error); };
        this.pending = { reject: failure };
        peer.once('open', id => { clearTimeout(timeout); this.pending = null; resolve(id); });
      });
    }
    async create(type, capacity, name, local = false) {
      this.local = local; this.name = name;
      this.code = local ? 'LOCAL' : randomString(6);
      const identity = seat(this.code); this.id = identity.id; this.identity = identity;
      this.host = new Room({ code: this.code, type, capacity, name, hostId: this.id, secret: identity.secret, dice });
      if (local) {
        for (let index = 1; index < capacity; index++) {
          const guest = this.host.join({ id: crypto.randomUUID(), name: 'Player ' + (index + 1), secret: crypto.randomUUID() });
          guest.ready = true;
        }
        this.host.command(this.id, { type: 'start', version: this.host.version });
        this.broadcast(); return;
      }
      const peer = await this.createPeer(config.roomPrefix + this.code);
      peer.on('connection', connection => this.accept(connection));
      await this.waitForOpen(peer);
      this.broadcast(); this.announce('Room open. Invite your friends.', 'good');
    }
    accept(connection) {
      let boundId = null, settled = false;
      const timer = setTimeout(() => { if (!settled) connection.close(); }, 35000);
      connection.on('data', data => {
        if (!data || typeof data !== 'object' || JSON.stringify(data).length > 6000) return;
        try {
          if (data.kind === 'join' && !boundId) {
            if (data.code !== this.code || data.identity?.id === this.id) throw new Error('Invalid room session.');
            const guest = this.host.join({ ...data.identity, name: data.name });
            boundId = guest.id;
            const previous = this.connections.get(boundId);
            this.connections.set(boundId, connection);
            if (previous && previous !== connection) previous.close();
            settled = true; clearTimeout(timer); this.broadcast();
          } else if (data.kind === 'command' && boundId) {
            this.host.command(boundId, data.command);
            if (data.command.type === 'remove') {
              const removed = this.connections.get(data.command.player);
              if (removed) { removed.send({ kind: 'closed', message: 'The host removed your seat from the lobby.' }); setTimeout(() => removed.close(), 250); this.connections.delete(data.command.player); }
            }
            this.broadcast(); connection.send({ kind: 'ack', request: data.request });
          } else if (data.kind === 'leave' && boundId) {
            this.connections.delete(boundId); this.host.disconnect(boundId, true); boundId = null; connection.close(); this.broadcast();
          }
        } catch (error) {
          connection.send({ kind: 'error', request: data.request || null, message: error.message });
          if (!boundId) { settled = true; clearTimeout(timer); setTimeout(() => connection.close(), 200); }
          else this.broadcast();
        }
      });
      connection.on('close', () => {
        clearTimeout(timer);
        if (boundId && this.connections.get(boundId) === connection) {
          this.connections.delete(boundId); this.host.disconnect(boundId); this.broadcast();
        }
      });
      connection.on('error', () => connection.close());
    }
    async join(code, name) {
      if (!validCode(code)) throw new Error('Enter the six-character room code.');
      this.code = code; this.name = name;
      this.identity = seat(code); this.id = this.identity.id;
      const peer = await this.createPeer(undefined);
      await this.waitForOpen(peer);
      await this.connectHost();
    }
    connectHost() {
      return new Promise((resolve, reject) => {
        const connection = this.peer.connect(config.roomPrefix + this.code, { reliable: true, serialization: 'json', metadata: { app: 'ludo-ladder-v1' } });
        this.guestConnection = connection;
        let joined = false;
        const timer = setTimeout(() => { this.pending = null; connection.close(); reject(new Error('The host could not be reached. Check the code, keep the host tab open, or try another network.')); }, 30000);
        const fail = error => { clearTimeout(timer); reject(error); };
        this.pending = { reject: fail };
        connection.on('open', () => connection.send({ kind: 'join', code: this.code, name: this.name, identity: this.identity }));
        connection.on('data', data => {
          if (this.guestConnection !== connection) return;
          if (!data || typeof data !== 'object') return;
          if (data.kind === 'state' && data.state?.code === this.code) {
            this.setState(data.state);
            if (!joined) { joined = true; clearTimeout(timer); this.pending = null; this.announce('Connected', 'good'); resolve(); }
          } else if (data.kind === 'ack') {
            this.requests.get(data.request)?.resolve(); this.requests.delete(data.request);
          } else if (data.kind === 'error') {
            const error = new Error(String(data.message || 'The action could not be completed.'));
            if (!joined) { clearTimeout(timer); this.pending = null; reject(error); }
            else if (data.request) { this.requests.get(data.request)?.reject(error); this.requests.delete(data.request); }
            else this.announce(error.message, 'bad');
          } else if (data.kind === 'closed') {
            this.disposed = true; this.announce(data.message || 'The host closed this room. Create or join another room.', 'bad');
            this.setState({ ...this.state, connectionLost: true });
          }
        });
        connection.on('close', () => {
          if (this.guestConnection !== connection) return;
          clearTimeout(timer);
          if (!joined) { reject(new Error('The room connection closed. Check the code and try again.')); return; }
          if (!this.disposed) {
            this.announce('Room connection lost. Ask the host to keep their tab open, then use Reconnect.', 'bad');
            this.setState({ ...this.state, connectionLost: true });
          }
        });
        connection.on('error', () => { if (!joined) fail(new Error('Could not connect to the host. Try another network.')); });
      });
    }
    async reconnect() {
      if (this.host || this.disposed) return;
      if (!this.peer || this.peer.destroyed) { const peer = await this.createPeer(undefined); await this.waitForOpen(peer); }
      await this.connectHost();
    }
    async command(command) {
      if (!this.state) throw new Error('Join a room first.');
      command = { ...command, version: this.state.version };
      if (this.host) {
        const actor = this.local && this.host.game && ['roll','move'].includes(command.type) ? window.BoardRules.current(this.host.game).id : this.id;
        this.host.command(actor, command);
        if (command.type === 'remove') {
          const removed = this.connections.get(command.player);
          this.connections.delete(command.player);
          if (removed) { if (removed.open) removed.send({ kind: 'closed', message: 'The host removed your seat from the lobby.' }); setTimeout(() => removed.close(), 250); }
        }
        this.broadcast(); return;
      }
      if (!this.guestConnection?.open) throw new Error('Room disconnected. Use Reconnect.');
      const request = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.requests.delete(request); reject(new Error('The host did not respond. Try reconnecting.')); }, 6000);
        this.requests.set(request, { resolve: () => { clearTimeout(timer); resolve(); }, reject: error => { clearTimeout(timer); reject(error); } });
        this.guestConnection.send({ kind: 'command', request, command });
      });
    }
    close() {
      this.disposed = true;
      if (this.host) {
        for (const connection of this.connections.values()) { if (connection.open) connection.send({ kind: 'closed', message: 'The host closed this room. Create or join another room.' }); connection.close(); }
      } else if (this.guestConnection?.open) { this.guestConnection.send({ kind: 'leave' }); this.guestConnection.close(); }
      if (this.peer && !this.peer.destroyed) this.peer.destroy();
      this.requests.forEach(request => request.reject(new Error('Room closed.'))); this.requests.clear();
    }
  }
  window.RoomNetwork = { Connection, dice, validCode };
})();
