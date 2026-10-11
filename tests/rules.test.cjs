const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../rules.js');
const {Room}=require('../room.js');
const players=[{id:'a',name:'Nipun',color:'red'},{id:'b',name:'Alex',color:'yellow'}];
const game=type=>R.create(type,players);
function room(code='ABC234',dice=()=>6){return new Room({code,type:'ludo',capacity:2,hostId:'a',name:'Nipun',secret:'a'.repeat(32),dice});}
function startRoom(value){value.join({id:'b',name:'Alex',secret:'b'.repeat(32)});value.command('b',{type:'ready',ready:true,version:value.version});value.command('a',{type:'start',version:value.version});}

test('board geometry is one unique 52-cell track, with correct opposing seats',()=>{
 assert.equal(R.TRACK.length,52);assert.equal(new Set(R.TRACK.map(x=>x.join(','))).size,52);
 assert.deepEqual(R.seats(2),['red','yellow']);assert.deepEqual(R.seats(4),R.COLORS);
 assert.deepEqual(R.coordinate('red',0),[6,1]);assert.deepEqual(R.coordinate('green',0),[1,8]);
 assert.deepEqual(R.snakeCoordinate(1),[9,0]);assert.deepEqual(R.snakeCoordinate(10),[9,9]);assert.deepEqual(R.snakeCoordinate(11),[8,9]);assert.deepEqual(R.snakeCoordinate(100),[0,0]);
});
test('a six releases a token; extra rolls and token choice work',()=>{
 const g=game('ludo');R.roll(g,'a',6);assert.deepEqual(R.legal(g),[0,1,2,3]);R.move(g,'a',2);
 assert.equal(g.players[0].tokens[2],0);assert.equal(g.turn,0);assert.equal(g.pending,null);
 R.roll(g,'a',3);assert.deepEqual(R.legal(g),[2]);R.move(g,'a',2);assert.equal(g.players[0].tokens[2],3);assert.equal(g.turn,1);
});
test('no legal move passes the turn, out-of-turn and duplicate rolls are rejected',()=>{
 const g=game('ludo');assert.throws(()=>R.roll(g,'b',6));R.roll(g,'a',2);assert.equal(g.turn,1);
 R.roll(g,'b',6);assert.throws(()=>R.roll(g,'b',6));assert.throws(()=>R.move(g,'a',0));assert.throws(()=>R.move(g,'b',9));
 assert.equal(g.players[1].tokens[0],-1);
});
test('captures return all rival tokens on the unsafe square and grant a bonus',()=>{
 const g=game('ludo');g.players[0].tokens[0]=5;g.players[1].tokens=[32,32,-1,-1];
 // Yellow starts at offset 26, so progress 32 is red's global square 6.
 R.roll(g,'a',1);R.move(g,'a',0);assert.deepEqual(g.players[1].tokens,[-1,-1,-1,-1]);assert.equal(g.action.captured.length,2);assert.equal(g.turn,0);
});
test('star squares protect rival tokens',()=>{
 const g=game('ludo');g.players[0].tokens[0]=7;g.players[1].tokens[0]=34;
 R.roll(g,'a',1);R.move(g,'a',0);assert.equal(g.players[1].tokens[0],34);assert.equal(g.action.captured.length,0);assert.equal(g.turn,1);
});
test('home lanes cannot be captured, need exact rolls, and all four home wins',()=>{
 const g=game('ludo');g.players[0].tokens=[56,56,56,55];
 R.roll(g,'a',2);assert.equal(g.turn,1);assert.equal(g.winner,null);
 R.roll(g,'b',1);R.roll(g,'a',1);R.move(g,'a',3);assert.equal(g.winner,'a');assert.throws(()=>R.roll(g,'a',6));
});
test('three consecutive sixes forfeit the current turn',()=>{
 const g=game('ludo');R.roll(g,'a',6);R.move(g,'a',0);R.roll(g,'a',6);R.move(g,'a',0);R.roll(g,'a',6);
 assert.equal(g.turn,1);assert.equal(g.pending,null);assert.equal(g.players[0].tokens[0],6);
});
test('snakes and ladders transport only on landing, then pass the turn',()=>{
 const g=game('snakes');R.roll(g,'a',3);assert.equal(g.players[0].tokens[0],22);assert.equal(g.action.jump,'ladder');assert.equal(g.turn,1);
 g.players[1].tokens[0]=15;R.roll(g,'b',2);assert.equal(g.players[1].tokens[0],7);assert.equal(g.action.jump,'snake');assert.equal(g.turn,0);
});
test('snake finish needs an exact roll, overshooting does not move, and winner freezes play',()=>{
 const g=game('snakes');g.players[0].tokens[0]=97;R.roll(g,'a',5);assert.equal(g.players[0].tokens[0],97);assert.equal(g.turn,1);
 R.roll(g,'b',1);R.roll(g,'a',3);assert.equal(g.winner,'a');assert.equal(g.players[0].tokens[0],100);assert.throws(()=>R.roll(g,'b',2));
});
test('room starts only when all selected seats are ready; only host can start',()=>{
 const value=room();assert.throws(()=>value.command('a',{type:'start',version:value.version}));
 value.join({id:'b',name:'Alex',secret:'b'.repeat(32)});assert.equal(value.canStart(),false);
 value.command('b',{type:'ready',ready:true,version:value.version});assert.equal(value.canStart(),true);
 assert.throws(()=>value.command('b',{type:'start',version:value.version}));value.command('a',{type:'start',version:value.version});assert.equal(value.phase,'playing');
});
test('capacity, late joins and unauthenticated seat takeovers are rejected',()=>{
 const value=room();startRoom(value);
 assert.throws(()=>value.join({id:'c',name:'Extra',secret:'c'.repeat(32)}));
 value.disconnect('b');assert.throws(()=>value.join({id:'b',name:'Intruder',secret:'c'.repeat(32)}));
 value.join({id:'b',name:'Alex',secret:'b'.repeat(32)});assert.equal(value.players[1].connected,true);
});
test('room dice come from host authority, not the client, and stale actions cannot replay',()=>{
 const value=room('ABC234',()=>2);startRoom(value);
 const version=value.version;value.command('a',{type:'roll',die:6,version});assert.equal(value.game.lastDie.value,2);
 assert.throws(()=>value.command('a',{type:'roll',version}));assert.equal(value.game.lastDie.value,2);
});
test('independent rooms never modify each other and snapshots do not leak seat secrets',()=>{
 const first=room('ABC234'),second=room('XYZ567');startRoom(first);startRoom(second);
 first.command('a',{type:'roll',version:first.version});first.command('a',{type:'move',token:0,version:first.version});
 assert.equal(first.game.players[0].tokens[0],0);assert.equal(second.game.players[0].tokens[0],-1);
 const snapshot=first.snapshot();assert.equal(JSON.stringify(snapshot).includes('secret'),false);
 snapshot.game.players[0].tokens[0]=55;assert.equal(first.game.players[0].tokens[0],0);
});
test('disconnected guests retain their seat during a game and cannot act until rejoined',()=>{
 const value=room();startRoom(value);value.command('a',{type:'roll',version:value.version});value.command('a',{type:'move',token:0,version:value.version});
 value.disconnect('b',true);assert.equal(value.players.length,2);assert.throws(()=>value.command('b',{type:'roll',version:value.version}));
 value.join({id:'b',name:'Alex',secret:'b'.repeat(32)});assert.equal(value.players[1].connected,true);
});
test('lobby removal makes a seat available and rematch requires the host and a completed game',()=>{
 const value=room();value.join({id:'b',name:'Alex',secret:'b'.repeat(32)});
 assert.throws(()=>value.command('b',{type:'remove',player:'a',version:value.version}));
 value.command('a',{type:'remove',player:'b',version:value.version});assert.equal(value.players.length,1);
 startRoom(value);assert.throws(()=>value.command('a',{type:'rematch',version:value.version}));
 value.game.winner='a';value.phase='won';value.command('a',{type:'rematch',version:value.version});assert.equal(value.phase,'lobby');assert.equal(value.game,null);assert.equal(value.players[1].ready,false);
});
test('three and four player games rotate across every seat',()=>{
 for(const total of [3,4]){const names=R.seats(total).map((color,i)=>({id:String(i),name:'Player '+i,color}));const g=R.create('ludo',names);for(let i=0;i<total;i++){assert.equal(R.current(g).id,String(i));R.roll(g,String(i),1);}assert.equal(g.turn,0);}
});
