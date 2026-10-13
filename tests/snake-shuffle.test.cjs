const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../rules.js'),G=require('../geometry.js'),Motion=require('../motion.js'),C=require('../commentary.js');
const players=[{id:'a',name:'Nipun',color:'red'},{id:'b',name:'Alex',color:'yellow'},{id:'c',name:'Sam',color:'green'}],clone=value=>JSON.parse(JSON.stringify(value));
function shifting(actorAt=1,others=[11,11]){const before=R.create('snakes',players);before.rollCount=3;before.players[0].tokens=[actorAt];before.players[1].tokens=[others[0]];before.players[2].tokens=[others[1]];const after=clone(before);R.roll(after,'a',1,()=>0);return{before,after};}
test('only every fourth turn shuffles all snakes, with both ends moving within their rows',()=>{
 const game=R.create('snakes',players);let seed=17;
 const randomIndex=length=>{seed=(seed*1664525+1013904223)>>>0;return seed%length;};
 for(let turn=1;turn<=400;turn++){
  const before=clone(game.snakes),id=R.current(game).id;R.current(game).tokens=[0];R.roll(game,id,1,randomIndex);const shifts=game.action.snakeShifts;
  if(turn%4){assert.equal(shifts,undefined);assert.deepEqual(game.snakes,before);continue;}
  assert.equal(shifts.length,6);
  for(const shift of shifts){
   assert.notEqual(shift.from,shift.to);assert.notEqual(shift.fromTail,shift.tail);
   assert.equal(R.snakeCoordinate(shift.from)[0],R.snakeCoordinate(shift.to)[0]);assert.equal(R.snakeCoordinate(shift.fromTail)[0],R.snakeCoordinate(shift.tail)[0]);
  }
  assert.equal(game.snakes.filter((snake,index)=>snake.head!==before[index].head && snake.tail!==before[index].tail).length,6);
  assert.equal(new Set(game.snakes.flatMap(snake=>[snake.head,snake.tail])).size,12);
  for(const snake of game.snakes){assert.ok(snake.head>snake.tail);assert.notEqual(snake.head,100);for(const square of [snake.head,snake.tail]){assert.equal(!!R.LADDER[square],false);assert.equal(Object.values(R.LADDER).includes(square),false);}}
 }
});
test('every pawn on any new head slides to that snake\'s new tail, including shared squares',()=>{
 const {after}=shifting(),shift=after.action.snakeShifts[0];assert.equal(shift.to,11);assert.equal(shift.fromTail,7);assert.equal(shift.tail,1);assert.deepEqual(shift.players.map(item=>item.player),['b','c']);assert.equal(after.players[1].tokens[0],1);assert.equal(after.players[2].tokens[0],1);
 const different=shifting(1,[11,51]).after;assert.equal(different.players[1].tokens[0],1);assert.equal(different.players[2].tokens[0],31);assert.equal(different.action.snakeShifts.flatMap(shift=>shift.players).length,2);
});
test('future rolls use relocated heads, and old heads become ordinary squares',()=>{
 const first=shifting().after,ordinary=clone(first);ordinary.turn=0;ordinary.players[0].tokens=[16];R.roll(ordinary,'a',1,()=>0);assert.equal(ordinary.players[0].tokens[0],17);assert.equal(ordinary.action.jump,null);
 const landing=clone(first);landing.turn=0;landing.players[0].tokens=[10];R.roll(landing,'a',1,()=>0);assert.equal(landing.players[0].tokens[0],1);assert.equal(landing.action.jump,'snake');
});
test('animation completes the rolled move, morphs all six snakes together, then slides caught pawns',()=>{
 const {before,after}=shifting(),motions=Motion.plan(before,after),primary=motions.find(item=>item.primary),bodies=motions.filter(item=>item.kind==='snake-shift');assert.equal(primary.duration,145);assert.equal(bodies.length,6);
 for(const body of bodies){assert.equal(body.delay,145);assert.equal(body.duration,1050);assert.deepEqual(body.startTail,G.center('snakes','red',after.action.snakeShifts[body.index].fromTail));assert.deepEqual(body.endTail,G.center('snakes','red',after.action.snakeShifts[body.index].tail));}
 for(const id of ['b','c']){const pawn=motions.find(item=>item.player===id);assert.equal(pawn.segments[0].duration,1195);assert.equal(pawn.duration,2035);assert.deepEqual(pawn.end,G.point(after,id,0));}
 const cues=C.schedule(C.events(before,after),motions,{lead:650});assert.equal(cues.length,1);assert.equal(cues[0].kind,'snake-shift');assert.equal(cues[0].delay,795);assert.equal(cues[0].text.includes('Nipun'),false);assert.equal(C.schedule(C.events(before,after),motions,{reduced:true})[0].delay,0);
 assert.equal(motions.flatMap(motion=>motion.segments).filter(segment=>segment.sound==='snake').length,1,'multiple caught pawns share one slide sound');
});
test('the rolling pawn can be caught after arriving without skipping its rolled square',()=>{
 const {before,after}=shifting(10,[2,3]);assert.equal(after.action.to,11);assert.equal(after.players[0].tokens[0],1);const pawn=Motion.plan(before,after).find(item=>item.player==='a');assert.deepEqual(pawn.segments[0].to,G.center('snakes','red',11));assert.equal(pawn.segments[1].duration,1050);assert.deepEqual(pawn.end,G.point(after,'a',0));
});
test('ordinary turns stay quiet, while a scheduled shuffle announces one funny reaction',()=>{
 const before=R.create('snakes',players);before.players[0].tokens=[5];const after=clone(before);R.roll(after,'a',1,()=>0);assert.equal(after.action.snakeShifts,undefined);assert.deepEqual(C.events(before,after),[]);
 const fourth=clone(before);fourth.rollCount=3;const end=clone(fourth);R.roll(end,'a',1,()=>0);assert.equal(C.events(fourth,end).length,1);assert.equal(C.events(fourth,end)[0].effect,'head-shift');
});
test('overshoots count toward the four-turn schedule, but a winning roll skips the shuffle',()=>{
 const blocked=R.create('snakes',players);blocked.players[0].tokens=[99];blocked.rollCount=3;R.roll(blocked,'a',4,()=>0);assert.equal(blocked.action.snakeShifts.length,6);assert.equal(blocked.players[0].tokens[0],99);assert.equal(blocked.turn,1);
 const win=R.create('snakes',players);win.rollCount=3;win.players[0].tokens=[99];R.roll(win,'a',1,()=>0);assert.equal(win.winner,'a');assert.equal(win.action.snakeShifts,undefined);
});
