(function(root,factory){
  const api=factory(root);
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GameCommentary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const pick=(lines,id)=>lines[Math.floor(Math.max(1,id)/2)%lines.length];
  function events(before,game){
    const action=game?.action;
    if(!before || !action || before.type!==game.type || action.id===before.action?.id)return [];
    const actor=game.players.find(player=>player.id===action.player);
    const line=(kind,mood,text,effect=null,timing='arrival')=>[{kind,mood,text,effect,timing}];
    const joke=lines=>pick(lines,action.id);
    if(action.snakeShift && !game.winner)return line('snake-shift','surprise',joke(action.snakeShift.players.length?['Ssssurprise! The snake moved under somebody. HOLD ON!','Moving mouth! That was absolutely NOT a safe parking spot!','Oh NO! A snake just changed lanes. Slide incoming!']:['Plot twist! That snake has changed its address!','Sssneaky! New mouth, same terrible manners!','The snake has entered relocation mode. Watch your feet!']),'head-shift','shift');
    if(action.type==='ludo-move'){
      if(game.winner)return line('win','celebrate',joke(['Game, set, Ludo! Bragging rights SECURED!','CHAMPION! Take a bow. Everyone else, demand a rematch!','Crown secured! Please celebrate responsibly. Or loudly.']),'win');
      if(action.to===56){
        const remaining=actor.tokens.filter(token=>token!==56).length;
        return line('finish','proud',joke([`HOME! That token has clocked out. ${remaining} more to go!`,'Safe at last! Shoes off, bragging rights on!','Touchdown! The VIP lounge is this way!']),'finish');
      }
      if(action.captured?.length){
        return line('capture','surprise',joke(['OOOF! Express delivery back to the sofa!','Plot twist! Somebody is going back to the dressing room!','Caught in 4K! That token is going HOME!','BONK! Those travel plans have been cancelled!']),'capture');
      }
      if(action.from===-1)return line('release','celebrate',joke(['Hurrah! A tiny champion has escaped the sofa!','Fresh token. Big attitude. Main-character energy!','We are OUT! Fashionably late. Dangerously confident!','Release the tiny champion! Let us cause some trouble!']),'release');
      const rivals=game.players.filter(player=>player.id!==actor.id);
      const lastToken=actor.tokens.filter(token=>token!==56).length===1;
      if(lastToken && action.from<53 && action.to>=53 && rivals.some(player=>player.tokens.filter(token=>token===56).length===3 && player.tokens.some(token=>token>=51 && token<56)))
        return line('showdown','surprise','PHOTO FINISH! One tiny token from glory. Nobody blink!','tension');
      if(action.from<51 && action.to>=51)return line('home-stretch','proud',joke(['Final corridor! Somebody can smell the snacks at home!','Almost home! Do not trip on the welcome mat!','Home stretch! Better check that victory dance!']),'tension');
      return [];
    }
    if(action.type==='snakes-move'){
      if(game.winner)return line('win','celebrate',joke(['ONE HUNDRED! The snakes want a rematch!','CROWN SECURED! Beat the snakes AND the odds!','Top floor! Somebody bring the confetti!']),'win');
      if(action.jump==='ladder')return line('ladder','celebrate',joke(action.to-action.landing>=30?['ROCKET MODE! That is the ladder to first class!','Who needs stairs? A giant upgrade just landed!','Going UP! Express elevator, no queues!']:['Wheee! A ladder! Leg day cancelled!','A free upgrade! No boarding pass required!','UP WE GO! Climbing the social ladder!']),'ladder','jump');
      if(action.jump==='snake')return line('snake','surprise',joke(action.landing-action.to>=30?['PENTHOUSE TO BASEMENT! Nobody ordered THAT slide!','Oh NO! This snake has absolutely no chill!','Sssssurprise! The scenic route, but backwards!']:['SNAKE ATTACK! Please stop feeding the wildlife!','Who greased the board? Reverse gear, activated!','Oh no! That snake has terrible manners!']),'snake','jump');
      if(action.from===0)return line('race-start','celebrate',joke(['And we are OFF! Do not pet the snakes!','Welcome to the jungle. The ladders look friendly. The snakes? Debatable.','New challenger! Keep those snacks away from the snakes!']),'race-start');
      const rivalPositions=game.players.filter(player=>player.id!==actor.id).map(player=>player.tokens[0]),leader=Math.max(...rivalPositions);
      if(leader>=80 && action.from<=leader && action.to>leader)return line('lead-change','surprise','LEAD STOLEN! Somebody jumped the queue. Nobody blink!','tension');
      if(action.from<90 && action.to>=90)return line('near-finish','proud',joke(['SO CLOSE! Tiptoe past those snakes!','The finish line is waving! Hold your nerve!','Final stretch! Save that victory dance for 100!']),'tension');
      return [];
    }
    if(action.type==='roll'){
      if(game.type==='ludo' && action.note.includes('three sixes'))return line('triple-six','surprise','Three sixes?! The dice have GROUNDED you!','tension','roll');
      return [];
    }
    return [];
  }
  function schedule(events,motions,{lead=0,reduced=false}={}){
    const primary=motions.find(motion=>motion.primary),arrival=reduced?0:lead+(primary?.duration||0);
    let jump=arrival;
    if(primary && !reduced){const index=primary.segments.findIndex(segment=>segment.highlight);if(index>=0)jump=lead+primary.segments.slice(0,index).reduce((total,segment)=>total+segment.duration,0);}
    const shift=motions.find(motion=>motion.kind==='snake-shift');
    return events.map(event=>({...event,delay:reduced?0:event.timing==='shift'?lead+(shift?.delay||0):event.timing==='roll'?lead:event.timing==='jump'?jump:arrival}));
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
      this.cancel();const message=new this.Utterance(text);message.voice=this.voice;message.lang=this.voice.lang;message.rate=mood==='celebrate'?1.28:1.22;message.pitch=mood==='celebrate'?1.26:1.2;message.volume=Math.max(0,Math.min(1,volume));
      try{this.synth.speak(message);return true;}catch(_){return false;}
    }
    cancel(){this.synth?.cancel?.();}
    stop(){this.cancel();this.synth?.removeEventListener?.('voiceschanged',this.changed);}
  }
  return {events,schedule,Speaker};
});
