const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../rules.js'),Motion=require('../motion.js'),{Room}=require('../room.js'),{Engine,DEFAULTS}=require('../audio.js');
const players=[{id:'a',name:'Nipun',color:'red'},{id:'b',name:'Alex',color:'yellow'}];
const clone=value=>JSON.parse(JSON.stringify(value));
function room(die=3){const value=new Room({code:'ABC234',type:'ludo',capacity:2,name:'Nipun',hostId:'a',secret:'a'.repeat(32),dice:()=>die});value.join({id:'b',name:'Alex',secret:'b'.repeat(32)});value.command('b',{type:'ready',ready:true,version:value.version});value.command('a',{type:'start',version:value.version});return value;}
test('one legal token moves automatically in the shared room, once per roll',()=>{
 const value=room(3);value.game.players[0].tokens=[0,-1,-1,-1];const version=value.version;
 value.command('a',{type:'roll',version});assert.equal(value.game.players[0].tokens[0],3);assert.equal(value.game.pending,null);assert.equal(value.game.turn,1);assert.equal(value.game.action.automatic,true);assert.equal(value.version,version+1);
 assert.equal(value.game.lastDie.id,1);assert.equal(value.game.action.id,2);assert.throws(()=>value.command('a',{type:'move',token:0,version:value.version}));
});
test('multiple choices stay manual, including a six with tokens still in the yard',()=>{
 const value=room(6);value.game.players[0].tokens=[0,-1,-1,-1];value.command('a',{type:'roll',version:value.version});assert.deepEqual(R.legal(value.game),[0,1,2,3]);assert.equal(value.game.action.automatic,undefined);
 const another=room(3);another.game.players[0].tokens=[0,2,-1,-1];another.command('a',{type:'roll',version:another.version});assert.deepEqual(R.legal(another.game),[0,1]);
});
test('automatic captures and exact finishes preserve bonuses and winner detection',()=>{
 const value=room(1);value.game.players[0].tokens=[5,-1,-1,-1];value.game.players[1].tokens=[32,-1,-1,-1];value.command('a',{type:'roll',version:value.version});assert.equal(value.game.players[1].tokens[0],-1);assert.equal(value.game.turn,0);assert.equal(value.game.action.captured.length,1);
 const finish=room(1);finish.game.players[0].tokens=[56,56,56,55];finish.command('a',{type:'roll',version:finish.version});assert.equal(finish.phase,'won');assert.equal(finish.game.winner,'a');assert.equal(finish.game.action.automatic,true);
});
test('Ludo motion visits every square and lands at the actual token position',()=>{
 const before=R.create('ludo',players);before.players[0].tokens[0]=0;const after=clone(before);R.roll(after,'a',3);R.autoMove(after,'a');const motion=Motion.plan(before,after).find(item=>item.primary);
 assert.equal(motion.segments.length,3);assert.deepEqual(motion.start,Motion.point(before,'a',0));assert.deepEqual(motion.segments[0].to,Motion.center('ludo','red',1));assert.deepEqual(motion.end,Motion.point(after,'a',0));assert.deepEqual(motion.segments.at(-1).to,motion.end);
});
test('capture returns wait for the moving token to reach the captured square',()=>{
 const before=R.create('ludo',players);before.players[0].tokens[0]=5;before.players[1].tokens[0]=32;const after=clone(before);R.roll(after,'a',1);R.autoMove(after,'a');const motions=Motion.plan(before,after),primary=motions.find(item=>item.primary),captured=motions.find(item=>item.capture);
 assert.equal(captured.delay,primary.duration);assert.deepEqual(captured.end,Motion.point(after,'b',0));assert.ok(captured.segments.length>2);
});
test('Snakes and Ladders first walks to the landing square, then climbs or slides',()=>{
 const before=R.create('snakes',players),after=clone(before);R.roll(after,'a',3);const ladder=Motion.plan(before,after).find(item=>item.primary);assert.equal(ladder.segments.length,4);assert.equal(ladder.segments.at(-1).highlight,'ladder');assert.deepEqual(ladder.end,Motion.point(after,'a',0));
 const snakeStart=R.create('snakes',players);snakeStart.players[0].tokens[0]=16;const snakeEnd=clone(snakeStart);R.roll(snakeEnd,'a',1);const snake=Motion.plan(snakeStart,snakeEnd).find(item=>item.primary);assert.equal(snake.segments[1].highlight,'snake');assert.equal(snake.segments.length,21);assert.deepEqual(snake.segments.at(-1).to,Motion.point(snakeEnd,'a',0));
});
test('music and effects default on, remember separate volumes and clamp bad levels',()=>{
 const audio=new Engine();assert.deepEqual(audio.settings,DEFAULTS);assert.equal(audio.settings.musicOn,true);audio.configure({musicOn:false,music:.2,effects:.8});assert.equal(audio.settings.effectsOn,true);assert.equal(audio.settings.effects,.8);audio.configure({effectsOn:false,musicOn:true,music:10,effects:-3});assert.equal(audio.settings.music,1);assert.equal(audio.settings.effects,0);assert.equal(audio.settings.musicOn,true);audio.stop();
});
