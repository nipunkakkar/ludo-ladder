(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GameAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  // Original composition and synthesis for Ludo Ladder. Audio material: CC0.
  // No recording, sample, external music service or existing tune is used.
  const DEFAULTS = { musicOn: true, effectsOn: true, music: .35, effects: .6, track: 'mellow' };
  const frequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const chords = [[48,60,64,71],[45,60,64,67],[50,62,65,69],[43,59,62,69],[41,57,60,64],[48,60,64,67],[45,57,60,67],[43,59,62,65]];
  const melody = [[72,76,null,79,74,null,71,76],[69,null,72,76,74,null,72,67],[74,77,null,76,72,null,69,74],[71,null,74,79,76,null,74,67],[69,72,null,76,72,null,69,64],[67,null,72,76,79,null,76,72],[72,69,null,67,76,null,72,69],[71,null,74,77,74,null,72,null]];
  const TRACKS = [
    {id:'mellow',name:'Soft Glow',description:'Warm bells · slow and cosy',bpm:76,style:'bells',chords,melody},
    {id:'cafe',name:'Late Night Café',description:'Soft groove · laid-back rhythm',bpm:92,style:'cafe',chords:[[50,62,66,73],[47,59,62,69],[43,59,62,66],[45,61,64,71],[50,57,62,66],[47,62,66,69],[43,55,59,62],[45,57,61,64]],melody:[[78,null,73,74,78,null,81,78],[74,73,null,71,69,null,74,78],[71,null,74,78,76,null,74,71],[73,76,null,80,76,null,73,69],[78,81,null,78,74,null,73,74],[78,null,74,71,74,78,null,81],[74,71,null,69,71,null,74,78],[76,null,73,69,73,76,74,null]]},
    {id:'breeze',name:'Sunny Bounce',description:'Bright plucks · upbeat and playful',bpm:112,style:'bounce',chords:[[52,64,68,71],[49,61,64,68],[45,61,64,69],[47,63,66,71],[52,59,64,68],[44,59,63,68],[45,57,61,64],[47,59,63,66]],melody:[[76,80,83,null,80,76,78,80],[73,76,80,83,80,null,76,73],[76,null,81,80,76,73,76,81],[78,83,81,78,75,null,78,83],[83,80,76,80,83,null,88,83],[80,78,75,null,71,75,78,80],[81,80,76,73,76,null,80,81],[83,null,78,75,78,81,80,78]]},
    {id:'neon',name:'Neon Sprint',description:'Synth arpeggios · fast arcade energy',bpm:132,style:'arcade',chords:[[45,57,60,64],[41,53,57,60],[48,60,64,67],[43,55,59,62],[45,57,60,67],[41,57,60,65],[48,55,60,64],[43,59,62,67]],melody:[[69,72,76,72,81,76,72,76],[65,69,72,69,77,72,69,72],[72,76,79,76,84,79,76,79],[67,71,74,71,79,74,71,74],[81,76,72,69,72,76,79,81],[77,72,69,65,69,72,76,77],[84,79,76,72,76,79,83,84],[79,74,71,67,71,74,77,79]]},
    {id:'rush',name:'Final Round',description:'Driving beat · intense race to the finish',bpm:152,style:'intense',chords:[[38,50,57,62],[34,46,53,58],[41,53,60,65],[36,48,55,60],[38,50,57,65],[34,46,53,62],[41,53,60,67],[36,48,55,64]],melody:[[74,74,77,81,77,74,72,69],[70,70,74,77,74,70,69,65],[77,77,81,84,81,77,76,72],[72,72,76,79,76,72,70,67],[74,77,81,86,81,77,74,72],[70,74,77,82,77,74,70,69],[77,81,84,89,84,81,77,76],[79,76,72,67,72,76,79,81]]}
  ];
  const STINGS = {
    release:[[72,0,.16,'triangle'],[76,.09,.16,'triangle'],[79,.18,.16,'sine'],[84,.27,.23,'sine']],
    capture:[[50,0,.24,'triangle'],[62,.04,.17,'square'],[57,.16,.18,'triangle'],[50,.28,.22,'triangle']],
    finish:[[72,0,.3,'triangle'],[76,0,.3,'sine'],[79,.1,.22,'sine'],[84,.25,.25,'triangle']],
    'race-start':[[60,0,.13,'triangle'],[67,.12,.13,'triangle'],[72,.24,.26,'sine']],
    ladder:[[72,0,.13,'sine'],[76,.08,.13,'sine'],[79,.16,.13,'triangle'],[84,.24,.13,'triangle'],[88,.32,.18,'sine']],
    snake:[[83,0,.14,'triangle'],[77,.08,.14,'triangle'],[71,.16,.14,'triangle'],[65,.24,.14,'sine'],[53,.32,.18,'sine']],
    tension:[[62,0,.13,'triangle'],[63,.1,.13,'triangle'],[62,.2,.13,'triangle'],[69,.32,.18,'sine']],
    win:[[72,0,.3,'triangle'],[76,0,.3,'sine'],[79,.1,.25,'sine'],[84,.22,.28,'triangle'],[88,.22,.28,'sine']]
  };
  const clamp = (value, fallback) => Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : fallback;
  class Engine {
    constructor(options = {}) {
      this.settings = { ...DEFAULTS }; this.context = null; this.timer = null;
      this.factory = options.contextFactory || (() => { const Audio = root.AudioContext || root.webkitAudioContext; return Audio ? new Audio() : null; });
      this.onChange = options.onChange || (() => {}); this.step = 0; this.paused = false; this.cleanupTimers=new Set();
    }
    configure(settings) {
      const changed=TRACKS.some(track=>track.id===settings.track) && settings.track!==this.settings.track;
      if(changed)this.settings.track=settings.track;
      for (const key of ['musicOn','effectsOn']) if (typeof settings[key] === 'boolean') this.settings[key] = settings[key];
      for (const key of ['music','effects']) if (settings[key] !== undefined) this.settings[key] = clamp(settings[key], DEFAULTS[key]);
      if(changed && this.context)this.switchTrack();
      this.apply(); this.onChange(this.status());
    }
    status() { return { ...this.settings, started: !!this.context && this.context.state === 'running', paused: this.paused }; }
    async start() {
      try {
        if (!this.context) {
          this.context = this.factory(); if (!this.context) return false;
          const ctx = this.context;
          this.musicGain = ctx.createGain(); this.effectsGain = ctx.createGain();
          this.musicGain.connect(ctx.destination); this.effectsGain.connect(ctx.destination);
          if(ctx.createDelay){this.echo=ctx.createDelay(.5);this.echo.delayTime.value=.19;this.echoGain=ctx.createGain();this.echoGain.gain.value=.16;this.musicGain.connect(this.echo);this.echo.connect(this.echoGain);this.echoGain.connect(ctx.destination);}
          this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .12), ctx.sampleRate);
          const samples = this.noise.getChannelData(0);
          for (let index = 0; index < samples.length; index++) samples[index] = (Math.random()*2-1) * (1-index/samples.length);
        }
        if (this.context.state === 'suspended') await this.context.resume();
        this.apply(); this.onChange(this.status()); return true;
      } catch (_) { return false; }
    }
    apply() {
      if (!this.context) return;
      const now = this.context.currentTime;
      this.musicGain.gain.setTargetAtTime(!this.paused && this.settings.musicOn ? this.settings.music*(now<(this.duckUntil||0)?.42:1) : 0, now, .08);
      this.effectsGain.gain.setTargetAtTime(!this.paused && this.settings.effectsOn ? this.settings.effects : 0, now, .025);
      const shouldPlay = this.context.state === 'running' && !this.paused && this.settings.musicOn && this.settings.music > 0;
      if (shouldPlay && !this.timer) { this.next = now + .05; this.schedule(); this.timer = setInterval(() => this.schedule(), 150); }
      if (!shouldPlay && this.timer) { clearInterval(this.timer); this.timer = null; }
    }
    pause(value) { this.paused = value; this.apply(); }
    switchTrack() {
      const old=this.musicGain,ctx=this.context;
      old.gain.cancelScheduledValues(ctx.currentTime);old.gain.setTargetAtTime(0,ctx.currentTime,.04);
      this.musicGain=ctx.createGain();this.musicGain.gain.value=0;this.musicGain.connect(ctx.destination);if(this.echo)this.musicGain.connect(this.echo);
      const timer=setTimeout(()=>{old.disconnect();this.cleanupTimers.delete(timer);},5000);this.cleanupTimers.add(timer);
      this.step=0;this.next=ctx.currentTime+.1;
    }
    tone(midi, at, duration, amplitude, channel, type = 'sine', pan = 0, soft = false) {
      const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency(midi), at);
      gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(amplitude, at + (soft ? .45 : Math.min(.035, duration/4)));
      if(soft)gain.gain.linearRampToValueAtTime(amplitude*.7,at+duration*.6);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(gain);
      if (ctx.createStereoPanner) { const panner=ctx.createStereoPanner(); panner.pan.value=pan; gain.connect(panner); panner.connect(channel); oscillator.onended=()=>{gain.disconnect();panner.disconnect();}; }
      else { gain.connect(channel); oscillator.onended=()=>gain.disconnect(); }
      oscillator.start(at); oscillator.stop(at + duration + .03);
    }
    schedule() {
      if (!this.context || this.paused) return;
      const track=TRACKS.find(item=>item.id===this.settings.track)||TRACKS[0],beat=60/track.bpm,ctx=this.context;
      if (this.next < ctx.currentTime) this.next = ctx.currentTime + .03;
      while (this.next < ctx.currentTime + .35) {
        const bar = Math.floor(this.step / 8) % 8, slot = this.step % 8, at = this.next;
        if (slot === 0) {
          this.tone(track.chords[bar][0],at,beat*3.5,.1,this.musicGain,'sine');
          track.chords[bar].slice(1).forEach((note,index)=>this.tone(note,at+.035*index,beat*3.8,.035,this.musicGain,'sine',(index-1)*.35,true));
        }
        const note=track.melody[bar][slot],fast=['arcade','intense'].includes(track.style);
        if(note!==null){this.tone(note,at,fast?beat*.65:track.style==='bounce'?.35:1.05,fast?.055:.105,this.musicGain,track.style==='bells'?'sine':'triangle',slot%2?.18:-.18);if(!fast)this.tone(note+12,at,.6,.013,this.musicGain,'sine');}
        if(track.style!=='bells'){
          if(slot%2===0)this.tone(track.chords[bar][0]-12,at,beat*.7,.075,this.musicGain,'triangle');
          if(slot===0 || fast && slot===4)this.kick(at,this.musicGain,fast?.11:.06);
          if(slot===2 || slot===6)this.percussion(at,this.musicGain,fast?.04:.018,'highpass',1500);
          if(fast || track.style==='bounce' && slot%2)this.percussion(at,this.musicGain,.014,'highpass',6000);
        }
        this.step++; this.next += beat/2;
      }
    }
    kick(at,channel,amplitude) {
      const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.setValueAtTime(120,at);osc.frequency.exponentialRampToValueAtTime(42,at+.13);
      gain.gain.setValueAtTime(amplitude,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.18);osc.connect(gain);gain.connect(channel);osc.start(at);osc.stop(at+.2);osc.onended=()=>gain.disconnect();
    }
    percussion(at,channel,amplitude,type='highpass',frequency=1600) {
      const ctx=this.context,noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=this.noise;filter.type=type;filter.frequency.value=frequency;
      gain.gain.setValueAtTime(amplitude,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.08);noise.connect(filter);filter.connect(gain);gain.connect(channel);noise.start(at);noise.stop(at+.1);noise.onended=()=>{filter.disconnect();gain.disconnect();};
    }
    effect(kind, step = 0) {
      if (!this.context || this.context.state !== 'running' || this.paused || !this.settings.effectsOn || !this.settings.effects) return;
      const ctx=this.context, at=ctx.currentTime;
      if(STINGS[kind]){
        STINGS[kind].forEach(([note,offset,duration,type])=>this.tone(note,at+offset,duration,type==='square'?.04:.13,this.effectsGain,type));
        if(kind==='capture')this.kick(at,this.effectsGain,.17);
        this.duckUntil=at+.56;this.apply();clearTimeout(this.duckTimer);this.duckTimer=setTimeout(()=>this.apply(),580);
      }else if (kind === 'roll') {
        for (let index=0;index<5;index++) {
          const noise=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain(), time=at+index*.065;
          noise.buffer=this.noise; filter.type='highpass'; filter.frequency.value=1100+index*220;
          gain.gain.setValueAtTime(.12,time); gain.gain.exponentialRampToValueAtTime(.0001,time+.085);
          noise.connect(filter);filter.connect(gain);gain.connect(this.effectsGain);noise.start(time);noise.stop(time+.1);
          noise.onended=()=>{filter.disconnect();gain.disconnect();};
        }
      } else if (kind === 'step' || kind === 'move' || kind === 'tap') this.tone(65+(step%3)*2,at,.12,kind==='tap'?.035:.09,this.effectsGain,'triangle');
      else {
        const notes={ladder:[72,76,79,84],snake:[74,69,65,60],capture:[62,57,50],win:[72,76,79,84,88]}[kind] || [76];
        notes.forEach((note,index)=>this.tone(note,at+index*.085,.3,.1,this.effectsGain,'sine'));
      }
    }
    stop() { if(this.timer)clearInterval(this.timer);this.timer=null;clearTimeout(this.duckTimer);this.cleanupTimers.forEach(timer=>clearTimeout(timer));this.cleanupTimers.clear();this.context?.close?.();this.context=null; }
  }
  return { Engine, DEFAULTS, TRACKS, STINGS };
});
