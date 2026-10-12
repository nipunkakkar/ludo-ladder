(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoardRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const COLORS = ['red', 'green', 'yellow', 'blue'];
  const PALETTE = { red: '#e64350', green: '#18a66b', yellow: '#f3bd36', blue: '#358be0' };
  const TRACK = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
  const SAFE = new Set([0,8,13,21,26,34,39,47]);
  const OFFSET = { red: 0, green: 13, yellow: 26, blue: 39 };
  const LADDER = { 3:22, 8:30, 20:41, 28:76, 50:67, 71:92, 80:99 };
  const SNAKE = { 17:7, 54:34, 62:19, 87:36, 93:73, 98:79 };
  const cleanName = name => String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || 'Player';
  const seats = count => count === 2 ? ['red', 'yellow'] : COLORS.slice(0, count);
  function create(type, players) {
    if (!['ludo', 'snakes'].includes(type) || players.length < 2 || players.length > 4) throw new Error('Choose a game and 2–4 players.');
    return { type, players: players.map(player => ({ id: player.id, name: cleanName(player.name), color: player.color, tokens: type === 'ludo' ? [-1,-1,-1,-1] : [0] })), turn: 0, pending: null, lastDie: null, sixes: 0, winner: null, action: null, actionId: 0, rollCount:0, snakes:type==='snakes'?Object.entries(SNAKE).map(([head,tail],index)=>({id:'snake-'+index,head:Number(head),tail})):null, log: ['Game on. Good luck, everyone!'] };
  }
  function current(game) { return game.players[game.turn]; }
  function addLog(game, text) { game.log.unshift(text); game.log = game.log.slice(0, 8); }
  function next(game) { game.turn = (game.turn + 1) % game.players.length; game.sixes = 0; }
  function legal(game) {
    if (game.type !== 'ludo' || !game.pending || game.winner) return [];
    return current(game).tokens.map((progress, index) => progress === -1 ? (game.pending.die === 6 ? index : -1) : progress < 56 && progress + game.pending.die <= 56 ? index : -1).filter(index => index >= 0);
  }
  function roll(game, id, die, randomIndex = length => Math.floor(Math.random()*length)) {
    if (game.winner || game.pending || current(game).id !== id) throw new Error('Wait for your turn.');
    if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error('Invalid dice roll.');
    const player = current(game);
    game.rollCount=(game.rollCount||0)+1;
    game.lastDie = { value: die, player: id, id: game.actionId + 1 };
    game.actionId += 1;
    game.action = { type: 'roll', player: id, die, id: game.actionId, note: `${player.name} rolled ${die}.` };
    if (game.type === 'snakes') {
      const from = player.tokens[0];
      const landing = from + die;
      if (landing > 100) {
        game.action.note = `${player.name} needs ${100 - from} to finish. Turn passes.`;
        if(game.rollCount%4===0)shiftSnake(game,randomIndex);addLog(game, game.action.note); next(game); return;
      }
      const snake=(game.snakes||[]).find(item=>item.head===landing),destination=LADDER[landing] || snake?.tail || landing;
      player.tokens[0] = destination;
      game.action = { ...game.action, type: 'snakes-move', from, landing, to: destination, jump: destination > landing ? 'ladder' : destination < landing ? 'snake' : null };
      game.action.note = destination > landing ? `${player.name} climbed ${landing} → ${destination}!` : destination < landing ? `${player.name} slid ${landing} → ${destination}. Ouch!` : `${player.name} moved to ${destination}.`;
      if (destination === 100) { game.winner = id; game.action.note = `${player.name} reached 100 and wins!`; }
      else {if(game.rollCount%4===0)shiftSnake(game,randomIndex);next(game);}
      addLog(game, game.action.note); return;
    }
    game.sixes = die === 6 ? game.sixes + 1 : 0;
    if (game.sixes === 3) {
      game.action.note = `${player.name}: three sixes! Turn passes.`;
      addLog(game, game.action.note); next(game); return;
    }
    game.pending = { die, player: id };
    if (!legal(game).length) {
      game.pending = null;
      game.action.note = `${player.name} rolled ${die}. No legal move.`;
      if (die !== 6) next(game);
    }
    addLog(game, game.action.note);
  }
  function shiftSnake(game,randomIndex){
    if(game.winner || !game.snakes?.length)return;
    const blocked=new Set([100,...Object.keys(LADDER).map(Number),...Object.values(LADDER),...game.snakes.map(item=>item.head),...game.snakes.map(item=>item.tail)]);
    const choices=game.snakes.map((snake,index)=>({snake,index,heads:Array.from({length:10},(_,offset)=>Math.floor((snake.head-1)/10)*10+offset+1).filter(square=>!blocked.has(square) && square>snake.tail)})).filter(item=>item.heads.length);
    if(!choices.length)return;
    const choice=choices[randomIndex(choices.length)],from=choice.snake.head,to=choice.heads[randomIndex(choice.heads.length)],players=[];
    choice.snake.head=to;
    for(const player of game.players)if(player.tokens[0]===to){player.tokens[0]=choice.snake.tail;players.push({player:player.id,from:to,to:choice.snake.tail,token:0});}
    game.action.snakeShift={id:choice.snake.id,index:choice.index,from,to,tail:choice.snake.tail,players};
    game.action.note+=` A snake moved ${from} → ${to}!${players.length?' '+players.map(item=>game.players.find(player=>player.id===item.player).name).join(' and ')+' slid to '+choice.snake.tail+'.':''}`;
  }
  function move(game, id, token) {
    if (game.type !== 'ludo' || current(game).id !== id || !game.pending || !legal(game).includes(token)) throw new Error('Choose one of your glowing tokens.');
    const player = current(game), die = game.pending.die;
    const from = player.tokens[token];
    const to = from === -1 ? 0 : from + die;
    player.tokens[token] = to;
    const captured = [];
    if (to <= 50) {
      const square = (OFFSET[player.color] + to) % 52;
      if (!SAFE.has(square)) {
        for (const opponent of game.players) {
          if (opponent.id === id) continue;
          opponent.tokens.forEach((progress, index) => {
            if (progress >= 0 && progress <= 50 && (OFFSET[opponent.color] + progress) % 52 === square) {
              opponent.tokens[index] = -1; captured.push({ player: opponent.id, token: index });
            }
          });
        }
      }
    }
    game.pending = null;
    game.actionId += 1;
    game.action = { type: 'ludo-move', player: id, token, from, to, die, captured, id: game.actionId, note: `${player.name} moved token ${token + 1}.` };
    if (captured.length) game.action.note = `${player.name} captured ${captured.length} token${captured.length === 1 ? '' : 's'}! Bonus roll.`;
    else if (to === 56) game.action.note = `${player.name} brought a token home! Bonus roll.`;
    if (player.tokens.every(progress => progress === 56)) { game.winner = id; game.action.note = `${player.name} brought all four home and wins!`; }
    else if (die !== 6 && !captured.length && to !== 56) next(game);
    addLog(game, game.action.note);
  }
  function coordinate(color, progress, token = 0) {
    if (progress === -1) {
      const bases = { red: [0,0], green: [0,9], yellow: [9,9], blue: [9,0] };
      const [row, col] = bases[color];
      return [row + 1.5 + Math.floor(token / 2) * 2, col + 1.5 + (token % 2) * 2];
    }
    if (progress <= 50) return TRACK[(OFFSET[color] + progress) % 52];
    const step = progress - 51;
    if (color === 'red') return [7, 1 + step];
    if (color === 'green') return [1 + step, 7];
    if (color === 'yellow') return [7, 13 - step];
    return [13 - step, 7];
  }
  function autoMove(game, id) {
    const moves = legal(game);
    if (moves.length !== 1 || current(game).id !== id) return false;
    move(game, id, moves[0]);
    game.action.automatic = true;
    game.action.note += ' (automatic move)';
    game.log[0] = game.action.note;
    return true;
  }
  function snakeCoordinate(square) {
    if (square <= 0) return [9.75, -0.08];
    const n = square - 1, band = Math.floor(n / 10), col = n % 10;
    return [9 - band, band % 2 ? 9 - col : col];
  }
  return { COLORS, PALETTE, TRACK, SAFE, OFFSET, LADDER, SNAKE, cleanName, seats, create, current, legal, roll, move, autoMove, coordinate, snakeCoordinate };
});
