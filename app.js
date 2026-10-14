(function () {
  'use strict';
  const R = window.BoardRules, Art = window.BoardArt, esc = Art.escape;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let selectedGame = 'ludo', count = 2, connection = null, state = null;
  let homeBusy = false, commandBusy = false, animationBusy = false, lastAction = 0;
  let toastTimer, diceTimer, reactionClearTimer, boardAnimation = null, visualEpoch = 0, displayedGame = null, boardKey = '';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reactionTimers=new Set();
  let speaker=null;
  const audio = new window.GameAudio.Engine({ onChange: syncAudio });
  try {
    const saved=localStorage.getItem('ll-audio-v2'),preferences=JSON.parse(saved || localStorage.getItem('ll-audio-v1') || '{}');
    if(!saved)preferences.track=window.GameAudio.DEFAULTS.track;
    audio.configure(preferences);
  } catch (_) { audio.configure({}); }
  speaker=new window.GameCommentary.Speaker({onChange:syncVoice});
  try{speaker.configure(localStorage.getItem('ll-commentary-voice')!=='false');}catch(_){speaker.configure(true);}
  let tableOpen = true;
  try { tableOpen = localStorage.getItem('ll-table-open') !== 'false'; } catch (_) { /* Use the open panel. */ }
  syncTable();
  $('#ludo-preview').innerHTML = Art.preview('ludo','home-ludo');
  $('#snakes-preview').innerHTML = Art.preview('snakes','home-snakes');
  try { $('#player-name').value = localStorage.getItem('rt-name') || ''; } catch (_) { /* Name storage is optional. */ }
  const invited = new URL(location.href).searchParams.get('room');
  if (invited && window.RoomNetwork.validCode(invited.toUpperCase())) $('#room-code').value = invited.toUpperCase();

  function toast(text, tone = '') {
    $('#toast').textContent = text; $('#toast').className = 'toast ' + tone; $('#toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
  }
  function playSound(kind, step = 0) { audio.effect(kind, step); }
  function syncAudio(settings) {
    const choices=$('#music-choices');
    if(!choices.children.length)choices.innerHTML=window.GameAudio.TRACKS.map(track=>`<button type="button" class="music-choice" data-track="${track.id}" aria-pressed="false"><span><b>${track.name}</b><small>${track.description}</small></span><em>${track.bpm}<small>BPM</small></em></button>`).join('');
    $$('[data-track]').forEach(button=>{const selected=button.dataset.track===settings.track;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    for (const channel of ['music','effects']) {
      const enabled=settings[channel+'On'], toggle=$('#'+channel+'-toggle');
      toggle.setAttribute('aria-pressed',String(enabled));toggle.classList.toggle('enabled',enabled);toggle.textContent=enabled?'On':'Off';
      $('#'+channel+'-volume').value=Math.round(settings[channel]*100);$('#'+channel+'-volume-label').value=Math.round(settings[channel]*100)+'%';
    }
    syncEffectPreviews();
    const track=window.GameAudio.TRACKS.find(item=>item.id===settings.track);
    $('#audio-note').textContent=settings.started ? settings.musicOn?`${track.name} is playing. Pick another mood anytime.`:'Music is off. Game effects have their own control.' : 'Music starts with your first click or tap.';
    $('#audio-btn').classList.toggle('muted',!settings.musicOn&&!settings.effectsOn);
    if(!settings.effectsOn || !settings.effects)speaker?.cancel();
    try { const {musicOn,effectsOn,music,effects,track}=settings;localStorage.setItem('ll-audio-v2',JSON.stringify({musicOn,effectsOn,music,effects,track})); } catch (_) { /* Preferences are optional. */ }
  }
  function syncVoice(status){
    $('#voice-btn').setAttribute('aria-pressed',String(status.enabled));$('#voice-btn').textContent=status.enabled?'♫ Voice on':'♫ Voice off';
    $('#voice-status').textContent=status.available?'Big moments only. Small talk takes a nap.':'Text reactions · voice available in browsers with an installed English voice.';
  }
  function syncEffectPreviews(){
    const type=state?.type||selectedGame,panel=$('#effect-previews');
    if(panel.dataset.game!==type){
      const samples=type==='snakes'?[['race-start','Start race ↗'],['ladder','Climb ↑'],['snake','Slide ↓'],['head-shift','Snake shift ↔'],['win','Win ★']]:[['release','New token ↗'],['capture','Capture ⚡'],['finish','Home ★']];
      panel.innerHTML='<span>'+(type==='snakes'?'SNAKES &amp; LADDERS HIGHLIGHTS':'LUDO CELEBRATIONS')+'</span>'+samples.map(([kind,label])=>`<button type="button" data-effect-preview="${kind}">${label}</button>`).join('');panel.dataset.game=type;
    }
    $$('[data-effect-preview]').forEach(button=>{button.disabled=!audio.settings.effectsOn || !audio.settings.effects;});
  }
  function clearReactions(){
    reactionTimers.forEach(timer=>clearTimeout(timer));reactionTimers.clear();clearTimeout(reactionClearTimer);
    $('#commentator').classList.remove('reacting');$('#commentator').dataset.mood='happy';$('#board-container').removeAttribute('data-highlight');$$('#board-container .highlighted').forEach(node=>node.classList.remove('highlighted'));
  }
  function hostIntro(type){
    $('#commentary-label').textContent='JUST THE BIG MOMENTS';$('#commentary-text').textContent=type==='snakes'?"I'm Milo. Trust the ladders. Never trust a smiling snake!":"I'm Milo. Dice, drama, and absolutely no boring small talk!";
  }
  function react(event){
    const host=$('#commentator');host.dataset.mood=event.mood;$('#commentary-text').textContent=event.text;
    $('#commentary-label').textContent='LAST BIG MOMENT';
    host.classList.remove('reacting');void host.offsetWidth;host.classList.add('reacting');
    const board=$('#board-container'),action=state.game.action;
    board.dataset.highlight=event.effect||event.kind;
    const token=['ludo-move','snakes-move'].includes(action.type)?$$('#board-container .board-token').find(node=>node.dataset.player===action.player && Number(node.dataset.token)===(action.token||0)):null;token?.classList.add('highlighted');
    clearTimeout(reactionClearTimer);reactionClearTimer=setTimeout(()=>{host.classList.remove('reacting');host.dataset.mood='happy';board.removeAttribute('data-highlight');token?.classList.remove('highlighted');},1200);
    if(event.effect)playSound(event.effect);
    if(!document.hidden && audio.settings.effectsOn)speaker.say(event.text,audio.settings.effects*.9,event.mood);
  }
  function queueReactions(before,game,motions,lead){
    const events=window.GameCommentary.events(before,game);
    window.GameCommentary.schedule(events,motions,{lead,reduced:reducedMotion}).forEach(event=>{
      const timer=setTimeout(()=>{reactionTimers.delete(timer);if(state?.game?.action?.id===game.action.id)react(event);},event.delay);
      reactionTimers.add(timer);
    });
  }
  function syncTable() {
    $('#table-panel').hidden=!tableOpen;$('#table-toggle').setAttribute('aria-expanded',String(tableOpen));$('#table-toggle b').textContent=tableOpen?'−':'+';
  }
  function resetVisuals() {
    clearReactions();speaker?.cancel();hostIntro(selectedGame);
    visualEpoch++;boardAnimation?.cancel();boardAnimation=null;clearTimeout(diceTimer);animationBusy=false;lastAction=0;displayedGame=null;boardKey='';$('#die').classList.remove('rolling');
  }
  function username() {
    const value = $('#player-name').value.trim();
    if (!value) { $('#player-name').focus(); throw new Error('Enter your name first, so your friends know who joined.'); }
    const name = R.cleanName(value);
    try { localStorage.setItem('rt-name',name); } catch (_) { /* Keep playing without storage. */ }
    return name;
  }
  function setHomeBusy(value, joining = false) {
    homeBusy = value;
    $$('#home-view button').forEach(button => { button.disabled = value; });
    $('#create-btn').innerHTML = value && !joining ? 'Opening your room…' : 'Create private room <span>→</span>';
    $('#join-btn').textContent = value && joining ? 'Joining…' : 'Join room';
  }
  function homeError(error) { $('#home-error').textContent = error.message || String(error); $('#home-error').hidden = false; }
  function newConnection() {
    resetVisuals();
    const network = new window.RoomNetwork.Connection(
      snapshot => { if (connection === network) { state = snapshot; render(); } },
      (text,tone) => {
        if (connection !== network) return;
        if (tone === 'bad' || tone === 'warning') {
          $('#connection-text').textContent = text; $('#connection-banner').hidden = false;
          $('#reconnect-btn').hidden = network.disposed;
        } else if (tone === 'good') { $('#connection-banner').hidden = true; }
      }
    );
    connection = network; return network;
  }
  async function createRoom(local = false) {
    if (homeBusy) return;
    try {
      const name = username(); setHomeBusy(true); $('#home-error').hidden = true;
      const network = newConnection(); await network.create(selectedGame,count,name,local);
      lastAction = 0; commandBusy = false; render();
    } catch (error) { connection?.close(); connection = null; state = null; homeError(error); }
    finally { setHomeBusy(false); }
  }
  async function joinRoom() {
    if (homeBusy) return;
    try {
      const name = username(); const code = $('#room-code').value.replace(/[\s-]/g,'').toUpperCase();
      if (!window.RoomNetwork.validCode(code)) throw new Error('Enter the six-character code your friend shared.');
      setHomeBusy(true,true); $('#home-error').hidden = true;
      const network = newConnection(); await network.join(code,name);
      lastAction = 0; commandBusy = false; render();
    } catch (error) { connection?.close(); connection = null; state = null; homeError(error); }
    finally { setHomeBusy(false); }
  }
  function roomUrl() { const url = new URL(location.href); url.searchParams.set('room',state.code); return url.href; }
  async function copy(text, message) {
    try { await navigator.clipboard.writeText(text); toast(message,'good'); }
    catch (_) {
      const input = document.createElement('textarea'); input.value = text; input.style.position='fixed'; input.style.opacity='0'; document.body.append(input); input.select();
      const copied = document.execCommand('copy'); input.remove();
      toast(copied ? message : text,copied ? 'good' : '');
    }
  }
  async function command(value) {
    if (commandBusy || !connection) return;
    commandBusy = true; updateControls();
    try { await connection.command(value); }
    catch (error) { toast(error.message,'bad'); }
    finally { commandBusy = false; if (state) { if (state.phase === 'lobby') render(); else updateControls(); } }
  }
  function statusBanner() {
    if(state.roomClosed){$('#connection-banner').hidden=true;$('#reconnect-btn').hidden=true;return;}
    const offline = state.players.filter(player => !player.connected);
    if (offline.length) {
      $('#connection-banner').hidden = false;
      $('#connection-text').textContent = `${offline.map(player => player.name).join(', ')} disconnected. Their seat is reserved; they can rejoin from the same browser tab.`;
      $('#reconnect-btn').hidden = true;
    } else if (state.connectionLost) {
      $('#connection-banner').hidden = false;
      $('#connection-text').textContent = 'Connection to the host was lost. Keep this tab open and try reconnecting.';
      $('#reconnect-btn').hidden = connection.disposed;
    } else if (!connection.disposed) $('#connection-banner').hidden = true;
  }
  function renderLobby() {
    $('#lobby-art').innerHTML = Art.preview(state.type,'lobby-preview');
    $('#lobby-subtitle').textContent = `${state.capacity} players · ${state.type === 'ludo' ? 'Ludo' : 'Snakes & Ladders'} · a room just for your friends.`;
    const seats = R.seats(state.capacity);
    $('#lobby-players').innerHTML = seats.map((color,index) => {
      const player = state.players.find(item => item.color === color);
      if (!player) return `<div class="lobby-player waiting-seat"><span class="pawn">${Art.pawn(color,'wait-'+index)}</span><div><span class="player-name">A seat for your friend</span><small>Waiting for player ${index+1}</small></div><span class="ready-mark waiting">Empty</span></div>`;
      return `<div class="lobby-player"><span class="pawn">${Art.pawn(player.color,'lobby-'+index)}</span><div><span class="player-name">${esc(player.name)}${player.id === connection.id ? ' <small style="display:inline">(you)</small>' : ''}</span><small>${player.id === state.hostId ? 'Room host' : player.connected ? 'Connected' : 'Disconnected'}</small></div><span class="ready-mark${player.connected ? '' : ' waiting'}">${player.connected ? '✓ Joined' : 'Offline'}</span>${connection.host && player.id !== state.hostId ? `<button class="remove-player" data-remove="${esc(player.id)}" aria-label="Remove ${esc(player.name)} from lobby">×</button>` : ''}</div>`;
    }).join('');
    $('#lobby-wait').textContent = state.players.length < state.capacity ? `${state.capacity-state.players.length} seat${state.capacity-state.players.length === 1 ? '' : 's'} still waiting. The game starts automatically when everyone joins.` : 'Waiting for everyone to reconnect. The game starts automatically.';
  }
  function die(value) {
    const spots = {1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]}, cube=$('#dice-cube');
    if(!cube.children.length)cube.innerHTML=Object.keys(spots).map(face=>`<div class="cube-face" data-face="${face}" aria-hidden="true">${Array.from({length:9},(_,index)=>`<span${spots[face].includes(index+1)?' class="pip"':''}></span>`).join('')}</div>`).join('');
    const angles={1:[-12,-18],2:[-102,-18],3:[-12,-108],4:[-12,72],5:[78,-18],6:[-12,162]}[value||1];
    cube.style.setProperty('--from-x',cube.style.getPropertyValue('--die-x')||'-12deg');cube.style.setProperty('--from-y',cube.style.getPropertyValue('--die-y')||'-18deg');
    cube.style.setProperty('--die-x',angles[0]+'deg');cube.style.setProperty('--die-y',angles[1]+'deg');
    $('#die').setAttribute('aria-label',value ? `Dice shows ${value}` : 'Dice waiting to be rolled');
  }
  function updateControls() {
    if (!state?.game) return;
    const game = state.game, active = R.current(game), mine = connection.local || active.id === connection.id;
    const offline = !state.players.find(player=>player.id === active.id)?.connected;
    $('#roll-btn').disabled = state.phase !== 'playing' || !mine || !!game.pending || commandBusy || animationBusy || offline || state.connectionLost || connection.disposed;
    $('#roll-btn').innerHTML = state.phase === 'won' ? 'Game finished' : commandBusy ? 'One moment…' : game.pending && mine ? 'Pick a token' : mine ? 'Roll dice <span>↗</span>' : 'Waiting…';
    $$('.move-token-btn').forEach(button=> { button.disabled = commandBusy || animationBusy || state.connectionLost; });
    $('#winner-card').hidden = state.phase !== 'won' || animationBusy;
    const shifts=game.action?.snakeShifts||[],shifting=animationBusy && shifts.length,moving=animationBusy && ['ludo-move','snakes-move'].includes(game.action?.type), actor=game.players.find(player=>player.id===game.action?.player)||active;
    $('#turn-caption').textContent = state.phase==='won'?'THE TABLE HAS A WINNER':shifting?'THE BOARD IS ALIVE':moving?game.action.automatic?'ONE OBVIOUS MOVE':'ON THE MOVE':connection.local?'PASS THE DEVICE':mine?'YOUR TURN':'FRIENDS AT THE TABLE';
    $('#turn-title').textContent = game.winner && !animationBusy ? `${game.players.find(player=>player.id===game.winner).name} wins!` : shifting?'Snake shuffle!':moving ? `${actor.name} is moving` : mine && !connection.local ? 'Your turn' : `${active.name}'s turn`;
    $('#turn-hint').textContent = game.winner && !animationBusy?connection.local?'Another round? Start a fresh game.':'This room is closed. A new game uses a fresh code.':shifting?shifts.some(shift=>shift.players.length)?'The board shuffled. Caught pawns take a slide!':'All snakes are slithering to new spots. Watch the heads!':moving?game.action.automatic?'Only one legal move. Playing it for you.':'One little step at a time.':game.pending?mine?`You rolled ${game.pending.die}. Choose a glowing token.`:`${active.name} is choosing a token.`:game.type==='ludo'?'Roll a 6 to leave home. Stars are safe.':snakeTurnHint(game,active);
    const untilShuffle=4-(game.rollCount||0)%4;
    $('#dice-footnote').textContent = game.type==='snakes'&&!game.winner?`All snakes shuffle in ${untilShuffle} roll${untilShuffle===1?'':'s'}.`:game.action?.automatic?'Only one legal move. Played automatically.':'A little luck goes a long way.';
    $('#turn-dot').style.background=R.PALETTE[animationBusy?actor.color:active.color];
    renderPlayers(game,animationBusy?actor.id:active.id);
  }
  function snakeTurnHint(game,active) {
    const action=game.action;
    if(action?.player===active.id && action.bonus) {
      if(game.sixes===2)return 'Two sixes! Roll again. A third six ends your turn without moving.';
      if(action.opened)return 'Piece opened on square 1! You earned another roll.';
      return action.bonus==='ladder'?'Ladder bonus! Roll again.':'Six! Roll again.';
    }
    return active.tokens[0]===0?'Roll a 6 to open your piece on square 1.':'Reach 100 exactly. Sixes and ladders earn another roll.';
  }
  function renderPlayers(game, activeId) {
    $('#players-bar').style.gridTemplateColumns=`repeat(${state.players.length},1fr)`;
    $('#players-bar').classList.toggle('four-players',state.players.length===4);
    $('#players-bar').innerHTML = game.players.map((player,index) => {
      const online=state.players.find(item=>item.id===player.id)?.connected;
      const progress=game.type==='ludo'?`${player.tokens.filter(value=>value===56).length}/4 home`:player.tokens[0]===0?'Need a 6':`#${player.tokens[0]}`;
      return `<div class="player-card${player.id===activeId && !game.winner?' active':''}" style="--player-color:${R.PALETTE[player.color]}"><span class="pawn">${Art.pawn(player.color,'player-'+index)}</span><div><b title="${esc(player.name)}">${esc(player.name)}${player.id===connection.id&&!connection.local?' · you':''}</b><small>${!online?'● Offline':game.winner===player.id?'♛ Winner':player.id===activeId&&!game.winner?'● Current turn':'● At the table'}</small></div><span class="player-meter">${progress}</span></div>`;
    }).join('');
  }
  function renderMatch() {
    const game = state.game, active = R.current(game), mine = connection.local || active.id === connection.id;
    const action=game.action, fresh=action && action.id!==lastAction;
    const key=[game.type,game.players.map(player=>player.id).join(','),game.actionId,state.phase].join('|');
    if(key!==boardKey) {
      const before=displayedGame, rollFresh=!!before && game.lastDie && game.lastDie.id!==before.lastDie?.id;
      const motions=fresh?window.BoardMotion.plan(before,game):[], lead=rollFresh&&!reducedMotion?650:0;
      const epoch=++visualEpoch;boardAnimation?.cancel();clearTimeout(diceTimer);$('#die').classList.remove('rolling');
      clearReactions();
      if(!before)hostIntro(game.type);
      animationBusy=!!before && (rollFresh||motions.length>0) && !reducedMotion;
      $('#board-container').innerHTML = game.type==='ludo'?Art.ludo(game,connection.id,'match-ludo',connection.local):Art.snakes(game,connection.id,'match-snakes',connection.local);
      die(game.lastDie?.value);
      if(rollFresh){playSound('roll');if(!reducedMotion){void $('#die').offsetWidth;$('#die').classList.add('rolling');diceTimer=setTimeout(()=>{$('#die').classList.remove('rolling');},650);}}
      if(animationBusy){
        boardAnimation=window.BoardMotion.animate($('#board-container svg'),motions,{delay:lead,onSound:playSound,art:Art});
        boardAnimation.finished.then(()=>{if(epoch!==visualEpoch)return;animationBusy=false;boardAnimation=null;if(state?.game)updateControls();});
      }
      if(fresh && before)queueReactions(before,game,motions,lead);
      boardKey=key;
    }
    if(fresh)lastAction=action.id;
    displayedGame=JSON.parse(JSON.stringify(game));
    $('#turn-dot').style.background=R.PALETTE[active.color];
    $('#turn-caption').textContent = state.phase==='won'?'THE TABLE HAS A WINNER':connection.local?'PASS THE DEVICE':mine?'YOUR TURN':'FRIENDS AT THE TABLE';
    $('#turn-title').textContent = game.winner ? `${game.players.find(player=>player.id===game.winner).name} wins!` : mine && !connection.local ? 'Your turn' : `${active.name}'s turn`;
    $('#turn-hint').textContent = game.winner?'Game complete. Start a new game for another round.':game.pending?mine?`You rolled ${game.pending.die}. Tap a glowing token to move.`:`${active.name} is choosing a token.`:game.type==='ludo'?'Roll a 6 to leave home. Stars are safe.':'First to 100 wins. You need the exact roll to finish.';
    const moves=game.type==='ludo' && mine?R.legal(game):[];
    $('#move-options').hidden=!moves.length || state.phase==='won';
    $('#move-options').innerHTML=moves.length?`<span>Move a token:</span>${moves.map(index=>`<button class="move-token-btn" data-move="${index}">Token ${index+1}</button>`).join('')}`:'';
    $('#quick-rules').innerHTML=game.type==='ludo'?'<ul><li>Roll a 6 to bring a token out.</li><li>One legal move plays automatically. Choose when there are options.</li><li>Capture rivals on unmarked squares.</li><li>Bring all four tokens home to win.</li></ul>':'<ul><li>A 6 opens your piece on square 1.</li><li>A 6 or a ladder climb earns another roll. Three consecutive sixes end the turn; the third does not move.</li><li>Watch the giant snake: the 90s to the first row!</li><li>Every 4 rolls, all snakes shuffle both ends within their rows. Pawns on new heads slide down.</li><li>Roll exactly to reach 100 and win.</li></ul>';
    $('#activity').innerHTML=game.log.map(line=>`<li>${esc(line)}</li>`).join('');
    $('#winner-card').hidden=state.phase!=='won';
    if(state.phase==='won') {
      const winner=game.players.find(player=>player.id===game.winner);
      const isHost=state.hostId===connection.id;
      $('#winner-card').innerHTML=`<p class="eyebrow">A LITTLE LUCK. A LOT OF BRAGGING RIGHTS.</p><h2>♛ ${esc(winner.name)} takes the win!</h2><p>${game.type==='ludo'?'All four tokens home. A beautifully played race.':'Square 100. A few lucky ladders made all the difference.'}</p>${connection.local?'':'<p>This room is closed. Its code has expired.</p>'}${isHost?`<button class="primary-btn" id="new-game-btn">${connection.local?'Play again':'New game · fresh room code'} →</button>`:'<button class="secondary-btn" id="back-home-btn">Back to games →</button>'}`;
    }
    updateControls();
  }
  function render() {
    if(!state || !connection)return;
    if(!$('#home-view').hidden)window.scrollTo({top:0,behavior:'instant'});
    $('#home-view').hidden=true;$('#room-view').hidden=false;
    $('#room-title').textContent=state.type==='ludo'?'Ludo':'Snakes & Ladders';
    $('#room-kind').textContent=connection.local?'SAME SCREEN. SAME FUN.':'YOUR PRIVATE TABLE';
    $('#room-code-display').textContent=state.roomClosed?'ENDED':state.code;
    $('#copy-code').disabled=connection.local || state.roomClosed;$('#invite-btn').hidden=connection.local || state.roomClosed;
    $('#lobby-view').hidden=state.phase!=='lobby';$('#match-view').hidden=state.phase==='lobby';
    syncEffectPreviews();
    if(state.phase==='lobby')renderLobby();else renderMatch();
    statusBanner();
    if(!connection.local){const url=new URL(location.href);if(state.roomClosed)url.searchParams.delete('room');else url.searchParams.set('room',state.code);history.replaceState(null,'',url.href);}
  }
  function leave() {
    connection?.close();connection=null;state=null;commandBusy=false;animationBusy=false;lastAction=0;
    resetVisuals();
    $('#home-view').hidden=false;$('#room-view').hidden=true;$('#connection-banner').hidden=true;
    syncEffectPreviews();
    window.scrollTo({top:0,behavior:'instant'});
    const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url.href);
  }
  function newGame(){
    const setup={type:state.type,capacity:state.capacity,name:connection.name,local:connection.local};leave();selectedGame=setup.type;count=setup.capacity;$('#player-name').value=setup.name;
    $$('[data-game]').forEach(button=>{const selected=button.dataset.game===selectedGame;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    $$('[data-count]').forEach(button=>{const selected=Number(button.dataset.count)===count;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});syncEffectPreviews();createRoom(setup.local);
  }
  function rules() {
    $('#rules-content').innerHTML='<h3>Ludo</h3><ul><li>Each player has four tokens. Roll a 6 to move one from its yard to the starting square.</li><li>A single legal move plays automatically. With multiple choices, choose a highlighted token. A token must move the full number rolled, and cannot overshoot home.</li><li>A 6, a capture, or bringing a token home earns another roll. Three consecutive sixes forfeit that turn.</li><li>The eight starred squares are safe. Elsewhere, landing on a rival sends their token back to the yard. Stacked tokens do not block the track in this version.</li><li>The first player to bring all four tokens home wins. Two-player games use opposite colours.</li></ul><h3>Snakes &amp; Ladders</h3><ul><li>Start before square 1. Your first 6 opens the piece on square 1 and earns another roll. Before that, other rolls leave your piece at START and pass the turn. Landing at a ladder’s foot takes you up; landing on a snake’s head takes you down.</li><li>A 6 or a ladder climb earns one bonus roll. Getting both on the same roll still earns only one. Three consecutive sixes end your turn: the third 6 does not move your piece; the first two moves stand. A non-six resets the streak, even during a ladder bonus. An overshoot stays put; a 6 still grants another roll unless it is the third six.</li><li>The giant snake starts at 93 and slides all the way to 4. After every 4 dice rolls across the players, including opening attempts and bonus rolls, all snakes shuffle both ends within their respective rows. The giant snake always connects the 90s to the first row. Pawns on new heads slide down. All players see the same shuffle. Reach 100 exactly to win.</li><li>The first player to reach 100 wins.</li></ul><h3>Playing with friends</h3><p>Create a room and share the code or invite link. Joining is enough: the game starts automatically as soon as all selected seats are filled and connected. The selected player count includes the host. Full rooms refuse extra guests. Keep the host’s tab open for the whole game. Admitted players can reconnect while play continues. After a win, the room closes and its code expires; start a new game for a fresh code.</p>';
    $('#rules-dialog').showModal();
  }
  $$('[data-game]').forEach(button=>button.addEventListener('click',()=>{
    selectedGame=button.dataset.game;
    syncEffectPreviews();
    $$('[data-game]').forEach(item=>{item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));});playSound('tap');
  }));
  $$('[data-count]').forEach(button=>button.addEventListener('click',()=>{
    count=Number(button.dataset.count);$$('[data-count]').forEach(item=>{item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));});playSound('tap');
  }));
  $('#create-form').addEventListener('submit',event=>{event.preventDefault();createRoom();});
  $('#join-form').addEventListener('submit',event=>{event.preventDefault();joinRoom();});
  $('#local-btn').addEventListener('click',()=>createRoom(true));
  $('#roll-btn').addEventListener('click',()=>{if(!$('#roll-btn').disabled)command({type:'roll'});});
  $('#move-options').addEventListener('click',event=>{const button=event.target.closest('[data-move]');if(button&&!button.disabled)command({type:'move',token:Number(button.dataset.move)});});
  function boardMove(target){const token=target.closest('.board-token.movable');if(token&&!animationBusy)command({type:'move',token:Number(token.dataset.token)});}
  $('#board-container').addEventListener('click',event=>boardMove(event.target));
  $('#board-container').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.closest('.movable')){event.preventDefault();boardMove(event.target);}});
  $('#lobby-players').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(button)command({type:'remove',player:button.dataset.remove});});
  $('#winner-card').addEventListener('click',event=>{if(event.target.closest('#new-game-btn'))newGame();else if(event.target.closest('#back-home-btn'))leave();});
  $('#copy-code').addEventListener('click',()=>{if(state&&!connection.local&&!state.roomClosed)copy(state.code,'Room code copied. Send it to your friends.');});
  $('#invite-btn').addEventListener('click',()=>{if(state&&!state.roomClosed)copy(roomUrl(),'Invite link copied. Your friends can open it to join.');});
  $('#reconnect-btn').addEventListener('click',async()=>{try{$('#reconnect-btn').disabled=true;await connection.reconnect();toast('Back at the table.','good');}catch(error){toast(error.message,'bad');}finally{$('#reconnect-btn').disabled=false;}});
  $('#leave-btn').addEventListener('click',leave);
  $('#brand-link').addEventListener('click',event=>{event.preventDefault();if(state)leave();});
  $('#help-btn').addEventListener('click',rules);$('#more-rules').addEventListener('click',rules);
  $('#close-rules').addEventListener('click',()=>$('#rules-dialog').close());$('#rules-done').addEventListener('click',()=>$('#rules-dialog').close());
  $('#audio-btn').addEventListener('click',()=>{const open=$('#audio-panel').hidden;$('#audio-panel').hidden=!open;$('#audio-btn').setAttribute('aria-expanded',String(open));});
  for(const channel of ['music','effects']){
    $('#'+channel+'-toggle').addEventListener('click',()=>audio.configure({[channel+'On']:!audio.settings[channel+'On']}));
    $('#'+channel+'-volume').addEventListener('input',event=>audio.configure({[channel]:Number(event.target.value)/100}));
  }
  $('#music-choices').addEventListener('click',event=>{const choice=event.target.closest('[data-track]');if(choice)audio.configure({track:choice.dataset.track,musicOn:true});});
  $('#effect-previews').addEventListener('click',event=>{const button=event.target.closest('[data-effect-preview]');if(button&&!button.disabled)playSound(button.dataset.effectPreview);});
  $('#voice-btn').addEventListener('click',()=>{speaker.configure(!speaker.enabled);try{localStorage.setItem('ll-commentary-voice',String(speaker.enabled));}catch(_){/* Keep this tab's choice. */}});
  $('#table-toggle').addEventListener('click',()=>{tableOpen=!tableOpen;syncTable();try{localStorage.setItem('ll-table-open',String(tableOpen));}catch(_){/* Keep the current choice. */}});
  document.addEventListener('pointerdown',()=>{audio.start();speaker.unlock();},{passive:true});
  document.addEventListener('keydown',event=>{audio.start();speaker.unlock();if(event.key==='Escape'&&!$('#audio-panel').hidden){$('#audio-panel').hidden=true;$('#audio-btn').setAttribute('aria-expanded','false');$('#audio-btn').focus();}},{capture:true});
  document.addEventListener('click',event=>{if(!event.target.closest('.audio-settings')){$('#audio-panel').hidden=true;$('#audio-btn').setAttribute('aria-expanded','false');}});
  document.addEventListener('visibilitychange',()=>{audio.pause(document.hidden);if(document.hidden)speaker.cancel();});
  window.addEventListener('pagehide',()=>{connection?.close();audio.stop();resetVisuals();speaker.stop();});
})();
