(function () {
  'use strict';
  const R = window.BoardRules, Art = window.BoardArt, esc = Art.escape;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let selectedGame = 'ludo', count = 2, connection = null, state = null;
  let homeBusy = false, commandBusy = false, animationBusy = false, lastAction = 0;
  let toastTimer, animationTimer, audio = null, sound = false;
  $('#ludo-preview').innerHTML = Art.preview('ludo','home-ludo');
  $('#snakes-preview').innerHTML = Art.preview('snakes','home-snakes');
  try { $('#player-name').value = localStorage.getItem('rt-name') || ''; } catch (_) { /* Name storage is optional. */ }
  const invited = new URL(location.href).searchParams.get('room');
  if (invited && window.RoomNetwork.validCode(invited.toUpperCase())) $('#room-code').value = invited.toUpperCase();

  function toast(text, tone = '') {
    $('#toast').textContent = text; $('#toast').className = 'toast ' + tone; $('#toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
  }
  function playSound(kind) {
    if (!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const notes = { roll:[270,340,410], move:[480], ladder:[410,550,730], snake:[390,290,190], win:[440,550,660,880], tap:[420] }[kind] || [440];
      notes.forEach((frequency,index) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + index*.08;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(.045,at+.01); gain.gain.exponentialRampToValueAtTime(.001,at+.14);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at+.15);
      });
    } catch (_) { /* A muted browser should not stop play. */ }
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
      return `<div class="lobby-player"><span class="pawn">${Art.pawn(player.color,'lobby-'+index)}</span><div><span class="player-name">${esc(player.name)}${player.id === connection.id ? ' <small style="display:inline">(you)</small>' : ''}</span><small>${player.id === state.hostId ? 'Room host' : player.connected ? 'Connected' : 'Disconnected'}</small></div><span class="ready-mark${player.ready ? '' : ' waiting'}">${player.ready ? '✓ Ready' : player.connected ? 'Getting ready' : 'Offline'}</span>${connection.host && player.id !== state.hostId ? `<button class="remove-player" data-remove="${esc(player.id)}" aria-label="Remove ${esc(player.name)} from lobby">×</button>` : ''}</div>`;
    }).join('');
    const me = state.players.find(player => player.id === connection.id);
    $('#ready-btn').textContent = me?.ready ? "You're ready ✓" : "I'm ready";
    $('#ready-btn').setAttribute('aria-pressed',String(!!me?.ready));
    $('#ready-btn').disabled = commandBusy || state.connectionLost;
    $('#start-btn').hidden = state.hostId !== connection.id;
    $('#start-btn').disabled = !state.canStart || commandBusy;
    $('#start-btn').textContent = state.canStart ? "Everyone's here. Let's play →" : 'Waiting for the table…';
    $('#lobby-wait').textContent = state.players.length < state.capacity ? `${state.capacity-state.players.length} seat${state.capacity-state.players.length === 1 ? '' : 's'} still waiting. Send your friends the invite link.` : state.canStart ? state.hostId === connection.id ? 'All ready. You can start the game.' : 'All ready. Waiting for the host to start.' : 'Ask everyone to tap “I’m ready”.';
  }
  function die(value) {
    const spots = {1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]}[value || 1];
    $('#die-face').innerHTML = Array.from({length:9},(_,index)=>`<span${spots.includes(index+1) ? ' class="pip"' : ''}></span>`).join('');
    $('#die').setAttribute('aria-label',value ? `Dice shows ${value}` : 'Dice waiting to be rolled');
  }
  function updateControls() {
    if (!state?.game) return;
    const game = state.game, active = R.current(game), mine = connection.local || active.id === connection.id;
    const offline = !state.players.find(player=>player.id === active.id)?.connected;
    $('#roll-btn').disabled = state.phase !== 'playing' || !mine || !!game.pending || commandBusy || animationBusy || offline || state.connectionLost || connection.disposed;
    $('#roll-btn').innerHTML = state.phase === 'won' ? 'Game finished' : commandBusy ? 'One moment…' : game.pending && mine ? 'Pick a token' : mine ? 'Roll dice <span>↗</span>' : 'Waiting…';
    $$('.move-token-btn').forEach(button=> { button.disabled = commandBusy || animationBusy || state.connectionLost; });
  }
  function renderMatch() {
    const game = state.game, active = R.current(game), mine = connection.local || active.id === connection.id;
    $('#players-bar').style.gridTemplateColumns=`repeat(${state.players.length},1fr)`;
    $('#players-bar').classList.toggle('four-players',state.players.length===4);
    $('#players-bar').innerHTML = game.players.map((player,index) => {
      const online=state.players.find(item=>item.id===player.id)?.connected;
      const progress=game.type==='ludo'?`${player.tokens.filter(value=>value===56).length}/4 home`:player.tokens[0]===0?'Start':`#${player.tokens[0]}`;
      return `<div class="player-card${player.id===active.id && !game.winner ? ' active' : ''}" style="--player-color:${R.PALETTE[player.color]}"><span class="pawn">${Art.pawn(player.color,'player-'+index)}</span><div><b>${esc(player.name)}${player.id===connection.id && !connection.local?' · you':''}</b><small>${!online ? '● Offline' : game.winner===player.id ? '♛ Winner' : player.id===active.id && !game.winner ? '● Current turn' : '● At the table'}</small></div><span class="player-meter">${progress}</span></div>`;
    }).join('');
    const action=game.action, fresh=action && action.id!==lastAction;
    if(fresh) {
      lastAction=action.id;
      if(action.type==='roll'||action.type==='snakes-move') {
        animationBusy=true; $('#die').classList.remove('rolling'); void $('#die').offsetWidth; $('#die').classList.add('rolling');
        clearTimeout(animationTimer); animationTimer=setTimeout(()=>{animationBusy=false;$('#die').classList.remove('rolling');updateControls();},560);
        playSound(game.winner?'win':action.jump==='ladder'?'ladder':action.jump==='snake'?'snake':'roll');
      } else playSound(game.winner?'win':'move');
    }
    const animate=fresh && ['ludo-move','snakes-move'].includes(action.type)?{player:action.player,token:action.token||0}:null;
    $('#board-container').innerHTML = game.type==='ludo'?Art.ludo(game,connection.id,'match-ludo',connection.local,animate):Art.snakes(game,connection.id,'match-snakes',connection.local,animate);
    die(game.lastDie?.value);
    $('#turn-dot').style.background=R.PALETTE[active.color];
    $('#turn-caption').textContent = state.phase==='won'?'THE TABLE HAS A WINNER':connection.local?'PASS THE DEVICE':mine?'YOUR TURN':'FRIENDS AT THE TABLE';
    $('#turn-title').textContent = game.winner ? `${game.players.find(player=>player.id===game.winner).name} wins!` : mine && !connection.local ? 'Your turn' : `${active.name}'s turn`;
    $('#turn-hint').textContent = game.winner?'One more game? The host can gather everyone for a rematch.':game.pending?mine?`You rolled ${game.pending.die}. Tap a glowing token to move.`:`${active.name} is choosing a token.`:game.type==='ludo'?'Roll a 6 to leave home. Stars are safe.':'First to 100 wins. You need the exact roll to finish.';
    const moves=game.type==='ludo' && mine?R.legal(game):[];
    $('#move-options').hidden=!moves.length || state.phase==='won';
    $('#move-options').innerHTML=moves.length?`<span>Move a token:</span>${moves.map(index=>`<button class="move-token-btn" data-move="${index}">Token ${index+1}</button>`).join('')}`:'';
    $('#quick-rules').innerHTML=game.type==='ludo'?'<ul><li>Roll a 6 to bring a token out.</li><li>Tap a glowing token after rolling.</li><li>Capture rivals on unmarked squares.</li><li>Bring all four tokens home to win.</li></ul>':'<ul><li>Roll and move automatically.</li><li>Ladders take you up. Snakes bring you down.</li><li>Roll exactly to reach square 100.</li><li>First to 100 wins the table.</li></ul>';
    $('#activity').innerHTML=game.log.map(line=>`<li>${esc(line)}</li>`).join('');
    $('#winner-card').hidden=state.phase!=='won';
    if(state.phase==='won') {
      const winner=game.players.find(player=>player.id===game.winner);
      $('#winner-card').innerHTML=`<p class="eyebrow">A LITTLE LUCK. A LOT OF BRAGGING RIGHTS.</p><h2>♛ ${esc(winner.name)} takes the win!</h2><p>${game.type==='ludo'?'All four tokens home. A beautifully played race.':'Square 100. A few lucky ladders made all the difference.'}</p>${connection.host?'<button class="primary-btn" id="rematch-btn">Gather everyone for a rematch →</button>':'<p>Waiting for the host to start a rematch.</p>'}`;
    }
    updateControls();
  }
  function render() {
    if(!state || !connection)return;
    $('#home-view').hidden=true;$('#room-view').hidden=false;
    $('#room-title').textContent=state.type==='ludo'?'Ludo':'Snakes & Ladders';
    $('#room-kind').textContent=connection.local?'SAME SCREEN. SAME FUN.':'YOUR PRIVATE TABLE';
    $('#room-code-display').textContent=state.code;
    $('#copy-code').disabled=connection.local;$('#invite-btn').hidden=connection.local;
    $('#lobby-view').hidden=state.phase!=='lobby';$('#match-view').hidden=state.phase==='lobby';
    if(state.phase==='lobby')renderLobby();else renderMatch();
    statusBanner();
    if(!connection.local){const url=new URL(location.href);url.searchParams.set('room',state.code);history.replaceState(null,'',url.href);}
  }
  function leave() {
    connection?.close();connection=null;state=null;commandBusy=false;animationBusy=false;lastAction=0;
    clearTimeout(animationTimer);$('#die').classList.remove('rolling');
    $('#home-view').hidden=false;$('#room-view').hidden=true;$('#connection-banner').hidden=true;
    const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url.href);
  }
  function rules() {
    $('#rules-content').innerHTML='<h3>Ludo</h3><ul><li>Each player has four tokens. Roll a 6 to move one from its yard to the starting square.</li><li>After rolling, choose a highlighted token. A token must move the full number rolled, and cannot overshoot home.</li><li>A 6, a capture, or bringing a token home earns another roll. Three consecutive sixes forfeit that turn.</li><li>The eight starred squares are safe. Elsewhere, landing on a rival sends their token back to the yard. Stacked tokens do not block the track in this version.</li><li>The first player to bring all four tokens home wins. Two-player games use opposite colours.</li></ul><h3>Snakes &amp; Ladders</h3><ul><li>All players start before square 1. Roll to advance. Landing at the bottom of a ladder takes you up; landing on a snake’s head takes you down.</li><li>Each roll passes the turn, including a 6. You need an exact roll to reach 100. If you overshoot, you stay put.</li><li>The first player to reach 100 wins.</li></ul><h3>Playing with friends</h3><p>Create a room, share the code or invite link, and ask everyone to tap “I’m ready”. The host starts when all selected seats are ready. Keep the host’s tab open for the whole game. If a guest loses connection, their seat stays reserved; they can reconnect from the same browser tab.</p>';
    $('#rules-dialog').showModal();
  }
  $$('[data-game]').forEach(button=>button.addEventListener('click',()=>{
    selectedGame=button.dataset.game;
    $$('[data-game]').forEach(item=>{item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));});playSound('tap');
  }));
  $$('[data-count]').forEach(button=>button.addEventListener('click',()=>{
    count=Number(button.dataset.count);$$('[data-count]').forEach(item=>{item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));});playSound('tap');
  }));
  $('#create-form').addEventListener('submit',event=>{event.preventDefault();createRoom();});
  $('#join-form').addEventListener('submit',event=>{event.preventDefault();joinRoom();});
  $('#local-btn').addEventListener('click',()=>createRoom(true));
  $('#ready-btn').addEventListener('click',()=>{const me=state.players.find(player=>player.id===connection.id);command({type:'ready',ready:!me.ready});});
  $('#start-btn').addEventListener('click',()=>command({type:'start'}));
  $('#roll-btn').addEventListener('click',()=>{if(!$('#roll-btn').disabled)command({type:'roll'});});
  $('#move-options').addEventListener('click',event=>{const button=event.target.closest('[data-move]');if(button&&!button.disabled)command({type:'move',token:Number(button.dataset.move)});});
  function boardMove(target){const token=target.closest('.board-token.movable');if(token&&!animationBusy)command({type:'move',token:Number(token.dataset.token)});}
  $('#board-container').addEventListener('click',event=>boardMove(event.target));
  $('#board-container').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.closest('.movable')){event.preventDefault();boardMove(event.target);}});
  $('#lobby-players').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(button)command({type:'remove',player:button.dataset.remove});});
  $('#winner-card').addEventListener('click',event=>{if(event.target.closest('#rematch-btn'))command({type:'rematch'});});
  $('#copy-code').addEventListener('click',()=>{if(state&&!connection.local)copy(state.code,'Room code copied. Send it to your friends.');});
  $('#invite-btn').addEventListener('click',()=>{if(state)copy(roomUrl(),'Invite link copied. Your friends can open it to join.');});
  $('#reconnect-btn').addEventListener('click',async()=>{try{$('#reconnect-btn').disabled=true;await connection.reconnect();toast('Back at the table.','good');}catch(error){toast(error.message,'bad');}finally{$('#reconnect-btn').disabled=false;}});
  $('#leave-btn').addEventListener('click',leave);
  $('#brand-link').addEventListener('click',event=>{event.preventDefault();if(state)leave();});
  $('#help-btn').addEventListener('click',rules);$('#more-rules').addEventListener('click',rules);
  $('#close-rules').addEventListener('click',()=>$('#rules-dialog').close());$('#rules-done').addEventListener('click',()=>$('#rules-dialog').close());
  $('#sound-btn').addEventListener('click',()=>{sound=!sound;$('#sound-btn').setAttribute('aria-pressed',String(sound));$('#sound-btn').setAttribute('aria-label',`Turn sound ${sound?'off':'on'}`);$('#sound-btn').textContent=sound?'♫':'♪';playSound('tap');});
  window.addEventListener('pagehide',()=>connection?.close());
})();
