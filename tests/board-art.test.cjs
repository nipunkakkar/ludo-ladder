const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const R=require('../rules.js'),G=require('../geometry.js'),Motion=require('../motion.js'),{Room}=require('../room.js');
const window={BoardRules:R,BoardGeometry:G};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../boards.js'),'utf8'),{window});
const players=[{id:'a',name:'Nipun',color:'red'},{id:'b',name:'Alex',color:'yellow'}];
test('the redrawn board retains all numbered squares, ladders and snakes',()=>{
 const art=window.BoardArt.snakes(R.create('snakes',players),'a','test');assert.equal((art.match(/data-square=/g)||[]).length,100);assert.equal((art.match(/class="board-ladder"/g)||[]).length,Object.keys(R.LADDER).length);assert.equal((art.match(/class="board-snake"/g)||[]).length,Object.keys(R.SNAKE).length);assert.equal(art.includes('NaN'),false);
 for(const [from,to]of [...Object.entries(R.LADDER),...Object.entries(R.SNAKE)])assert.ok(art.includes(`data-from="${from}" data-to="${to}"`));
});
test('snake drawing and animated slides use the same centre line and exact endpoints',()=>{
 for(const [from,to]of Object.entries(R.SNAKE)){
  const start=G.center('snakes','red',Number(from)),end=G.center('snakes','red',to),points=G.snakeCurve(start,end);assert.deepEqual(points[0],start);assert.deepEqual(points.at(-1),end);assert.deepEqual(Motion.curve(start,end,true),points);assert.ok(points.every(point=>point.every(Number.isFinite)));
 }
});

test('the ninety-to-first-row snake has a visibly larger body and head',()=>{
 const art=window.BoardArt.snakes(R.create('snakes',players),'a','test');
 assert.ok(art.includes('data-from="93" data-to="4" data-giant="true"'));assert.ok(art.includes('Giant snake: 93 to 4'));assert.ok(art.includes('scale(1.18)'));
 const ordinary=window.BoardArt.snakeArt(17,7,0,'test'),giant=window.BoardArt.snakeArt(93,4,4,'test');
 assert.equal(ordinary.includes('data-giant'),false);assert.equal(giant.includes('NaN'),false);
});
test('the room refuses both old and new seats once the winning move completes',()=>{
 const room=new Room({code:'ABC234',type:'snakes',capacity:2,hostId:'a',name:'Nipun',secret:'a'.repeat(32),dice:()=>1});room.join({id:'b',name:'Alex',secret:'b'.repeat(32)});room.game.players[0].tokens=[99];room.command('a',{type:'roll',version:room.version});
 assert.equal(room.phase,'won');for(const id of ['a','b','c'])assert.throws(()=>room.join({id,name:'Player',secret:id.repeat(32)}),/expired/);assert.throws(()=>room.command('a',{type:'rematch',version:room.version}),/expired/);
});
