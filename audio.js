(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GameAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  // Original composition and synthesis for Ludo Ladder. Audio material: CC0.
  // No recording, sample, external music service or existing tune is used.
  const DEFAULTS = { musicOn: true, effectsOn: true, music: .35, effects: .6 };
  const frequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const chords = [[48,60,64,71],[45,60,64,67],[50,62,65,69],[43,59,62,69],[41,57,60,64],[48,60,64,67],[45,57,60,67],[43,59,62,65]];
  const melody = [[72,76,null,79,74,null,71,76],[69,null,72,76,74,null,72,67],[74,77,null,76,72,null,69,74],[71,null,74,79,76,null,74,67],[69,72,null,76,72,null,69,64],[67,null,72,76,79,null,76,72],[72,69,null,67,76,null,72,69],[71,null,74,77,74,null,72,null]];
  const clamp = (value, fallback) => Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : fallback;
  class Engine {
    constructor(options = {}) {
      this.settings = { ...DEFAULTS }; this.context = null; this.timer = null;
      this.factory = options.contextFactory || (() => { const Audio = root.AudioContext || root.webkitAudioContext; return Audio ? new Audio() : null; });
      this.onChange = options.onChange || (() => {}); this.step = 0; this.paused = false;
    }
    configure(settings) {
      for (const key of ['musicOn','effectsOn']) if (typeof settings[key] === 'boolean') this.settings[key] = settings[key];
      for (const key of ['music','effects']) if (settings[key] !== undefined) this.settings[key] = clamp(settings[key], DEFAULTS[key]);
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
      this.musicGain.gain.setTargetAtTime(!this.paused && this.settings.musicOn ? this.settings.music : 0, now, .08);
      this.effectsGain.gain.setTargetAtTime(!this.paused && this.settings.effectsOn ? this.settings.effects : 0, now, .025);
      const shouldPlay = this.context.state === 'running' && !this.paused && this.settings.musicOn && this.settings.music > 0;
      if (shouldPlay && !this.timer) { this.next = now + .05; this.schedule(); this.timer = setInterval(() => this.schedule(), 150); }
      if (!shouldPlay && this.timer) { clearInterval(this.timer); this.timer = null; }
    }
    pause(value) { this.paused = value; this.apply(); }
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
      const beat = 60 / 76, ctx = this.context;
      if (this.next < ctx.currentTime) this.next = ctx.currentTime + .03;
      while (this.next < ctx.currentTime + .35) {
        const bar = Math.floor(this.step / 8) % 8, slot = this.step % 8, at = this.next;
        if (slot === 0) {
          this.tone(chords[bar][0], at, beat*3.5, .11, this.musicGain, 'sine');
          chords[bar].slice(1).forEach((note,index)=>this.tone(note,at+.04*index,beat*3.8,.045,this.musicGain,'sine',(index-1)*.35,true));
        }
        const note = melody[bar][slot];
        if (note !== null) { this.tone(note,at,1.15,.13,this.musicGain,'sine',slot%2?.18:-.18); this.tone(note+12,at,.65,.017,this.musicGain,'sine'); }
        this.step++; this.next += beat/2;
      }
    }
    effect(kind, step = 0) {
      if (!this.context || this.context.state !== 'running' || this.paused || !this.settings.effectsOn || !this.settings.effects) return;
      const ctx=this.context, at=ctx.currentTime;
      if (kind === 'roll') {
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
    stop() { if(this.timer)clearInterval(this.timer);this.timer=null;this.context?.close?.();this.context=null; }
  }
  return { Engine, DEFAULTS };
});
