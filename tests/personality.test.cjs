const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../rules.js'),G=require('../geometry.js'),Motion=require('../motion.js'),Audio=require('../audio.js'),Commentary=require('../commentary.js');
const players=R.COLORS.map((color,index)=>({id:String(index),name:['Nipun','Alex','Sam','Jo'][index],color}));
const clone=value=>JSON.parse(JSON.stringify(value));
test('one to sixteen stacked Ludo tokens fit inside their square with margin',()=>{
 for(const count of [1,2,3,4,8,12,16]){
  const game=R.create('ludo',players);let left=count;
  for(const player of game.players)player.tokens=player.tokens.map(()=>left-->0?(52-R.OFFSET[player.color])%52:-1);
  for(const player of game.players)player.tokens.forEach((progress,token)=>{
   if(progress===-1)return;const at=G.layout(game,player.id,token),[cx,cy]=at.center;
   assert.ok(Math.abs(at.x-cx)+at.width/2<=19);assert.ok(Math.abs(at.y-cy)+at.height/2<=19);
   assert.deepEqual(Motion.point(game,player.id,token),[at.x,at.y]);
  });
 }
});
test('yard slots form a centred symmetric grid and starting snake pawns fit the frame',()=>{
 const ludo=R.create('ludo',players);
 for(const player of ludo.players){const slots=player.tokens.map((_,index)=>G.layout(ludo,player.id,index));assert.equal(slots[1].x-slots[0].x,84);assert.equal(slots[2].y-slots[0].y,84);const [row,col]=R.coordinate(player.color,-1,0);assert.equal(row%9,1.5);assert.equal(col%9,1.5);}
 const snake=R.create('snakes',players);for(const player of snake.players){const at=G.layout(snake,player.id,0);assert.ok(at.x-at.width/2>24);assert.ok(at.y+at.height/2<660);assert.ok(at.y-at.height/2>636);}
});
test('music offers five distinct compositions and validates saved track preferences',()=>{
 assert.equal(Audio.TRACKS.length,5);assert.equal(new Set(Audio.TRACKS.map(track=>track.bpm)).size,5);assert.equal(new Set(Audio.TRACKS.map(track=>JSON.stringify(track.melody))).size,5);
 const engine=new Audio.Engine();engine.configure({track:'rush',effectsOn:false});assert.equal(engine.settings.track,'rush');engine.configure({track:'bad-value'});assert.equal(engine.settings.track,'rush');assert.equal(engine.settings.effectsOn,false);engine.stop();
});
test('release, capture and finish have different short musical signatures',()=>{
 const signatures=['release','capture','finish'].map(kind=>Audio.STINGS[kind]);assert.equal(new Set(signatures.map(value=>JSON.stringify(value))).size,3);
 for(const notes of signatures){const end=Math.max(...notes.map(([,at,duration])=>at+duration));assert.ok(end>=.45 && end<=.55);}
});
test('commentary announces releases, captures and finishes once per new action',()=>{
 const start=R.create('ludo',players),six=clone(start);R.roll(six,'0',6);assert.deepEqual(Commentary.events(start,six),[]);
 const released=clone(six);R.move(released,'0',0);assert.equal(Commentary.events(six,released)[0].effect,'release');assert.deepEqual(Commentary.events(released,clone(released)),[]);
 const before=R.create('ludo',players);before.players[0].tokens[0]=5;before.players[2].tokens=[32,32,-1,-1];const after=clone(before);R.roll(after,'0',1);R.autoMove(after,'0');const capture=Commentary.events(before,after);assert.equal(capture.length,1);assert.equal(capture[0].effect,'capture');assert.equal(capture[0].text.includes('Sam'),false);
 const finishStart=R.create('ludo',players);finishStart.players[0].tokens[0]=55;const finish=clone(finishStart);R.roll(finish,'0',1);R.autoMove(finish,'0');assert.equal(Commentary.events(finishStart,finish)[0].effect,'finish');
});
test('snake and ladder commentary follows the actual landing result',()=>{
 const start=R.create('snakes',players);start.players[0].tokens[0]=1;const ladder=clone(start);R.roll(ladder,'0',2);assert.equal(Commentary.events(start,ladder)[0].kind,'ladder');
 const before=R.create('snakes',players);before.players[0].tokens[0]=16;const after=clone(before);R.roll(after,'0',1);assert.equal(Commentary.events(before,after)[0].mood,'surprise');assert.equal(Commentary.events(before,after)[0].effect,'snake');
});
test('spoken reactions require a local English voice and respect mute and gesture unlock',()=>{
 const spoken=[],synth={getVoices:()=>[{lang:'en-US',localService:false},{lang:'hi-IN',localService:true}],speak:value=>spoken.push(value),cancel(){},addEventListener(){},removeEventListener(){}};
 const speaker=new Commentary.Speaker({synth,Utterance:class{constructor(text){this.text=text;}}});speaker.unlock();assert.equal(speaker.say('Hurrah!'),false);
 synth.getVoices=()=>[{lang:'en-IN',localService:true}];speaker.refresh();assert.equal(speaker.say('Hurrah!',.4),true);assert.equal(spoken[0].volume,.4);assert.equal(spoken[0].voice.localService,true);assert.ok(spoken[0].rate>=1.2);assert.ok(spoken[0].pitch>=1.2);speaker.configure(false);assert.equal(speaker.say('Oh no!'),false);assert.equal(spoken.length,1);speaker.stop();
});
