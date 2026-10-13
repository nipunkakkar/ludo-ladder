(function () {
  'use strict';
  const R = window.BoardRules;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const xy = (row, col) => [15 + (col + 0.5) * 42, 15 + (row + 0.5) * 42];
  function defs(id) {
    return `<defs><linearGradient id="${id}-wood" x2=".9" y2="1"><stop stop-color="#f3dba2"/><stop offset=".3" stop-color="#d7aa69"/><stop offset=".7" stop-color="#ead1a0"/><stop offset="1" stop-color="#b98850"/></linearGradient><linearGradient id="${id}-tile" x2="1" y2="1"><stop stop-color="#fffdf6"/><stop offset="1" stop-color="#f3eee3"/></linearGradient><filter id="${id}-shadow" x="-50%" y="-35%" width="200%" height="180%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#332618" flood-opacity=".3"/></filter>${R.COLORS.map(color => `<radialGradient id="${id}-${color}" cx=".28" cy=".2" r=".9"><stop stop-color="#ffffff" stop-opacity=".8"/><stop offset=".22" stop-color="${R.PALETTE[color]}"/><stop offset="1" stop-color="${{red:'#a51f39',green:'#047545',yellow:'#cb7e10',blue:'#195faa'}[color]}"/></radialGradient><linearGradient id="${id}-base-${color}" x2="1" y2="1"><stop stop-color="${R.PALETTE[color]}"/><stop offset="1" stop-color="${{red:'#bd3048',green:'#098856',yellow:'#dfa626',blue:'#2673bc'}[color]}"/></linearGradient><symbol id="${id}-pawn-${color}" viewBox="0 0 40 52"><ellipse cx="20" cy="46" rx="17" ry="4" fill="#392719" opacity=".17"/><path d="M13 20q1 10-6 21-5 8 13 9 18-1 13-9-7-11-6-21z" fill="url(#${id}-${color})" stroke="${{red:'#9c2540',green:'#006c43',yellow:'#b77920',blue:'#205b99'}[color]}" stroke-width="1.2"/><path d="M11 39q-2 6 9 6t10-6" fill="none" stroke="#fff" opacity=".35" stroke-width="2"/><circle cx="20" cy="13" r="11" fill="url(#${id}-${color})" stroke="${R.PALETTE[color]}" stroke-width="1"/><ellipse cx="16" cy="8" rx="4" ry="3" fill="#fff" opacity=".58"/></symbol>`).join('')}</defs>`;
  }
  function frame(id) { return `<rect x="1.5" y="1.5" width="657" height="657" rx="24" fill="url(#${id}-wood)" stroke="#ac8351" stroke-width="2"/><rect x="8" y="8" width="644" height="644" rx="18" fill="#ffe4b8" stroke="#fff4d8" stroke-opacity=".8"/><rect x="14" y="14" width="632" height="632" rx="12" fill="#fff9ed" stroke="#997a51" stroke-width="2"/>`; }
  function pawn(color, id = 'mini') { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" aria-hidden="true">${defs(id)}<use href="#${id}-pawn-${color}" width="40" height="52"/></svg>`; }
  function tokenMarkup(game, me, id, local, animate = null) {
    if (!game) return '';
    const movable = R.legal(game), active = R.current(game);
    let out = '';
    for (const player of game.players) player.tokens.forEach((progress,token)=>{
      const {x,y,width,height,halo}=window.BoardGeometry.layout(game,player.id,token);
      const canMove=game.type==='ludo' && player.id===active.id && (local || me===active.id) && movable.includes(token);
      const label=`${player.name}, token ${token+1}${canMove?', tap to move':''}`,animated=animate && animate.player===player.id && animate.token===token;
      out+=`<g class="board-token${canMove?' movable':''}${animated?' token-arrive':''}" data-player="${escape(player.id)}" data-token="${token}" ${canMove?'role="button" tabindex="0"':'role="img"'} aria-label="${escape(label)}" transform="translate(${x},${y})">${canMove?`<circle class="token-halo" r="${halo}" fill="#fff" fill-opacity=".38" stroke="#fff5a6" stroke-width="2"/>`:''}<use href="#${id}-pawn-${player.color}" x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" filter="url(#${id}-shadow)"/>${game.type==='ludo'?`<text x="0" y="${height*.29}" text-anchor="middle" fill="#fff" font-size="${Math.max(4,width*.27)}" font-weight="800" pointer-events="none">${token+1}</text>`:''}</g>`;
    });
    return out;
  }
  function ludo(game, me = '', id = 'ludo', local = false, animate = null) {
    const activeColors = game ? game.players.map(player => player.color) : R.COLORS;
    let out = defs(id) + frame(id);
    const base = { red:[0,0], green:[0,9], yellow:[9,9], blue:[9,0] };
    for (const color of R.COLORS) {
      const [r,c] = base[color], x = 15+c*42, y = 15+r*42;
      const opacity = activeColors.includes(color) ? 1 : 0.3;
      out += `<g opacity="${opacity}"><rect x="${x}" y="${y}" width="252" height="252" fill="url(#${id}-base-${color})"/><path d="M${x+10},${y+14}h230" stroke="#fff" stroke-opacity=".2" stroke-width="3"/><rect x="${x+39}" y="${y+39}" width="174" height="174" rx="18" fill="#fffaf0" stroke="#fff" stroke-width="3"/>`;
      for (let token = 0; token < 4; token++) { const [px,py] = xy(...R.coordinate(color,-1,token)); out += `<circle cx="${px}" cy="${py}" r="20" fill="url(#${id}-${color})" opacity=".8"/><circle cx="${px}" cy="${py}" r="15" fill="none" stroke="#fff" stroke-opacity=".2"/>`; }
      out += '</g>';
    }
    for (let row=0; row<15; row++) for (let col=0; col<15; col++) {
      if (!(row>=6 && row<=8 || col>=6 && col<=8) || (row>=6 && row<=8 && col>=6 && col<=8)) continue;
      const lane = row===7 && col>0 && col<6 ? 'red' : col===7 && row>0 && row<6 ? 'green' : row===7 && col>8 && col<14 ? 'yellow' : col===7 && row>8 && row<14 ? 'blue' : null;
      const entry = R.COLORS.find(color => { const [r,c]=R.TRACK[R.OFFSET[color]]; return r===row && c===col; });
      const color = lane || entry;
      out += `<rect x="${15+col*42}" y="${15+row*42}" width="42" height="42" fill="${color ? R.PALETTE[color] : `url(#${id}-tile)`}" fill-opacity="${color && !activeColors.includes(color) ? .35 : 1}" stroke="#b8b2a0" stroke-width=".8"/>`;
    }
    for (const square of R.SAFE) {
      const [x,y] = xy(...R.TRACK[square]);
      out += `<path d="M0-12 3.5-4 12-3 6 3 8 12 0 7-8 12-6 3-12-3-3.5-4z" transform="translate(${x},${y})" fill="${square%13===0 ? '#fff6d9' : '#b4b29d'}" opacity=".85"/>`;
    }
    out += `<path d="M267 267 330 330 267 393z" fill="${R.PALETTE.red}"/><path d="M267 267 393 267 330 330z" fill="${R.PALETTE.green}"/><path d="M393 267 393 393 330 330z" fill="${R.PALETTE.yellow}"/><path d="M267 393 330 330 393 393z" fill="${R.PALETTE.blue}"/><rect x="267" y="267" width="126" height="126" fill="none" stroke="#9b967f" stroke-width="1"/><circle cx="330" cy="330" r="10" fill="#fff9dc" opacity=".65"/>`;
    out += tokenMarkup(game,me,id,local,animate);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 660" class="game-board ludo-board" role="group" aria-label="Ludo board">${out}</svg>`;
  }
  function snakePoint(square) { return window.BoardGeometry.center('snakes','red',square); }
  const snakeColours=[['#78d5ad','#23977c','#176b5c'],['#ffc27b','#ed8744','#975124'],['#88c5f3','#4596d5','#245a8c'],['#d3a7ed','#a675cf','#68438d'],['#ffa6b6','#e96f94','#9a3f62'],['#bce680','#79bc54','#4d7b31']];
  function snakeDefs(id){
    return `<defs><linearGradient id="${id}-ladder-rail"><stop stop-color="#aa6e31"/><stop offset=".24" stop-color="#edbf76"/><stop offset=".52" stop-color="#d39851"/><stop offset="1" stop-color="#875128"/></linearGradient><linearGradient id="${id}-ladder-rung" x2="0" y2="1"><stop stop-color="#ffe0a1"/><stop offset=".3" stop-color="#edbd72"/><stop offset="1" stop-color="#a3662e"/></linearGradient><linearGradient id="${id}-brass" x2="1" y2="1"><stop stop-color="#ffe9ac"/><stop offset=".5" stop-color="#d6ad58"/><stop offset="1" stop-color="#b08037"/></linearGradient><linearGradient id="${id}-finish" x2="1" y2="1"><stop stop-color="#fff2b1"/><stop offset="1" stop-color="#f3d57d"/></linearGradient>${snakeColours.map((colours,index)=>`<linearGradient id="${id}-snake-${index}" x2="1" y2=".55"><stop stop-color="${colours[0]}"/><stop offset=".45" stop-color="${colours[1]}"/><stop offset="1" stop-color="${colours[2]}"/></linearGradient><radialGradient id="${id}-head-${index}" cx=".3" cy=".25" r=".9"><stop stop-color="${colours[0]}"/><stop offset=".5" stop-color="${colours[1]}"/><stop offset="1" stop-color="${colours[2]}"/></radialGradient>`).join('')}</defs>`;
  }
  function ladderArt(from,to,id){
    const [x,y]=snakePoint(from),[tx,ty]=snakePoint(to),length=Math.hypot(tx-x,ty-y),angle=Math.atan2(ty-y,tx-x)*180/Math.PI+90,count=Math.max(2,Math.floor(length/24));
    let art=`<g class="board-ladder" data-from="${from}" data-to="${to}" transform="translate(${x} ${y}) rotate(${angle})"><rect x="-15" y="${-length-5}" width="8" height="${length+14}" rx="4" fill="#654224" opacity=".16" transform="translate(3 4)"/><rect x="11" y="${-length-5}" width="8" height="${length+14}" rx="4" fill="#654224" opacity=".16" transform="translate(3 4)"/>`;
    for(let step=1;step<=count;step++){
      const at=-length*step/(count+1);
      art+=`<rect x="-14" y="${at-3}" width="28" height="8" rx="2.5" fill="url(#${id}-ladder-rung)" stroke="#a87336" stroke-width=".9"/><path d="M-11 ${at-1}h22" stroke="#fff0c9" stroke-width="1.3" opacity=".8" stroke-linecap="round"/>`;
    }
    for(const side of [-13,13]){
      art+=`<rect x="${side-4}" y="${-length-7}" width="8" height="${length+14}" rx="4" fill="url(#${id}-ladder-rail)" stroke="#92602f" stroke-width="1"/><path d="M${side-1.8} -2v${-length+4}" stroke="#fff1cb" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/>`;
      for(const cap of [-length-4,-6])art+=`<rect x="${side-4.5}" y="${cap}" width="9" height="10" rx="2.5" fill="url(#${id}-brass)" stroke="#ae823f" stroke-width=".7"/><circle cx="${side}" cy="${cap+5}" r="1.4" fill="#9a6c36"/><path d="M${side-1} ${cap+5}h2" stroke="#ffecc0" stroke-width=".7"/>`;
    }
    return art+'</g>';
  }
  function snakeArt(from,to,index,id,headPoint=null,snakeId='snake-'+index,tailPoint=null,sway=0){
    const points=window.BoardGeometry.snakeCurve(headPoint||snakePoint(from),tailPoint||snakePoint(to)).map(([x,y],index,all)=>[x+Math.sin(index/(all.length-1)*Math.PI*3)*Math.sin(index/(all.length-1)*Math.PI)*sway,y]),colour=snakeColours[index%snakeColours.length],left=[],right=[],shine=[];
    for(let i=0;i<points.length;i++){
      const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],dx=next[0]-prev[0],dy=next[1]-prev[1],length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,t=i/(points.length-1),radius=1.3+8.5*Math.pow(1-t,.65);
      left.push([points[i][0]+nx*radius,points[i][1]+ny*radius]);right.push([points[i][0]-nx*radius,points[i][1]-ny*radius]);shine.push([points[i][0]-nx*radius*.35,points[i][1]-ny*radius*.35]);
    }
    const outline='M'+left.concat(right.reverse()).map(point=>point.join(',')).join('L')+'Z',shinePath='M'+shine.map(point=>point.join(',')).join('L');
    let art=`<g class="board-snake" data-snake-id="${snakeId}" data-from="${from}" data-to="${to}"><path d="${outline}" fill="#284839" opacity=".17" transform="translate(2 3)"/><path d="${outline}" fill="url(#${id}-snake-${index})" stroke="${colour[2]}" stroke-width="1.6" stroke-linejoin="round"/><path d="${shinePath}" fill="none" stroke="${colour[0]}" stroke-width="3" stroke-opacity=".8" stroke-linecap="round"/>`;
    for(let i=3;i<points.length-3;i+=3){const [x,y]=points[i],scale=2.2*(1-i/points.length)+.3;art+=`<ellipse cx="${x}" cy="${y}" rx="${scale}" ry="${scale*.65}" fill="#fff4c1" opacity=".45"/>`;}
    const [x,y]=points[0],angle=Math.atan2(y-points[1][1],x-points[1][0])*180/Math.PI;
    art+=`<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M-12-10C-2-18 13-16 20-5Q25 0 20 5C13 16-2 18-12 10Q-18 0-12-10Z" fill="url(#${id}-head-${index})" stroke="${colour[2]}" stroke-width="1.5"/><path d="M21 0h9m0 0 4-3m-4 3 4 3" fill="none" stroke="#d94870" stroke-width="2" stroke-linecap="round"/><ellipse cx="-5" cy="-5" rx="5" ry="2.5" fill="${colour[0]}" opacity=".8"/><circle cx="6" cy="-8" r="4.6" fill="#fffbea" stroke="${colour[2]}" stroke-width=".8"/><circle cx="6" cy="8" r="4.6" fill="#fffbea" stroke="${colour[2]}" stroke-width=".8"/><ellipse cx="7.5" cy="-8" rx="1.8" ry="2.7" fill="#293c40"/><ellipse cx="7.5" cy="8" rx="1.8" ry="2.7" fill="#293c40"/><circle cx="8" cy="-9" r=".8" fill="#fff"/><circle cx="8" cy="7" r=".8" fill="#fff"/><circle cx="16" cy="-3" r="1" fill="${colour[2]}"/><circle cx="16" cy="3" r="1" fill="${colour[2]}"/><path d="M11 11q5-1 7-5" fill="none" stroke="${colour[2]}" stroke-width="1" stroke-linecap="round"/></g></g>`;
    return art;
  }
  function snakes(game, me='', id='snakes', local=false, animate=null) {
    let out=defs(id)+snakeDefs(id)+frame(id),numbers='';
    const tiles=['#fff5dd','#d6ebd3','#ffebcc','#cbe7dc'];
    for(let square=1;square<=100;square++){
      const [r,c]=R.snakeCoordinate(square),x=24+c*61.2,y=24+r*61.2;
      out+=`<rect data-square="${square}" x="${x}" y="${y}" width="61.2" height="61.2" fill="${square===100?`url(#${id}-finish)`:tiles[(r+c)%4]}" stroke="#fffdf0" stroke-width="1.6"/><path d="M${x+2} ${y+2}h57" stroke="#fff" stroke-opacity=".4" stroke-width="1"/>`;
      const width=square===100?31:25;
      numbers+=`<g class="square-number"><rect x="${x+4}" y="${y+4}" width="${width}" height="20" rx="5" fill="#fffdf4" fill-opacity=".83"/><text x="${x+4+width/2}" y="${y+19}" text-anchor="middle" font-size="15" font-weight="800" fill="${square===100?'#9a6d25':'#506754'}">${square}</text></g>`;
    }
    for(const [from,to]of Object.entries(R.LADDER))out+=ladderArt(Number(from),to,id);
    const snakes=game?.snakes||Object.entries(R.SNAKE).map(([head,tail],index)=>({id:'snake-'+index,head:Number(head),tail}));snakes.forEach((snake,index)=>{out+=snakeArt(snake.head,snake.tail,index,id,null,snake.id);});
    out+=numbers;
    const [cx,cy]=snakePoint(100);
    out+=`<path d="M${cx-12} ${cy+12}l-3-17 9 6 6-10 6 10 9-6-3 17z" fill="url(#${id}-brass)" stroke="#ad8039" stroke-width="1.2" stroke-linejoin="round"/><path d="M${cx-10} ${cy+15}h20" stroke="#e8b85d" stroke-width="3" stroke-linecap="round"/><rect x="30" y="639" width="66" height="17" rx="8.5" fill="#e1eed9" stroke="#a7bf96" stroke-width=".7"/><text x="63" y="651" text-anchor="middle" font-size="9" fill="#628552" font-weight="800" letter-spacing="1">START</text>`;
    out+=tokenMarkup(game,me,id,local,animate);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 660" data-art-id="${id}" class="game-board snakes-board" role="group" aria-label="Snakes and Ladders board">${out}</svg>`;
  }
  function preview(type,id) {
    const players=R.COLORS.map((color,index)=>({id:String(index),name:'Player',color}));
    const game=R.create(type,players);
    if(type==='ludo') { game.players[0].tokens=[-1,6,-1,-1];game.players[1].tokens=[-1,12,-1,-1];game.players[2].tokens=[-1,3,-1,-1];game.players[3].tokens=[-1,8,-1,-1]; }
    else game.players.forEach((player,index)=>player.tokens=[([4,23,46,69])[index]]);
    return type==='ludo'?ludo(game,'',id):snakes(game,'',id);
  }
  window.BoardArt={ludo,snakes,preview,pawn,escape,snakeArt};
})();
