const test=require('node:test'), assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {EventEmitter}=require('node:events'),{webcrypto}=require('node:crypto');
const BoardRules=require('../rules.js'),RoomRules=require('../room.js');
const source=fs.readFileSync(path.join(__dirname,'../network.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const normalize=value=>JSON.parse(JSON.stringify(value));

// Model the documented public relay's server-assigned IDs and private delivery.
// Actual public-service connectivity is separately checked in two browser tabs.
function transport(){
 const rooms=new Map();let sequence=0;
 return {connect(channel,options){
  const socket=new EventEmitter();socket.uid='u'+(++sequence);socket.alias=options.as;socket.closed=false;
  socket.send=(message,target)=>{const payload=structuredClone(message);queueMicrotask(()=>{for(const peer of rooms.get(channel)||[])if(peer!==socket && !peer.closed && (!target || peer.uid===target))peer.emit('message',{message:payload,uid:socket.uid,alias:socket.alias});});return socket;};
  socket.close=()=>{
   if(socket.closed)return;socket.closed=true;const peers=rooms.get(channel);peers?.delete(socket);
   queueMicrotask(()=>{socket.emit('close');for(const peer of peers||[])peer.emit('leave',{uid:socket.uid,alias:socket.alias,total:peers.size});});return socket;
  };
  setImmediate(()=>{
   if(socket.closed)return;let peers=rooms.get(channel);if(!peers){peers=new Set();rooms.set(channel,peers);}peers.add(socket);
   socket.emit('join',{self:true,uid:socket.uid,alias:socket.alias,users:[...peers].map(peer=>({uid:peer.uid,alias:peer.alias})),total:peers.size});
   for(const peer of peers)if(peer!==socket)peer.emit('join',{uid:socket.uid,alias:socket.alias,total:peers.size});
  });
  return socket;
 }};
}
function client(relay,storage=new Map()){
 let latest;const window={BoardRules,RoomRules,LudoRelay:relay,LUDO_LADDER_CONFIG:{roomPrefix:'test-ll-'}};
 vm.runInNewContext(source,{window,crypto:webcrypto,setTimeout,clearTimeout,sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
 return {connection:new window.RoomNetwork.Connection(state=>{latest=state;},()=>{}),storage,get state(){return latest;}};
}
for(const type of ['ludo','snakes'])test(`relay protocol validates ready, start, turns and reconnect for ${type}`,async()=>{
 const relay=transport(),host=client(relay),guest=client(relay);
 try{
  await host.connection.create(type,2,'Host');await guest.connection.join(host.state.code,'Guest');
  assert.equal(host.state.players.length,2);assert.equal('secret' in guest.state.players[0],false);
  await guest.connection.command({type:'ready',ready:true});assert.equal(host.state.canStart,true);
  await assert.rejects(guest.connection.command({type:'start'}));await host.connection.command({type:'start'});await flush();
  await assert.rejects(guest.connection.command({type:'roll'}));host.connection.host.dice=()=>type==='ludo'?6:3;
  await host.connection.command({type:'roll'});await flush();
  if(type==='ludo'){
   assert.equal(guest.state.game.pending.die,6);await host.connection.command({type:'move',token:0});await flush();assert.equal(guest.state.game.players[0].tokens[0],0);
   host.connection.host.dice=()=>1;await host.connection.command({type:'roll'});await host.connection.command({type:'move',token:0});await flush();
  }else assert.equal(guest.state.game.players[0].tokens[0],22);
  await guest.connection.command({type:'roll'});await flush();assert.deepEqual(normalize(guest.state),normalize(host.state));
  guest.connection.relay.close();await flush();assert.equal(host.state.players[1].connected,false);
  await guest.connection.reconnect();await flush();assert.equal(host.state.players[1].connected,true);assert.equal(host.state.players.length,2);
  host.connection.close();await flush();assert.equal(guest.state.connectionLost,true);assert.equal(guest.connection.disposed,true);
 }finally{host.connection.close();guest.connection.close();}
});
test('guest removal disables its client and releases the lobby seat',async()=>{
 const relay=transport(),host=client(relay),guest=client(relay);
 try{await host.connection.create('ludo',2,'Host');await guest.connection.join(host.state.code,'Guest');await host.connection.command({type:'remove',player:guest.connection.id});await flush();assert.equal(host.state.players.length,1);assert.equal(guest.connection.disposed,true);}finally{host.connection.close();guest.connection.close();}
});
test('private delivery hides seat secrets and ignores state updates from an unbound sender',async()=>{
 const relay=transport(),host=client(relay),guest=client(relay);let observer;const packets=[];
 try{
  await host.connection.create('ludo',2,'Host');observer=relay.connect('test-ll-'+host.state.code,{as:'observer'});observer.on('message',packet=>packets.push(packet));await flush();
  await guest.connection.join(host.state.code,'Guest');await guest.connection.command({type:'ready',ready:true});await flush();assert.equal(packets.length,0);
  const before=normalize(guest.state);observer.send({kind:'state',code:host.state.code,state:{...before,version:9999,phase:'won'}},guest.connection.uid);await flush();assert.deepEqual(normalize(guest.state),before);
  host.connection.relay.close();await flush();const previousHost=guest.connection.hostUid;observer.alias='ludo-ladder-host';observer.send({kind:'host-return',code:host.state.code,hostId:host.connection.id,proof:'wrong'},guest.connection.uid);await flush();assert.equal(guest.connection.hostUid,previousHost);assert.equal(guest.state.connectionLost,true);
 }finally{host.connection.close();guest.connection.close();observer?.close();}
});
test('host connection can return without losing the shared game',async()=>{
 const relay=transport(),host=client(relay),guest=client(relay);
 try{
  await host.connection.create('snakes',2,'Host');await guest.connection.join(host.state.code,'Guest');await guest.connection.command({type:'ready',ready:true});await host.connection.command({type:'start'});await flush();
  host.connection.host.dice=()=>3;await host.connection.command({type:'roll'});await flush();host.connection.relay.close();await flush();assert.equal(guest.state.connectionLost,true);
  await host.connection.reconnect();await flush();await flush();assert.equal(guest.state.connectionLost,undefined);assert.equal(guest.state.game.players[0].tokens[0],22);
  await guest.connection.command({type:'roll'});await flush();assert.deepEqual(normalize(guest.state),normalize(host.state));
 }finally{host.connection.close();guest.connection.close();}
});
test('missing rooms reject promptly instead of waiting for an unreachable peer',async()=>{
 const guest=client(transport());try{await assert.rejects(guest.connection.join('ABC234','Guest'),/Room not found/);}finally{guest.connection.close();}
});
