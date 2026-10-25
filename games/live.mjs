// Receive-only state push; authenticated HTTP remains authoritative for actions.
export class LiveMatch {
 constructor({id,api,onState,onChange}) {
  Object.assign(this,{id,api,onState,onChange});
  this.stopped=false;this.ready=false;this.delay=1000;this.generation=0;
  this.status='connecting';
  this.resume=()=>{
   if(this.stopped||document.visibilityState==='hidden')return;
   if(!this.ready||Date.now()-this.lastReceived>=45000){this.restart();return;}
   if(this.socket?.readyState===1)try{this.socket.send(JSON.stringify({type:'sync'}));}catch{this.failed();}
  };
  this.offline=()=>{if(!this.stopped){this.retire();this.change('offline');}};
  window.addEventListener('online',this.resume);
  window.addEventListener('offline',this.offline);
  document.addEventListener('visibilitychange',this.resume);
  this.connect();
 }
 get statusText(){return {live:'● مباشر',offline:'الإنترنت مقطوع • بانتظار رجوع الاتصال',connecting:'جاري الاتصال المباشر…',retrying:'↻ تحديث احتياطي • نعيد الاتصال',stopped:'انتهى الاتصال'}[this.status];}
 change(status){this.status=status;this.ready=status==='live';this.onChange?.();}
 retire(){
  ++this.generation;clearTimeout(this.timer);clearTimeout(this.watch);clearInterval(this.beat);
  const s=this.socket;this.socket=null;this.ready=false;
  if(s){s.onopen=s.onmessage=s.onerror=s.onclose=null;try{s.close();}catch{}}
 }
 restart(){this.retire();this.delay=1000;this.connect();}
 async connect(){
  if(this.stopped)return;
  if(window.navigator?.onLine===false){this.change('offline');return;}
  const generation=++this.generation;
  const current=()=>!this.stopped&&generation===this.generation;
  this.change('connecting');
  try{
   const {ticket}=await this.api({action:'live-ticket',id:this.id});
   if(!current())return;
   if(!ticket)throw Error('No ticket');
   const url=new URL('/game-live',window.LAMMA_VOICE_ENDPOINT);
   url.protocol=url.protocol==='https:'?'wss:':'ws:';
   url.searchParams.set('id',this.id);url.searchParams.set('ticket',ticket);
   const s=this.socket=new WebSocket(url);
   // The connection is live only after a valid match snapshot, not just an open socket.
   this.watch=setTimeout(()=>{if(current())this.failed();},12000);
   s.onopen=()=>{
    if(!current())return;
    this.lastReceived=Date.now();
    this.beat=setInterval(()=>{
     if(!current())return;
     if(Date.now()-this.lastReceived>=45000){this.failed();return;}
     if(s.readyState===1){try{s.send(JSON.stringify({type:'sync'}));}catch{this.failed();}}
    },20000);
   };
   s.onmessage=e=>{
    if(!current())return;
    let m;try{m=JSON.parse(e.data);}catch{return;}
    if(m.type!=='state'||m.data?.id!==this.id)return;
    this.lastReceived=Date.now();clearTimeout(this.watch);this.delay=1000;
    if(!this.ready)this.change('live');
    this.onState(m.data);
   };
   s.onerror=s.onclose=()=>{if(current())this.failed();};
  }catch{if(current())this.failed();}
 }
 failed(){
  this.retire();if(this.stopped)return;
  if(window.navigator?.onLine===false){this.change('offline');return;}
  this.change('retrying');this.timer=setTimeout(()=>this.connect(),this.delay);
  this.delay=Math.min(30000,this.delay*2);
 }
 stop(){
  if(this.stopped)return;this.stopped=true;this.retire();this.status='stopped';
  window.removeEventListener('online',this.resume);window.removeEventListener('offline',this.offline);
  document.removeEventListener('visibilitychange',this.resume);
 }
}
