(function(root,factory){
  const api=factory(root);
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GameCommentary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  function events(before,game){
    const action=game?.action;
    if(!before || !action || before.type!==game.type || action.id===before.action?.id)return [];
    const actor=game.players.find(player=>player.id===action.player),name=actor?.name||'Player';
    const line=(kind,mood,text,effect=null,timing='arrival')=>[{kind,mood,text,effect,timing}];
    if(action.type==='ludo-move'){
      if(game.winner)return line('win','celebrate',`Champion! ${name} takes the table!`,'finish');
      if(action.to===56)return line('finish','proud',`Home sweet home! ${name} brings one home.`,'finish');
      if(action.captured?.length){
        const victims=[...new Set(action.captured.map(item=>game.players.find(player=>player.id===item.player)?.name).filter(Boolean))];
        return line('capture','surprise',`Oh no! ${victims.join(' and ')} got caught. ${name} gets a bonus!`,'capture');
      }
      if(action.from===-1)return line('release','celebrate',`Hurrah, we're out! ${name}'s token joins the race!`,'release');
      return line('move','happy',action.id%2?`Nice! ${name} moves ${action.die} steps.`:`${name} is making a run for home!`);
    }
    if(action.type==='snakes-move'){
      if(game.winner)return line('win','celebrate',`Square 100! ${name} takes the crown!`,'finish');
      if(action.jump==='ladder')return line('ladder','celebrate',`Up we go! A lucky ladder for ${name}!`);
      if(action.jump==='snake')return line('snake','surprise',`Oh no, a sneaky snake! Hang in there, ${name}.`);
      return line('move','happy',`${name} lands on ${action.to}. The race is on!`);
    }
    if(action.type==='roll'){
      if(action.die===6 && game.pending)return line('six','celebrate',`Hurrah! A six for ${name}!`,null,'roll');
      if(!game.pending)return line('miss','thinking',action.note.includes('three')?`Three sixes! Luck needs a little break, ${name}.`:`No move this time, ${name}. Your chance is coming!`,null,'roll');
      return line('roll','happy',`A ${action.die} for ${name}. Pick your next adventure!`,null,'roll');
    }
    return [];
  }
  class Speaker {
    constructor(options={}){
      this.synth=options.synth||root.speechSynthesis;this.Utterance=options.Utterance||root.SpeechSynthesisUtterance;
      this.onChange=options.onChange||(()=>{});this.enabled=true;this.unlocked=false;
      this.changed=()=>this.refresh();this.synth?.addEventListener?.('voiceschanged',this.changed);this.refresh();
    }
    refresh(){
      const voices=this.synth?.getVoices?.()||[];
      this.voice=voices.find(voice=>voice.localService===true && /^en(?:-|$)/i.test(voice.lang));
      this.onChange({available:!!this.voice && !!this.Utterance,enabled:this.enabled});
    }
    unlock(){this.unlocked=true;if(!this.voice)this.refresh();}
    configure(enabled){this.enabled=!!enabled;if(!this.enabled)this.cancel();this.refresh();}
    say(text,volume=.6){
      if(!this.enabled || !this.unlocked || !this.voice || !this.Utterance || !volume)return false;
      this.cancel();const message=new this.Utterance(text);message.voice=this.voice;message.lang=this.voice.lang;message.rate=1.06;message.pitch=1.08;message.volume=Math.max(0,Math.min(1,volume));
      try{this.synth.speak(message);return true;}catch(_){return false;}
    }
    cancel(){this.synth?.cancel?.();}
    stop(){this.cancel();this.synth?.removeEventListener?.('voiceschanged',this.changed);}
  }
  return {events,Speaker};
});
