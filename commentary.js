(function(root,factory){
  const api=factory(root);
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GameCommentary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const pick=(lines,id)=>lines[(Math.max(1,id)-1)%lines.length];
  function events(before,game){
    const action=game?.action;
    if(!before || !action || before.type!==game.type || action.id===before.action?.id)return [];
    const actor=game.players.find(player=>player.id===action.player),name=actor?.name||'Player';
    const line=(kind,mood,text,effect=null,timing='arrival')=>[{kind,mood,text,effect,timing}];
    const joke=lines=>pick(lines,action.id);
    if(action.type==='ludo-move'){
      if(game.winner)return line('win','celebrate',joke([`Game, set, Ludo! ${name} owns the bragging rights!`,`CHAMPION! ${name}, take a bow. Everyone else, demand a rematch!`,`The crown goes to ${name}! Please celebrate responsibly. Or loudly.`]),'win');
      if(action.to===56){
        const remaining=actor.tokens.filter(token=>token!==56).length;
        return line('finish','proud',joke([`HOME! ${name}'s token has clocked out. ${remaining} more to go!`,`Safe at last! ${name}'s token is putting its feet up!`,`Touchdown! ${name} parks another token in the VIP lounge!`]),'finish');
      }
      if(action.captured?.length){
        const victims=[...new Set(action.captured.map(item=>game.players.find(player=>player.id===item.player)?.name).filter(Boolean))];
        const victim=victims.join(' and ')||'That token';
        return line('capture','surprise',joke([`OOOF! ${victim}, express delivery back to the sofa!`,`Plot twist! ${name} sends ${victim} back to the dressing room!`,`Oh no! ${victim} got caught. ${name} chose chaos!`,`BONK! ${name} just cancelled ${victim}'s travel plans!`]),'capture');
      }
      if(action.from===-1)return line('release','celebrate',joke([`Hurrah! ${name}'s token has escaped the sofa!`,`Fresh token, big attitude! ${name} has entered the chat!`,`We're OUT! ${name}'s token is late, but dressed to win!`,`Release the tiny champion! ${name}, make some trouble!`]),'release');
      const rivals=game.players.filter(player=>player.id!==actor.id);
      const lastToken=actor.tokens.filter(token=>token!==56).length===1;
      if(lastToken && action.from<53 && action.to>=53 && rivals.some(player=>player.tokens.filter(token=>token===56).length===3 && player.tokens.some(token=>token>=51 && token<56)))
        return line('showdown','surprise',`PHOTO FINISH! ${name} is one tiny token from glory!`,'tension');
      if(action.from<51 && action.to>=51)return line('home-stretch','proud',joke([`Final corridor! ${name}'s token can smell the snacks at home!`,`Almost home! ${name}, don't trip on the welcome mat!`,`The home stretch! ${name}'s token is checking its victory dance!`]),'tension');
      return [];
    }
    if(action.type==='snakes-move'){
      if(game.winner)return line('win','celebrate',joke([`ONE HUNDRED! ${name} wins! The snakes want a rematch!`,`CROWN SECURED! ${name} beat the snakes and the odds!`,`Top floor! ${name} wins. Somebody bring the confetti!`]),'win');
      if(action.jump==='ladder')return line('ladder','celebrate',joke(action.to-action.landing>=30?[`ROCKET MODE! ${name} found the ladder to first class!`,`Who needs stairs? ${name} just booked a giant upgrade!`,`Going UP! ${name} took the express elevator!`]:[`Wheee! ${name} found a ladder. Leg day cancelled!`,`A free upgrade for ${name}! No boarding pass required!`,`UP WE GO! ${name} is climbing the social ladder!`]),'ladder','jump');
      if(action.jump==='snake')return line('snake','surprise',joke(action.landing-action.to>=30?[`PENTHOUSE TO BASEMENT! ${name} did NOT order that slide!`,`Oh NO! ${name}'s snake has absolutely no chill!`,`Sssssurprise! ${name} just got the scenic route backwards!`]:[`SNAKE ATTACK! ${name}, please stop feeding the wildlife!`,`Who greased the board? ${name} is sliding backwards!`,`Oh no! ${name} found a snake with terrible manners!`]),'snake','jump');
      if(action.from===0)return line('race-start','celebrate',joke([`And we're OFF! ${name}, don't pet the snakes!`,`${name} joins the jungle! The ladders look friendly. The snakes? Debatable.`,`New challenger! ${name}, keep your snacks away from the snakes!`]),'race-start');
      const rivalPositions=game.players.filter(player=>player.id!==actor.id).map(player=>player.tokens[0]),leader=Math.max(...rivalPositions);
      if(leader>=80 && action.from<=leader && action.to>leader)return line('lead-change','surprise',`LEAD STOLEN! ${name} just overtook the table. Nobody blink!`,'tension');
      if(action.from<90 && action.to>=90)return line('near-finish','proud',joke([`SO CLOSE! ${name}, tiptoe past the snakes!`,`The finish line is waving! ${name}, hold your nerve!`,`Final stretch! ${name}, save the victory dance for 100!`]),'tension');
      return [];
    }
    if(action.type==='roll'){
      if(game.type==='ludo' && action.note.includes('three sixes'))return line('triple-six','surprise',`Three sixes?! ${name}, the dice have grounded you!`,'tension','roll');
      return [];
    }
    return [];
  }
  function schedule(events,motions,{lead=0,reduced=false}={}){
    const primary=motions.find(motion=>motion.primary),arrival=reduced?0:lead+(primary?.duration||0);
    let jump=arrival;
    if(primary && !reduced){const index=primary.segments.findIndex(segment=>segment.highlight);if(index>=0)jump=lead+primary.segments.slice(0,index).reduce((total,segment)=>total+segment.duration,0);}
    return events.map(event=>({...event,delay:reduced?0:event.timing==='roll'?lead:event.timing==='jump'?jump:arrival}));
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
    say(text,volume=.6,mood='happy'){
      if(!this.enabled || !this.unlocked || !this.voice || !this.Utterance || !volume)return false;
      this.cancel();const message=new this.Utterance(text);message.voice=this.voice;message.lang=this.voice.lang;message.rate=mood==='celebrate'?1.15:mood==='surprise'?1.09:1.1;message.pitch=mood==='celebrate'?1.16:mood==='surprise'?1.1:1.12;message.volume=Math.max(0,Math.min(1,volume));
      try{this.synth.speak(message);return true;}catch(_){return false;}
    }
    cancel(){this.synth?.cancel?.();}
    stop(){this.cancel();this.synth?.removeEventListener?.('voiceschanged',this.changed);}
  }
  return {events,schedule,Speaker};
});
