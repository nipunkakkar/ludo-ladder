const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { webcrypto } = require('node:crypto');
const BoardRules = require('../rules.js');
const RoomRules = require('../room.js');
const source = fs.readFileSync(path.join(__dirname, '../network.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

// An in-memory transport tests the actual browser protocol, independently of ICE
// and public service availability. It is not evidence of real WebRTC connectivity.
function transport() {
  const peers = new Map();
  class Channel extends EventEmitter {
    send(data) { const packet = structuredClone(data); queueMicrotask(() => { if (this.other.open) this.other.emit('data', packet); }); }
    close() { if (!this.open) return; this.open = false; this.other.open = false; queueMicrotask(() => { this.emit('close'); this.other.emit('close'); }); }
  }
  return class Peer extends EventEmitter {
    constructor(id) { super(); this.id = id || webcrypto.randomUUID(); this.channels = []; peers.set(this.id, this); setImmediate(() => this.emit('open', this.id)); }
    connect(id) {
      const left = new Channel(), right = new Channel(); left.other = right; right.other = left;
      const target = peers.get(id); this.channels.push(left);
      queueMicrotask(() => {
        if (!target) { this.emit('error', {type:'peer-unavailable'}); return; }
        target.channels.push(right); target.emit('connection', right);
        left.open = right.open = true; right.emit('open'); left.emit('open');
      });
      return left;
    }
    destroy() { this.destroyed = true; peers.delete(this.id); this.channels.forEach(channel => channel.close()); }
  };
}
function client(Peer) {
  const storage = new Map(); let latest;
  const window = {BoardRules, RoomRules, Peer, LUDO_LADDER_CONFIG:{roomPrefix:'test-ludo-ladder-',connectionOptions:async()=>({})}};
  vm.runInNewContext(source, {window, Peer, crypto:webcrypto, console:{info(){}}, setTimeout, clearTimeout,
    sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
  const connection = new window.RoomNetwork.Connection(state=>{latest=state;}, ()=>{});
  return {connection, get state(){return latest;}};
}

for (const type of ['ludo', 'snakes']) test(`host and guest exchange ready, start and game commands for ${type}`, async()=>{
  const Peer = transport(), host = client(Peer), guest = client(Peer);
  try {
    await host.connection.create(type, 2, 'Host');
    await guest.connection.join(host.state.code, 'Guest');
    assert.equal(host.state.players.length, 2);
    assert.equal(guest.state.players[1].name, 'Guest');
    assert.equal('secret' in guest.state.players[0], false);
    await guest.connection.command({type:'ready',ready:true});
    assert.equal(host.state.canStart,true);
    await assert.rejects(guest.connection.command({type:'start'}));
    await host.connection.command({type:'start'}); await flush();
    assert.equal(guest.state.phase,'playing');
    await assert.rejects(guest.connection.command({type:'roll'}));
    host.connection.host.dice=()=>type==='ludo'?6:3;
    await host.connection.command({type:'roll'}); await flush();
    if(type==='ludo') {
      assert.equal(guest.state.game.pending.die,6);
      await host.connection.command({type:'move',token:0}); await flush();
      assert.equal(guest.state.game.players[0].tokens[0],0);
      host.connection.host.dice=()=>1;
      await host.connection.command({type:'roll'}); await host.connection.command({type:'move',token:0}); await flush();
    } else assert.equal(guest.state.game.players[0].tokens[0],22);
    await guest.connection.command({type:'roll'}); await flush();
    assert.deepEqual(JSON.parse(JSON.stringify(guest.state)),host.state);
    guest.connection.guestConnection.close(); await flush();
    assert.equal(host.state.players[1].connected,false);
    await guest.connection.reconnect(); await flush();
    assert.equal(host.state.players[1].connected,true);
    assert.equal(host.state.players.length,2);
    host.connection.close(); await flush();
    assert.equal(guest.state.connectionLost,true);
  } finally {host.connection.close();guest.connection.close();}
});

test('removing a guest releases the lobby seat and disables the removed client', async()=>{
  const Peer=transport(), host=client(Peer), guest=client(Peer);
  try {
    await host.connection.create('ludo',2,'Host'); await guest.connection.join(host.state.code,'Guest');
    await host.connection.command({type:'remove',player:guest.connection.id}); await flush();
    assert.equal(host.state.players.length,1); assert.equal(guest.state.connectionLost,true);
    assert.equal(guest.connection.disposed,true);
  } finally {host.connection.close();guest.connection.close();}
});
