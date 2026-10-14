const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../rules.js'),C=require('../commentary.js'),Motion=require('../motion.js'),{STINGS}=require('../audio.js');
const players=[{id:'a',name:'Nipun',color:'red'},{id:'b',name:'Alex',color:'yellow'}],clone=value=>JSON.parse(JSON.stringify(value));
function rolled(type,tokens,die){const before=R.create(type,players);before.players[0].tokens=tokens;const after=clone(before);R.roll(after,'a',die,()=>0);if(type==='ludo')R.autoMove(after,'a');return{before,after};}
test('ordinary rolls, blocked rolls and routine moves have no commentary in either game',()=>{
 const miss=rolled('ludo',[-1,-1,-1,-1],2);assert.deepEqual(C.events(miss.before,miss.after),[]);
 const walk=rolled('ludo',[2,-1,-1,-1],3);assert.deepEqual(C.events(walk.before,walk.after),[]);
 const choice=rolled('ludo',[2,5,-1,-1],3);assert.deepEqual(C.events(choice.before,choice.after),[]);
 const snakeWalk=rolled('snakes',[5],1);assert.deepEqual(C.events(snakeWalk.before,snakeWalk.after),[]);
 const overshoot=rolled('snakes',[99],4);assert.deepEqual(C.events(overshoot.before,overshoot.after),[]);
});
test('each Snakes and Ladders pawn starts once, then ordinary moves stay quiet',()=>{
 const start=rolled('snakes',[0],6);assert.equal(C.events(start.before,start.after)[0].effect,'race-start');
 const walk=rolled('snakes',[1],1);assert.deepEqual(C.events(walk.before,walk.after),[]);
});
test('home stretch and final row react on crossing the milestone, not on every later step',()=>{
 const home=rolled('ludo',[49,-1,-1,-1],2);assert.equal(C.events(home.before,home.after)[0].kind,'home-stretch');
 const homeStep=rolled('ludo',[51,-1,-1,-1],1);assert.deepEqual(C.events(homeStep.before,homeStep.after),[]);
 const top=rolled('snakes',[88],3);assert.equal(C.events(top.before,top.after)[0].kind,'near-finish');
 const topStep=rolled('snakes',[90],1);assert.deepEqual(C.events(topStep.before,topStep.after),[]);
});
test('late lead changes and a Ludo photo finish count as intense moments',()=>{
 const before=R.create('snakes',players);before.players[0].tokens=[88];before.players[1].tokens=[89];const after=clone(before);R.roll(after,'a',2,()=>0);assert.equal(C.events(before,after)[0].kind,'lead-change');
 const ludo=R.create('ludo',players);ludo.players[0].tokens=[56,56,56,52];ludo.players[1].tokens=[56,56,56,53];const end=clone(ludo);R.roll(end,'a',1);R.autoMove(end,'a');assert.equal(C.events(ludo,end)[0].kind,'showdown');
});
test('climb and slide commentary and music start at the jump, with one cue per action',()=>{
 for(const [from,die,kind] of [[1,2,'ladder'],[16,1,'snake']]){
  const {before,after}=rolled('snakes',[from],die),motions=Motion.plan(before,after),events=C.events(before,after),cues=C.schedule(events,motions,{lead:650});
  assert.equal(cues.length,1);assert.equal(cues[0].effect,kind);assert.equal(cues[0].delay,650+die*145);assert.ok(STINGS[kind]);
  assert.equal(motions.flatMap(item=>item.segments).filter(segment=>segment.sound===kind).length,0,'jump sounds must not play twice');
  assert.equal(C.schedule(events,motions,{lead:650,reduced:true})[0].delay,0);
 }
});
test('reactions vary while all clients agree, and winning replaces lesser reactions',()=>{
 const one=rolled('snakes',[0],6),other=clone(one.after);other.action.id+=1;assert.notEqual(C.events(one.before,one.after)[0].text,C.events(one.before,other)[0].text);assert.deepEqual(C.events(one.before,one.after),C.events(clone(one.before),clone(one.after)));
 const win=rolled('snakes',[99],1);assert.equal(C.events(win.before,win.after).length,1);assert.equal(C.events(win.before,win.after)[0].effect,'win');
});
