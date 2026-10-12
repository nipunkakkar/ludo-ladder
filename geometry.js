(function (root, factory) {
  const rules = typeof module === 'object' && module.exports ? require('./rules.js') : root.BoardRules;
  const api = factory(rules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoardGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (R) {
  'use strict';
  function center(type, color, progress, token = 0) {
    if (type === 'snakes' && progress === 0) return [130,646];
    const [row,col] = type === 'ludo' ? R.coordinate(color,progress,token) : R.snakeCoordinate(progress);
    return type === 'ludo' ? [15+(col+.5)*42,15+(row+.5)*42] : [24+(col+.5)*61.2,24+(row+.5)*61.2];
  }
  function layout(game, id, token) {
    const player=game.players.find(item=>item.id===id);
    if(!player)return null;
    const progress=player.tokens[token],at=center(game.type,player.color,progress,token),group=[];
    for(const item of game.players)item.tokens.forEach((value,index)=>{
      const xy=center(game.type,item.color,value,index);
      if(Math.abs(xy[0]-at[0])<.01 && Math.abs(xy[1]-at[1])<.01)group.push({id:item.id,token:index});
    });
    const index=group.findIndex(item=>item.id===id && item.token===token);
    let [x,y]=at,width=game.type==='ludo'?progress===-1?28:26:30;
    if(game.type==='snakes' && progress===0){x+=(index-(group.length-1)/2)*18;width=14;}
    else if(group.length>1){
      const cell=game.type==='ludo'?42:61.2,columns=Math.ceil(Math.sqrt(group.length)),rows=Math.ceil(group.length/columns),pitch=(cell-6)/Math.max(columns,rows);
      const row=Math.floor(index/columns),inRow=Math.min(columns,group.length-row*columns);
      x+=(index%columns-(inRow-1)/2)*pitch;y+=(row-(rows-1)/2)*pitch;
      width=Math.min(width,(pitch-3)/1.3);
    }
    const height=width*1.3;
    return {x,y,width,height,count:group.length,center:at,halo:group.length===1?19:Math.max(width*.65,4)};
  }
  function point(game,id,token){const value=layout(game,id,token);return value?[value.x,value.y]:null;}
  function snakeCurve(from,to,steps=40){
    const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy)||1,bend=Math.min(36,length*.11),nx=-dy/length,ny=dx/length;
    return Array.from({length:steps+1},(_,index)=>{const t=index/steps,wave=Math.sin(t*Math.PI*4)*Math.sin(t*Math.PI)*bend;return[from[0]+dx*t+nx*wave,from[1]+dy*t+ny*wave];});
  }
  return {center,layout,point,snakeCurve};
});
