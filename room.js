(function (root, factory) {
  const rules = typeof module === 'object' && module.exports ? require('./rules.js') : root.BoardRules;
  const api = factory(rules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoomRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Rules) {
  'use strict';
  class Room {
    constructor({ code, type, capacity, hostId, name, secret, dice }) {
      if (!['ludo', 'snakes'].includes(type) || ![2,3,4].includes(capacity)) throw new Error('Choose a game and 2–4 players.');
      this.code = code; this.type = type; this.capacity = capacity; this.hostId = hostId;
      this.players = [{ id: hostId, name: Rules.cleanName(name), secret, color: Rules.seats(capacity)[0], ready: true, connected: true }];
      this.phase = 'lobby'; this.game = null; this.version = 1;
      this.dice = dice;
    }
    join({ id, name, secret }) {
      if (typeof id !== 'string' || id.length > 80 || typeof secret !== 'string' || secret.length < 20 || secret.length > 100) throw new Error('Invalid player session. Please reload and try again.');
      const existing = this.players.find(player => player.id === id);
      if (existing) {
        if (existing.secret !== secret) throw new Error('This seat belongs to another player.');
        existing.connected = true; this.version += 1; return existing;
      }
      if (this.phase !== 'lobby') throw new Error('This game has already started. Create another room.');
      if (this.players.length >= this.capacity) throw new Error('This room is full.');
      const used = new Set(this.players.map(player => player.color));
      const color = Rules.seats(this.capacity).find(value => !used.has(value));
      const player = { id, secret, name: Rules.cleanName(name), color, ready: false, connected: true };
      this.players.push(player); this.version += 1; return player;
    }
    disconnect(id, leave = false) {
      const index = this.players.findIndex(player => player.id === id);
      if (index < 0) return;
      if (this.phase === 'lobby' && leave && id !== this.hostId) this.players.splice(index, 1);
      else { this.players[index].connected = false; this.players[index].ready = false; }
      this.version += 1;
    }
    canStart() { return this.phase === 'lobby' && this.players.length === this.capacity && this.players.every(player => player.ready && player.connected); }
    command(id, command) {
      const player = this.players.find(item => item.id === id);
      if (!player || !player.connected) throw new Error('Join the room first.');
      if (!command || typeof command !== 'object' || typeof command.type !== 'string') throw new Error('Invalid action.');
      if (command.version !== this.version) throw new Error('The room changed. Please try again.');
      if (command.type === 'ready') {
        if (this.phase !== 'lobby') throw new Error('The game has already started.');
        player.ready = !!command.ready;
      } else if (command.type === 'start') {
        if (id !== this.hostId) throw new Error('Only the host can start the game.');
        if (!this.canStart()) throw new Error('Wait until everyone has joined and is ready.');
        this.game = Rules.create(this.type, this.players); this.phase = 'playing';
      } else if (command.type === 'roll' || command.type === 'move') {
        if (this.phase !== 'playing') throw new Error('The game is not running.');
        const active = Rules.current(this.game);
        if (!this.players.find(item => item.id === active.id)?.connected) throw new Error('Waiting for the current player to reconnect.');
        if (command.type === 'roll') { Rules.roll(this.game, id, this.dice()); Rules.autoMove(this.game, id); }
        else Rules.move(this.game, id, command.token);
        if (this.game.winner) this.phase = 'won';
      } else if (command.type === 'rematch') {
        if (id !== this.hostId || this.phase !== 'won') throw new Error('Only the host can start a rematch after the game ends.');
        this.game = null; this.phase = 'lobby';
        this.players.forEach(item => { item.ready = item.id === this.hostId; });
      } else if (command.type === 'remove') {
        if (id !== this.hostId || this.phase !== 'lobby' || command.player === this.hostId) throw new Error('Only the host can remove a guest before play starts.');
        this.players = this.players.filter(item => item.id !== command.player);
      } else throw new Error('Unknown action.');
      this.version += 1;
    }
    snapshot() {
      return { code: this.code, type: this.type, capacity: this.capacity, hostId: this.hostId, phase: this.phase, players: this.players.map(({ secret, ...player }) => ({ ...player })), version: this.version, game: this.game ? JSON.parse(JSON.stringify(this.game)) : null, canStart: this.canStart() };
    }
  }
  return { Room };
});
