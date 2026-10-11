(function () {
  'use strict';
  const {Room}=window.RoomRules, config=window.LUDO_LADDER_CONFIG;
  const hostAlias='ludo-ladder-host', guestAlias='ludo-ladder-guest';
  function randomString(length){const bytes=crypto.getRandomValues(new Uint8Array(length));return [...bytes].map(byte=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte%32]).join('');}
  function dice(){const value=new Uint8Array(1);do{crypto.getRandomValues(value);}while(value[0]>=252);return value[0]%6+1;}
  function seat(code){
    try{const value=JSON.parse(sessionStorage.getItem('rt-seat-'+code));if(value?.id && value?.secret)return value;}catch{/* Storage is optional. */}
    const value={id:crypto.randomUUID(),secret:crypto.randomUUID()+crypto.randomUUID()};
    try{sessionStorage.setItem('rt-seat-'+code,JSON.stringify(value));}catch{/* A fresh seat still works. */}return value;
  }
  function validCode(value){return /^[A-HJ-NP-Z2-9]{6}$/.test(value);}
  class Connection {
    constructor(onState,onStatus){
      this.onState=onState;this.onStatus=onStatus;this.state=null;this.host=null;this.relay=null;this.id=null;
      this.connections=new Map();this.bindings=new Map();this.proofs=new Map();this.requests=new Map();this.local=false;this.disposed=false;this.connected=false;
    }
    announce(text,tone='info'){this.onStatus(text,tone);}
    setState(state){if(!state || state.code!==this.code || !Array.isArray(state.players) || (this.state && state.version<this.state.version))return;this.state=state;this.onState(state);}
    send(data,uid){if(!this.connected || this.disposed)throw new Error('Room disconnected. Use Reconnect.');this.relay.send({...data,code:this.code},uid);}
    broadcast(){const state=this.host.snapshot();this.setState(this.connected||this.local?state:{...state,connectionLost:true});if(this.connected)for(const [id,uid]of this.connections)this.send({kind:'state',state,proof:this.proofs.get(id)},uid);}
    rejectRequests(error){for(const request of this.requests.values())request.reject(error);this.requests.clear();}
    async openRelay(){
      if(!window.LudoRelay)throw new Error('The connection library did not load. Please reload.');
      const relay=window.LudoRelay.connect(config.roomPrefix+this.code,{as:this.host?hostAlias:guestAlias,announce:true,list:true});
      this.relay=relay;
      return new Promise((resolve,reject)=>{
        let opened=false;const timer=setTimeout(()=>{reject(new Error('The connection service took too long to respond. Try again shortly.'));relay.close();},18000);
        relay.on('join',event=>{
          if(this.relay!==relay || this.disposed)return;
          if(event.self){
            opened=true;clearTimeout(timer);this.connected=true;this.uid=event.uid;
            const hosts=(event.users||[]).filter(user=>user.uid!==this.uid && user.alias===hostAlias);
            if(this.host && hosts.length && !this.state){reject(new Error('This room code is already in use. Create another room.'));return;}
            if(!this.host){if(hosts.length!==1){reject(new Error('Room not found. Check the code and ask the host to keep their tab open.'));return;}this.hostUid=hosts[0].uid;}
            else if(this.state){
              const present=new Set((event.users||[]).map(user=>user.uid));
              for(const [id,uid]of this.connections){if(!present.has(uid)){this.connections.delete(id);this.bindings.delete(uid);this.host.disconnect(id);}else this.send({kind:'host-return',hostId:this.id,proof:this.proofs.get(id)},uid);}
              this.broadcast();
            }
            resolve();
          }
        });
        relay.on('message',event=>{if(this.relay===relay && !this.disposed)this.receive(event);});
        relay.on('leave',event=>{
          if(this.relay!==relay || this.disposed)return;
          if(this.host){const id=this.bindings.get(event.uid);if(id && this.connections.get(id)===event.uid){this.connections.delete(id);this.bindings.delete(event.uid);this.host.disconnect(id);this.broadcast();}}
          else if(event.uid===this.hostUid && this.state){this.setState({...this.state,connectionLost:true});this.announce('The host disconnected. Keep this tab open while they reconnect.','bad');}
        });
        relay.on('error',event=>{const error=new Error(String(event.message||'The connection service is unavailable. Try again shortly.'));if(!opened){clearTimeout(timer);reject(error);}else this.announce(error.message,'bad');});
        relay.on('close',()=>{
          clearTimeout(timer);if(this.relay!==relay)return;this.connected=false;
          const error=new Error('Room connection lost. Use Reconnect.');reject(error);this.rejectRequests(error);
          if(!this.disposed && this.state){this.setState({...this.state,connectionLost:true});this.announce(error.message,'bad');}
        });
      });
    }
    receive(event){
      const data=event.message, uid=event.uid;
      if(!uid || !data || typeof data!=='object' || data.code!==this.code || JSON.stringify(data).length>8000)return;
      if(this.host){
        try{
          if(data.kind==='join'){
            if(data.identity?.id===this.id)throw new Error('This seat belongs to the host. Use a separate browser tab for your friend.');
            const oldId=this.bindings.get(uid);if(oldId && oldId!==data.identity?.id)throw new Error('This connection already has a seat.');
            const guest=this.host.join({...data.identity,name:data.name});
            const previous=this.connections.get(guest.id);
            if(previous && previous!==uid){this.bindings.delete(previous);this.send({kind:'closed',message:'Your seat was reconnected in another tab.'},previous);}
            this.connections.set(guest.id,uid);this.bindings.set(uid,guest.id);if(!this.proofs.has(guest.id))this.proofs.set(guest.id,crypto.randomUUID()+crypto.randomUUID());this.broadcast();this.send({kind:'ack',request:data.request},uid);
          }else if(data.kind==='command'){
            const id=this.bindings.get(uid);if(!id)throw new Error('Join the room first.');
            this.host.command(id,data.command);this.broadcast();this.send({kind:'ack',request:data.request},uid);
          }else if(data.kind==='leave'){
            const id=this.bindings.get(uid);if(id){this.bindings.delete(uid);this.connections.delete(id);this.host.disconnect(id,true);this.broadcast();}
          }
        }catch(error){this.send({kind:'error',request:data.request||null,message:error.message},uid);}
      }else{
        if(data.kind==='host-return' && this.state?.connectionLost && data.hostId===this.state.hostId && data.proof===this.hostProof && event.alias===hostAlias){this.hostUid=uid;this.request({kind:'join',name:this.name,identity:this.identity}).then(()=>this.announce('Connected','good')).catch(error=>this.announce(error.message,'bad'));return;}
        if(uid!==this.hostUid)return;
        if(data.kind==='state'){if(!this.hostProof)this.hostProof=data.proof;if(data.proof!==this.hostProof)return;this.setState(data.state);if(!data.state.connectionLost)this.announce('Connected','good');}
        else if(data.kind==='ack'){this.requests.get(data.request)?.resolve();this.requests.delete(data.request);}
        else if(data.kind==='error'){const error=new Error(String(data.message||'The action could not be completed.'));if(this.requests.has(data.request)){this.requests.get(data.request).reject(error);this.requests.delete(data.request);}else this.announce(error.message,'bad');}
        else if(data.kind==='closed'){this.disposed=true;this.announce(data.message||'The host closed this room.','bad');if(this.state)this.setState({...this.state,connectionLost:true});this.rejectRequests(new Error('Room closed.'));this.relay.close();}
      }
    }
    request(data){
      if(!this.connected || this.disposed)return Promise.reject(new Error('Room disconnected. Use Reconnect.'));
      const request=crypto.randomUUID();return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{this.requests.delete(request);reject(new Error('The host did not respond. Ask them to keep their tab open and try reconnecting.'));},8000);
        this.requests.set(request,{resolve:()=>{clearTimeout(timer);resolve();},reject:error=>{clearTimeout(timer);reject(error);}});
        this.send({...data,request},this.hostUid);
      });
    }
    async create(type,capacity,name,local=false){
      this.local=local;this.name=name;this.code=local?'LOCAL':randomString(6);this.identity=seat(this.code);this.id=this.identity.id;
      this.host=new Room({code:this.code,type,capacity,name,hostId:this.id,secret:this.identity.secret,dice});
      if(local){for(let index=1;index<capacity;index++){const guest=this.host.join({id:crypto.randomUUID(),name:'Player '+(index+1),secret:crypto.randomUUID()});guest.ready=true;}this.host.command(this.id,{type:'start',version:this.host.version});this.broadcast();return;}
      await this.openRelay();this.broadcast();this.announce('Room open. Invite your friends.','good');
    }
    async join(code,name){
      if(!validCode(code))throw new Error('Enter the six-character room code.');this.code=code;this.name=name;this.identity=seat(code);this.id=this.identity.id;
      await this.openRelay();await this.request({kind:'join',name,identity:this.identity});this.announce('Connected','good');
    }
    async reconnect(){
      if(this.local || this.disposed)return;
      const previous=this.relay;this.relay=null;this.connected=false;this.rejectRequests(new Error('Reconnecting. Try your action again once connected.'));previous?.close();
      await this.openRelay();if(this.host)this.broadcast();else await this.request({kind:'join',name:this.name,identity:this.identity});this.announce('Connected','good');
    }
    async command(command){
      if(!this.state || this.disposed || this.state.connectionLost || (!this.local && !this.connected))throw new Error('Join a connected room first.');
      command={...command,version:this.state.version};
      if(this.host){
        const actor=this.local && this.host.game && ['roll','move'].includes(command.type)?window.BoardRules.current(this.host.game).id:this.id;
        this.host.command(actor,command);
        if(command.type==='remove'){const uid=this.connections.get(command.player);this.connections.delete(command.player);this.bindings.delete(uid);this.proofs.delete(command.player);if(uid)this.send({kind:'closed',message:'The host removed your seat from the lobby.'},uid);}
        this.broadcast();return;
      }
      await this.request({kind:'command',command});
    }
    close(){
      if(this.connected && !this.disposed){if(this.host){for(const uid of this.connections.values())this.send({kind:'closed',message:'The host closed this room. Create or join another room.'},uid);}else if(this.hostUid)this.send({kind:'leave'},this.hostUid);}
      this.disposed=true;this.relay?.close();this.rejectRequests(new Error('Room closed.'));
    }
  }
  window.RoomNetwork={Connection,dice,validCode};
})();
