const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../rules.js'),G=require('../geometry.js'),Motion=require('../motion.js'),C=require('../commentary.js');
const players=[{id:'a',name:'Nipun',color:'red'},{id:'b',name:'Alex',color:'yellow'},{id:'c',name:'Sam',color:'green'}],clone=value=>JSON.parse(JSON.stringify(value));
function shifting(actorAt=1,others=[11,11]){const before=R.create('snakes',players);before.rollCount=3;before.players[0].tokens=[actorAt];before.players[1].tokens=[others[0]];before.players[2].tokens=[others[1]];const after=clone(before);R.roll(after,'a',1,()=>0);return{before,after};}
test('every fourth roll moves one mouth within its row, keeping all tails fixed',()=>{
 const game=R.create('snakes',players),tails=new Map(game.snakes.map(snake=>[snake.id,snake.tail]));let shifts=0;
 for(let roll=1;roll<=40;roll++){const id=R.current(game).id;R.current(game).tokens=[0];R.roll(game,id,1,length=>(roll+shifts)%length);const shift=game.action.snakeShift;if(shift){shifts++;assert.equal(roll%4,0);assert.notEqual(shift.from,shift.to);assert.equal(Math.floor((shift.from-1)/10),Math.floor((shift.to-1)/10));assert.equal(shift.tail,tails.get(shift.id));}else assert.notEqual(roll%4,0);assert.equal(new Set(game.snakes.map(snake=>snake.head)).size,6);for(const snake of game.snakes){assert.equal(snake.tail,tails.get(snake.id));assert.ok(snake.head>snake.tail);assert.notEqual(snake.head,100);assert.equal(!!R.LADDER[snake.head],false);assert.equal(Object.values(R.LADDER).includes(snake.head),false);}}
 assert.equal(shifts,10);
});
test('every pawn already sitting on the new mouth slides to its unchanged tail',()=>{
 const {after}=shifting();assert.equal(after.action.snakeShift.to,11);assert.equal(after.action.snakeShift.tail,7);assert.deepEqual(after.action.snakeShift.players.map(item=>item.player),['b','c']);assert.equal(after.players[1].tokens[0],7);assert.equal(after.players[2].tokens[0],7);
});
test('future rolls use the relocated mouth, and the original mouth becomes an ordinary square',()=>{
 const {after}=shifting();after.turn=0;after.players[0].tokens=[16];R.roll(after,'a',1,()=>0);assert.equal(after.players[0].tokens[0],17);assert.equal(after.action.jump,null);
 after.turn=0;after.players[0].tokens=[10];R.roll(after,'a',1,()=>0);assert.equal(after.players[0].tokens[0],7);assert.equal(after.action.jump,'snake');
});
test('animation finishes the roll, shifts the mouth, then slides all caught pawns',()=>{
 const {before,after}=shifting(),motions=Motion.plan(before,after),primary=motions.find(item=>item.primary),body=motions.find(item=>item.kind==='snake-shift');assert.equal(primary.duration,145);assert.equal(body.delay,145);assert.equal(body.duration,650);
 for(const id of ['b','c']){const pawn=motions.find(item=>item.player===id);assert.equal(pawn.segments[0].duration,795);assert.equal(pawn.duration,1635);assert.deepEqual(pawn.end,G.point(after,id,0));}
 const cues=C.schedule(C.events(before,after),motions,{lead:650});assert.equal(cues.length,1);assert.equal(cues[0].kind,'snake-shift');assert.equal(cues[0].delay,795);assert.equal(cues[0].text.includes('Nipun'),false);assert.equal(C.schedule(C.events(before,after),motions,{reduced:true})[0].delay,0);
});
test('the rolling pawn can be caught after arriving, without teleporting past its rolled square',()=>{
 const {before,after}=shifting(10,[2,3]);assert.equal(after.action.to,11);assert.equal(after.players[0].tokens[0],7);const pawn=Motion.plan(before,after).find(item=>item.player==='a');assert.deepEqual(pawn.segments[0].to,G.center('snakes','red',11));assert.equal(pawn.segments[1].duration,650);assert.deepEqual(pawn.end,G.point(after,'a',0));
});
test('a winning roll closes the game before any scheduled snake shift',()=>{
 const game=R.create('snakes',players);game.rollCount=3;game.players[0].tokens=[99];R.roll(game,'a',1,()=>0);assert.equal(game.winner,'a');assert.equal(game.action.snakeShift,undefined);
});
