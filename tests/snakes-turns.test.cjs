const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../rules.js'),Motion=require('../motion.js'),C=require('../commentary.js');
const players=[{id:'a',name:'Nipun',color:'red'},{id:'b',name:'Alex',color:'yellow'}];
const game=()=>R.create('snakes',players),clone=value=>JSON.parse(JSON.stringify(value));

test('every player needs a six to enter; unsuccessful opening rolls stay quiet and pass',()=>{
 for(const die of [1,2,3,4,5]){
  const before=game(),after=clone(before);R.roll(after,'a',die,()=>0);
  assert.equal(after.players[0].tokens[0],0);assert.equal(after.turn,1);assert.equal(after.action.waitingForSix,true);
  assert.equal(after.sixes,0);assert.equal(after.rollCount,1);assert.deepEqual(Motion.plan(before,after),[]);assert.deepEqual(C.events(before,after),[]);
  R.roll(after,'b',die,()=>0);assert.equal(after.players[1].tokens[0],0);assert.equal(after.turn,0);
 }
});

test('an opening six enters square one with a release hop, celebration and one extra roll',()=>{
 const before=game(),after=clone(before);R.roll(after,'a',6,()=>0);
 assert.equal(after.players[0].tokens[0],1);assert.equal(after.turn,0);assert.equal(after.sixes,1);assert.equal(after.action.opened,true);assert.equal(after.action.bonus,'six');
 const motion=Motion.plan(before,after).find(item=>item.primary);assert.equal(motion.segments.length,1);assert.equal(motion.duration,320);assert.deepEqual(motion.end,Motion.point(after,'a',0));
 assert.equal(C.events(before,after).length,1);assert.equal(C.events(before,after)[0].effect,'race-start');
 R.roll(after,'a',1,()=>0);assert.equal(after.players[0].tokens[0],2);assert.equal(after.turn,1);assert.equal(after.sixes,0);
});

test('third consecutive six discards only that roll, retaining the first two moves',()=>{
 const value=game();R.roll(value,'a',6,()=>0);R.roll(value,'a',6,()=>0);
 assert.equal(value.players[0].tokens[0],7);assert.equal(value.turn,0);assert.equal(value.sixes,2);
 const before=clone(value);R.roll(value,'a',6,()=>0);
 assert.equal(value.players[0].tokens[0],7);assert.equal(value.action.threeSixes,true);assert.equal(value.action.type,'roll');assert.equal(value.turn,1);assert.equal(value.sixes,0);
 assert.deepEqual(Motion.plan(before,value),[]);assert.equal(C.events(before,value)[0].kind,'triple-six');
 assert.throws(()=>R.roll(value,'a',1),/turn/);
 R.roll(value,'b',6,()=>0);assert.equal(value.players[1].tokens[0],1);assert.equal(value.turn,1);assert.equal(value.sixes,1,'the opponent starts a new streak');
});

test('a forfeited third six cannot climb a ladder or win',()=>{
 for(const from of [74,94]){
  const value=game();value.players[0].tokens=[from];value.sixes=2;R.roll(value,'a',6,()=>0);
  assert.equal(value.players[0].tokens[0],from);assert.equal(value.winner,null);assert.equal(value.turn,1);assert.equal(value.action.jump,undefined);
 }
});

test('non-six ladder rolls reset the six streak and can chain with one bonus at a time',()=>{
 const value=game();R.roll(value,'a',6,()=>0);R.roll(value,'a',2,()=>0);
 assert.equal(value.players[0].tokens[0],22);assert.equal(value.action.bonus,'ladder');assert.equal(value.turn,0);assert.equal(value.sixes,0);
 R.roll(value,'a',6,()=>0);assert.equal(value.players[0].tokens[0],76);assert.equal(value.action.jump,'ladder');assert.equal(value.sixes,1);assert.equal(value.turn,0);
 R.roll(value,'a',1,()=>0);assert.equal(value.players[0].tokens[0],77);assert.equal(value.turn,1,'a six plus ladder must not bank a second extra roll');assert.equal(value.sixes,0);
});

test('a six keeps its bonus after a snake slide or an overshoot, until the third six',()=>{
 const slide=game();slide.players[0].tokens=[48];R.roll(slide,'a',6,()=>0);
 assert.equal(slide.players[0].tokens[0],34);assert.equal(slide.action.jump,'snake');assert.equal(slide.action.bonus,'six');assert.equal(slide.turn,0);
 const overshoot=game();overshoot.players[0].tokens=[97];
 R.roll(overshoot,'a',6,()=>0);assert.equal(overshoot.players[0].tokens[0],97);assert.equal(overshoot.turn,0);assert.equal(overshoot.sixes,1);
 R.roll(overshoot,'a',6,()=>0);assert.equal(overshoot.turn,0);assert.equal(overshoot.sixes,2);
 R.roll(overshoot,'a',6,()=>0);assert.equal(overshoot.players[0].tokens[0],97);assert.equal(overshoot.turn,1);assert.equal(overshoot.action.threeSixes,true);
});

test('the giant snake sends a near-winner to row one and does not require another opening six',()=>{
 const before=game();before.players[0].tokens=[92];const after=clone(before);R.roll(after,'a',1,()=>0);
 assert.equal(after.players[0].tokens[0],4);assert.equal(after.action.landing,93);assert.equal(after.action.jump,'snake');assert.equal(after.turn,1);
 const motion=Motion.plan(before,after).find(item=>item.primary);assert.equal(motion.segments.length,41);assert.equal(motion.segments[1].highlight,'snake');assert.deepEqual(motion.end,Motion.point(after,'a',0));assert.equal(C.events(before,after)[0].effect,'snake');
 R.roll(after,'b',1,()=>0);R.roll(after,'a',1,()=>0);assert.equal(after.players[0].tokens[0],5);assert.equal(after.action.waitingForSix,undefined);
});

test('opening attempts and third-six forfeits count toward the four-roll shuffle',()=>{
 const missed=game();for(let index=0;index<4;index++)R.roll(missed,R.current(missed).id,1,()=>0);
 assert.equal(missed.rollCount,4);assert.equal(missed.action.snakeShifts.length,6);assert.deepEqual(missed.players.map(player=>player.tokens[0]),[0,0]);
 const triple=game();triple.rollCount=3;triple.sixes=2;triple.players[0].tokens=[70];R.roll(triple,'a',6,()=>0);
 assert.equal(triple.action.threeSixes,true);assert.equal(triple.action.snakeShifts.length,6);assert.equal(triple.players[0].tokens[0],70);assert.equal(triple.turn,1);
});

test('a winning six ends play instead of granting a bonus or shuffling',()=>{
 const value=game();value.rollCount=3;value.sixes=1;value.players[0].tokens=[94];R.roll(value,'a',6,()=>0);
 assert.equal(value.winner,'a');assert.equal(value.players[0].tokens[0],100);assert.equal(value.action.bonus,null);assert.equal(value.action.snakeShifts,undefined);assert.throws(()=>R.roll(value,'a',6));
});

test('all two, three and four player seats obey entry turns',()=>{
 for(const count of [2,3,4]){
  const seats=R.seats(count).map((color,index)=>({id:String(index),name:'Player '+index,color})),value=R.create('snakes',seats);
  for(let index=0;index<count;index++){assert.equal(R.current(value).id,String(index));R.roll(value,String(index),1,()=>0);}
  assert.equal(value.turn,0);assert.ok(value.players.every(player=>player.tokens[0]===0));
 }
});
