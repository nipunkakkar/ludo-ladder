(function (root, factory) {
  const rules = typeof module === 'object' && module.exports ? require('./rules.js') : root.BoardRules;
  const geometry = typeof module === 'object' && module.exports ? require('./geometry.js') : root.BoardGeometry;
  const api = factory(root, rules, geometry);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoardMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, R, G) {
  'use strict';
  const center=G.center,point=G.point;
  function curve(from,to,snake=false) {
    if(snake)return G.snakeCurve(from,to);
    const [x,y]=from,[tx,ty]=to,dx=tx-x,dy=ty-y,len=Math.hypot(dx,dy)||1;
    const bend=snake?Math.min(60,len*.22):0,px=-dy/len*bend,py=dx/len*bend;
    const a=snake?[x+dx*.33+px,y+dy*.33+py]:[(x+tx)/2,Math.min(y,ty)-40];
    const b=snake?[x+dx*.66-px,y+dy*.66-py]:a;
    return Array.from({length:21},(_,index)=>{
      const t=index/20,u=1-t;
      return [u*u*u*x+3*u*u*t*a[0]+3*u*t*t*b[0]+t*t*t*tx,u*u*u*y+3*u*u*t*a[1]+3*u*t*t*b[1]+t*t*t*ty];
    });
  }
  function plan(before,after) {
    if(!before || !after || before.type!==after.type || before.players.length!==after.players.length)return [];
    if(after.type==='snakes' && after.action?.snakeShift)return shiftedPlan(before,after);
    const action=after.action;if(!action || !['ludo-move','snakes-move'].includes(action.type))return [];
    const motions=[];let primaryEnd=0;
    for(const player of after.players){
      const old=before.players.find(item=>item.id===player.id);if(!old)continue;
      player.tokens.forEach((to,token)=>{
        const from=old.tokens[token],start=point(before,player.id,token),end=point(after,player.id,token);
        if(from===to && Math.hypot(end[0]-start[0],end[1]-start[1])<.1)return;
        const primary=action.player===player.id && (action.token||0)===token;
        const segments=[];
        if(primary && from!==to){
          const landing=after.type==='snakes'?action.landing:to;
          const squares=from<0?[0]:Array.from({length:Math.max(0,landing-from)},(_,index)=>from+index+1);
          squares.forEach((square,index)=>segments.push({to:center(after.type,player.color,square,token),duration:from<0?320:145,hop:from<0?12:5,sound:'step',step:index}));
          if(after.type==='snakes' && action.jump){
            const landingPoint=center(after.type,player.color,landing,token);
            if(action.jump==='ladder')segments.push({to:end,duration:700,hop:0,highlight:'ladder'});
            else {const points=curve(landingPoint,end,true);points.slice(1).forEach((at,index)=>segments.push({to:at,duration:840/(points.length-1),hop:0,highlight:index===0?'snake':null,linear:true}));}
          }
          if(segments.length)segments[segments.length-1].to=end;
        }else if(from!==to && to===-1){
          curve(start,end).slice(1).forEach(at=>segments.push({to:at,duration:23,hop:0,linear:true}));
        }else segments.push({to:end,duration:200,hop:0});
        if(!segments.length)segments.push({to:end,duration:240,hop:4,sound:'step'});
        const motion={player:player.id,token,start,end,startWidth:G.layout(before,player.id,token).width,endWidth:G.layout(after,player.id,token).width,segments,delay:0,capture:to===-1 && from!==to,primary};
        const duration=segments.reduce((total,segment)=>total+segment.duration,0);motion.duration=duration;
        if(primary)primaryEnd=duration;motions.push(motion);
      });
    }
    motions.forEach(motion=>{if(motion.capture)motion.delay=primaryEnd;});
    return motions;
  }
  function shiftedPlan(before,after){
    const shift=after.action.snakeShift,intermediate=JSON.parse(JSON.stringify(after));delete intermediate.action.snakeShift;
    intermediate.snakes=before.snakes;
    for(const hit of shift.players)intermediate.players.find(player=>player.id===hit.player).tokens[0]=hit.from;
    const motions=plan(before,intermediate),primaryEnd=motions.find(motion=>motion.primary)?.duration||0,shiftEnd=primaryEnd+650;
    for(const player of after.players){
      const hit=shift.players.find(item=>item.player===player.id),start=point(intermediate,player.id,0),end=point(after,player.id,0);
      if(!hit && Math.hypot(end[0]-start[0],end[1]-start[1])<.1)continue;
      let motion=motions.find(item=>item.player===player.id && item.token===0);
      if(!motion){motion={player:player.id,token:0,start:point(before,player.id,0),end,startWidth:G.layout(before,player.id,0).width,endWidth:G.layout(after,player.id,0).width,segments:[],duration:0,delay:0,primary:after.action.player===player.id};motions.push(motion);}
      const wait=shiftEnd-motion.duration;if(wait>0)motion.segments.push({to:start,duration:wait,hop:0});
      if(hit){const points=curve(start,end,true);points.slice(1).forEach((at,index)=>motion.segments.push({to:at,duration:840/(points.length-1),hop:0,linear:true,sound:index===0 && shift.players[0].player===player.id?'snake':null}));}
      else motion.segments.push({to:end,duration:200,hop:0});
      motion.end=end;motion.endWidth=G.layout(after,player.id,0).width;motion.duration=motion.segments.reduce((total,segment)=>total+segment.duration,0);
    }
    motions.push({kind:'snake-shift',snakeId:shift.id,index:shift.index,from:shift.from,to:shift.to,tail:shift.tail,startTail:center('snakes','red',shift.fromTail),endTail:center('snakes','red',shift.tail),start:center('snakes','red',shift.from),end:center('snakes','red',shift.to),segments:[{to:center('snakes','red',shift.to),duration:650,hop:0,sound:shift.players.length?null:'head-shift'}],duration:650,delay:primaryEnd});
    return motions;
  }
  function animate(svg,motions,options={}) {
    let frame, resolve, cancelled=false;const begun=root.performance.now(), lead=options.delay||0;
    const targets=motions.map(motion=>({...motion,node:motion.kind==='snake-shift'?[...svg.querySelectorAll('.board-snake')].find(node=>node.dataset.snakeId===motion.snakeId):[...svg.querySelectorAll('.board-token')].find(node=>node.dataset.player===motion.player && Number(node.dataset.token)===motion.token),sounded:new Set()}));
    const place=(node,at,width)=>{
      node?.setAttribute('transform',`translate(${at[0]},${at[1]})`);
      if(node && width){const use=node.querySelector('use'),label=node.querySelector('text'),height=width*1.3;use?.setAttribute('width',width);use?.setAttribute('height',height);use?.setAttribute('x',-width/2);use?.setAttribute('y',-height/2);label?.setAttribute('y',height*.29);label?.setAttribute('font-size',Math.max(4,width*.27));}
    };
    function position(motion,at,width){
      if(motion.kind!=='snake-shift'){place(motion.node,at,width);return;}
      const art=options.art||root.BoardArt;if(!motion.node || !art)return;
      if(motion.lastHead && motion.lastHead[0]===at[0] && motion.lastHead[1]===at[1])return;motion.lastHead=at;
      const length=Math.hypot(motion.end[0]-motion.start[0],motion.end[1]-motion.start[1])||1,t=Math.min(1,Math.hypot(at[0]-motion.start[0],at[1]-motion.start[1])/length),tail=[motion.startTail[0]+(motion.endTail[0]-motion.startTail[0])*t,motion.startTail[1]+(motion.endTail[1]-motion.startTail[1])*t];
      const markup=art.snakeArt(motion.to,motion.tail,motion.index,svg.getAttribute('data-art-id'),at,motion.snakeId,tail);motion.node.innerHTML=markup.slice(markup.indexOf('>')+1,markup.lastIndexOf('</g>'));
    }
    const finish=()=>{targets.forEach(motion=>{position(motion,motion.end,motion.endWidth);motion.node?.classList.remove('moving','slithering');});resolve();};
    const finished=new Promise(done=>{resolve=done;});
    const duration=lead+Math.max(0,...motions.map(motion=>motion.delay+motion.duration));
    targets.forEach(motion=>{position(motion,motion.start,motion.startWidth);motion.node?.classList.add(motion.kind==='snake-shift'?'slithering':'moving');});
    function tick(now){
      if(cancelled)return;const elapsed=now-begun;
      for(const motion of targets){
        let time=elapsed-lead-motion.delay, from=motion.start;
        const width=motion.startWidth+(motion.endWidth-motion.startWidth)*Math.max(0,Math.min(1,time/(motion.duration||1)));
        if(time<0){position(motion,from,motion.startWidth);continue;}
        for(let index=0;index<motion.segments.length;index++){
          const segment=motion.segments[index];
          if(!motion.sounded.has(index)){motion.sounded.add(index);if(segment.sound)options.onSound?.(segment.sound,segment.step||0);}
          if(time<=segment.duration){const t=Math.min(1,time/segment.duration),ease=segment.linear?t:(1-Math.cos(t*Math.PI))/2;position(motion,[from[0]+(segment.to[0]-from[0])*ease,from[1]+(segment.to[1]-from[1])*ease-Math.sin(t*Math.PI)*(segment.hop||0)],width);break;}
          time-=segment.duration;from=segment.to;position(motion,from,width);
        }
      }
      if(elapsed>=duration){finish();return;}frame=root.requestAnimationFrame(tick);
    }
    if(options.reduced){finish();}else frame=root.requestAnimationFrame(tick);
    return {finished,duration,cancel(){cancelled=true;if(frame)root.cancelAnimationFrame(frame);finish();}};
  }
  return {center,point,curve,plan,animate};
});
