(function () {
  'use strict';
  const R = window.BoardRules;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const xy = (row, col) => [15 + (col + 0.5) * 42, 15 + (row + 0.5) * 42];
  function defs(id) {
    return `<defs><linearGradient id="${id}-wood" x2=".9" y2="1"><stop stop-color="#f3dba2"/><stop offset=".3" stop-color="#d7aa69"/><stop offset=".7" stop-color="#ead1a0"/><stop offset="1" stop-color="#b98850"/></linearGradient><linearGradient id="${id}-tile" x2="1" y2="1"><stop stop-color="#fffdf6"/><stop offset="1" stop-color="#f3eee3"/></linearGradient><filter id="${id}-shadow" x="-50%" y="-35%" width="200%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#332618" flood-opacity=".3"/></filter>${R.COLORS.map(color => `<radialGradient id="${id}-${color}" cx=".28" cy=".2" r=".9"><stop stop-color="#ffffff" stop-opacity=".8"/><stop offset=".22" stop-color="${R.PALETTE[color]}"/><stop offset="1" stop-color="${{red:'#a51f39',green:'#047545',yellow:'#cb7e10',blue:'#195faa'}[color]}"/></radialGradient><linearGradient id="${id}-base-${color}" x2="1" y2="1"><stop stop-color="${R.PALETTE[color]}"/><stop offset="1" stop-color="${{red:'#bd3048',green:'#098856',yellow:'#dfa626',blue:'#2673bc'}[color]}"/></linearGradient><symbol id="${id}-pawn-${color}" viewBox="0 0 40 52"><ellipse cx="20" cy="46" rx="17" ry="4" fill="#392719" opacity=".17"/><path d="M13 20q1 10-6 21-5 8 13 9 18-1 13-9-7-11-6-21z" fill="url(#${id}-${color})" stroke="${{red:'#9c2540',green:'#006c43',yellow:'#b77920',blue:'#205b99'}[color]}" stroke-width="1.2"/><path d="M11 39q-2 6 9 6t10-6" fill="none" stroke="#fff" opacity=".35" stroke-width="2"/><circle cx="20" cy="13" r="11" fill="url(#${id}-${color})" stroke="${R.PALETTE[color]}" stroke-width="1"/><ellipse cx="16" cy="8" rx="4" ry="3" fill="#fff" opacity=".58"/></symbol>`).join('')}</defs>`;
  }
  function frame(id) { return `<rect x="1.5" y="1.5" width="657" height="657" rx="24" fill="url(#${id}-wood)" stroke="#ac8351" stroke-width="2"/><rect x="8" y="8" width="644" height="644" rx="18" fill="#ffe4b8" stroke="#fff4d8" stroke-opacity=".8"/><rect x="14" y="14" width="632" height="632" rx="12" fill="#fff9ed" stroke="#997a51" stroke-width="2"/>`; }
  function pawn(color, id = 'mini') { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" aria-hidden="true">${defs(id)}<use href="#${id}-pawn-${color}" width="40" height="52"/></svg>`; }
  function tokenMarkup(game, me, id, local, animate = null) {
    if (!game) return '';
    const movable = R.legal(game), active = R.current(game), groups = new Map();
    for (const player of game.players) player.tokens.forEach((progress, token) => {
      const coord = game.type === 'ludo' ? R.coordinate(player.color, progress, token) : R.snakeCoordinate(progress);
      const [x,y] = game.type === 'ludo' ? xy(...coord) : [24 + (coord[1] + 0.5) * 61.2, 24 + (coord[0] + 0.5) * 61.2];
      const key = `${x.toFixed(1)},${y.toFixed(1)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ player, progress, token, x, y });
    });
    let out = '';
    for (const group of groups.values()) group.forEach((item, index) => {
      let { x,y } = item;
      if (group.length > 1) { x += (index % 2 ? 1 : -1) * 9; y += (Math.floor(index / 2) - 0.5) * 12; }
      const canMove = game.type === 'ludo' && item.player.id === active.id && (local || me === active.id) && movable.includes(item.token);
      const size = group.length > 1 ? 28 : 34;
      const label = `${item.player.name}, token ${item.token + 1}${canMove ? ', tap to move' : ''}`;
      const animated = animate && animate.player === item.player.id && animate.token === item.token;
      out += `<g class="board-token${canMove ? ' movable' : ''}${animated ? ' token-arrive' : ''}" data-player="${escape(item.player.id)}" data-token="${item.token}" ${canMove ? 'role="button" tabindex="0"' : 'role="img"'} aria-label="${escape(label)}" transform="translate(${x},${y})">${canMove ? '<circle class="token-halo" cy="-6" r="24" fill="#fff" fill-opacity=".38" stroke="#fff5a6" stroke-width="3"/>' : ''}<use href="#${id}-pawn-${item.player.color}" x="${-size/2}" y="${-size*1.06}" width="${size}" height="${size*1.3}" filter="url(#${id}-shadow)"/>${game.type === 'ludo' ? `<text x="0" y="-3" text-anchor="middle" fill="#fff" font-size="9" font-weight="800" pointer-events="none">${item.token+1}</text>` : ''}</g>`;
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
  function snakePoint(square) { const [r,c]=R.snakeCoordinate(square); return [24+(c+.5)*61.2,24+(r+.5)*61.2]; }
  function snakes(game, me='', id='snakes', local=false, animate=null) {
    let out = defs(id)+frame(id);
    const tiles=['#f3eed5','#dfebd6','#f8edcf','#dce8dc'];
    for(let square=1;square<=100;square++) {
      const [r,c]=R.snakeCoordinate(square), x=24+c*61.2, y=24+r*61.2;
      out += `<rect x="${x}" y="${y}" width="61.2" height="61.2" fill="${tiles[(r+c)%4]}" stroke="#fff9e9" stroke-width="1"/><text x="${x+7}" y="${y+16}" font-size="13" font-weight="650" fill="#6b7d68">${square}</text>`;
    }
    for (const [from,to] of Object.entries(R.LADDER)) {
      const [x1,y1]=snakePoint(Number(from)),[x2,y2]=snakePoint(to),dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),px=-dy/len*9,py=dx/len*9;
      out += `<g stroke-linecap="round"><path d="M${x1-px},${y1-py}L${x2-px},${y2-py}M${x1+px},${y1+py}L${x2+px},${y2+py}" stroke="#775335" stroke-width="8" opacity=".2" transform="translate(3 3)"/>`;
      for(let rung=0;rung<=Math.floor(len/23);rung++) {
        const t=rung/Math.max(1,Math.floor(len/23)), x=x1+dx*t,y=y1+dy*t;
        out+=`<path d="M${x-px},${y-py}L${x+px},${y+py}" stroke="#a27a47" stroke-width="5"/><path d="M${x-px},${y-py-1}L${x+px},${y+py-1}" stroke="#efd397" stroke-width="2"/>`;
      }
      out+=`<path d="M${x1-px},${y1-py}L${x2-px},${y2-py}M${x1+px},${y1+py}L${x2+px},${y2+py}" stroke="#9a6d3e" stroke-width="6"/><path d="M${x1-px-1},${y1-py}L${x2-px-1},${y2-py}M${x1+px-1},${y1+py}L${x2+px-1},${y2+py}" stroke="#ecc789" stroke-width="2"/></g>`;
    }
    let index=0;
    for (const [from,to] of Object.entries(R.SNAKE)) {
      const [x,y]=snakePoint(Number(from)),[tx,ty]=snakePoint(to),dx=tx-x,dy=ty-y,len=Math.hypot(dx,dy),bend=Math.min(60,len*.22),px=-dy/len*bend,py=dx/len*bend;
      const a=[x+dx*.33+px,y+dy*.33+py], b=[x+dx*.66-px,y+dy*.66-py];
      const path=`M${x} ${y}C${a[0]} ${a[1]} ${b[0]} ${b[1]} ${tx} ${ty}`;
      const colors=[['#72a453','#447744'],['#dc8571','#ae5a53'],['#8696c0','#596d9d'],['#a997b8','#7b6995']][index++%4];
      out+=`<path d="${path}" fill="none" stroke="#514232" stroke-opacity=".13" stroke-width="20" stroke-linecap="round" transform="translate(2 3)"/><path d="${path}" fill="none" stroke="${colors[1]}" stroke-width="18" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${colors[0]}" stroke-width="13" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#fff2b7" stroke-opacity=".5" stroke-width="3" stroke-dasharray="3 13" stroke-linecap="round"/>`;
      const angle=Math.atan2(y-a[1],x-a[0])*180/Math.PI;
      out+=`<g transform="translate(${x} ${y}) rotate(${angle})"><ellipse rx="16" ry="12" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="2"/><circle cx="6" cy="-6" r="4" fill="#fff7d8"/><circle cx="6" cy="6" r="4" fill="#fff7d8"/><circle cx="8" cy="-6" r="2" fill="#344233"/><circle cx="8" cy="6" r="2" fill="#344233"/><path d="M17 0h9m0 0 4-4m-4 4 4 4" fill="none" stroke="#ba6152" stroke-width="2"/></g>`;
    }
    out+='<text x="40" y="654" font-size="9" fill="#796044" font-weight="750">START</text><path d="M55 37l6-9 6 9 7-6-3 18H43l-3-18z" fill="#d8b752" stroke="#a98b36" stroke-width="1"/>';
    out+=tokenMarkup(game,me,id,local,animate);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 660" class="game-board snakes-board" role="group" aria-label="Snakes and Ladders board">${out}</svg>`;
  }
  function preview(type,id) {
    const players=R.COLORS.map((color,index)=>({id:String(index),name:'Player',color}));
    const game=R.create(type,players);
    if(type==='ludo') { game.players[0].tokens=[-1,6,-1,-1];game.players[1].tokens=[-1,12,-1,-1];game.players[2].tokens=[-1,3,-1,-1];game.players[3].tokens=[-1,8,-1,-1]; }
    else game.players.forEach((player,index)=>player.tokens=[([4,23,46,69])[index]]);
    return type==='ludo'?ludo(game,'',id):snakes(game,'',id);
  }
  window.BoardArt={ludo,snakes,preview,pawn,escape};
})();
