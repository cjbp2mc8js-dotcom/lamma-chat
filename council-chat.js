/* Council text chat owns its admission lease independently of Agora audio. */
function councilChatMessageId(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
class CouncilChat {
 constructor({user,session,roomId,endpoint,ui,fetcher=fetch}){
  Object.assign(this,{user,roomId,endpoint,ui,fetcher});this.externalSession=!!session;this.session=session||(()=>this.admitted?this.admission:null);
  this.active=false;this.epoch=0;this.controllers=new Set();this.retry=null;this.sending=false;this.revision=0;this.admitted=false;this.admission=null;
  this.visible=()=>{clearTimeout(this.timer);if(document.visibilityState==='visible'){if(!this.externalSession&&!this.admitted)this.admit();else this.refresh();}};
 }
 start(){if(this.active)return;this.active=true;this.epoch++;document.addEventListener('visibilitychange',this.visible);if(this.externalSession)this.refresh();else this.admit();}
 stop(){
  const lease=this.admission;this.active=false;this.epoch++;this.admitted=false;this.admission=null;this.sending=false;
  for(const timer of [this.timer,this.admitTimer,this.renewTimer])clearTimeout(timer);
  document.removeEventListener('visibilitychange',this.visible);for(const c of this.controllers)c.abort();this.controllers.clear();this.ui({ready:false,sending:false});
  if(lease)this.request('leave',{}, {voice:true,lease}).catch(()=>{});
 }
 errorText(e){if(e?.name==='AbortError')return 'تأخر الاتصال؛ رسالتك باقية، حاول مرة ثانية';if(e instanceof TypeError)return 'تعذر الاتصال بالإنترنت؛ رسالتك باقية';return e?.message||'تعذر الإرسال؛ رسالتك باقية حتى تعيد المحاولة';}
 async request(action,extra={},options={}){
  const user=this.user(),session=options.lease||this.session();if(!user||!session)throw Error('انتظر اتصال الدردشة');
  const controller=new AbortController();this.controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const token=await user.getIdToken();if(controller.signal.aborted)throw new DOMException('انتهى الطلب','AbortError');
   const endpoint=options.voice?new URL('/voice-token',this.endpoint()).href:this.endpoint();
   const r=await this.fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...session,...extra}),signal:controller.signal});
   let data;try{data=await r.json();}catch{throw Error('تعذر قراءة رد الدردشة؛ حاول مرة ثانية');}
   if(!r.ok)throw Object.assign(Error(data.error||'تعذر الاتصال بالدردشة'),{status:r.status});
   if(!options.voice&&!Array.isArray(data.messages))throw Error('رد الدردشة غير مكتمل؛ رسالتك باقية، حاول مرة ثانية');
   return data;
  }finally{clearTimeout(timeout);this.controllers.delete(controller);}
 }
 async admit(){
  if(!this.active||this.externalSession||this.admitting===this.epoch)return;
  clearTimeout(this.admitTimer);const epoch=this.epoch;this.admitting=epoch;this.ui({ready:false,status:'جاري اتصال الدردشة…'});
  try{
   const lease={roomId:this.roomId,sessionId:councilChatMessageId()};this.admission=lease;
   await this.request('join',{}, {voice:true,lease});if(!this.active||epoch!==this.epoch)return;
   this.admitted=true;this.ui({ready:true,status:''});this.scheduleRenew(epoch);this.refresh();
  }catch(e){if(this.active&&epoch===this.epoch){this.admitted=false;this.ui({ready:false,status:this.errorText(e)});this.admitTimer=setTimeout(()=>this.admit(),10000);}}
  finally{if(this.admitting===epoch)this.admitting=null;}
 }
 scheduleRenew(epoch,delay=280000){clearTimeout(this.renewTimer);this.renewTimer=setTimeout(()=>this.renew(epoch),delay);}
 async renew(epoch){
  if(!this.active||epoch!==this.epoch||!this.admission)return;
  try{await this.request('renew',{}, {voice:true,lease:this.admission});if(this.active&&epoch===this.epoch)this.scheduleRenew(epoch);}
  catch(e){if(!this.active||epoch!==this.epoch)return;if(e.status===401||e.status===403){this.admitted=false;this.admit();}else this.scheduleRenew(epoch,10000);}
 }
 async refresh(){
  clearTimeout(this.timer);if(!this.active||this.polling===this.epoch||document.visibilityState==='hidden')return;
  const epoch=this.epoch,revision=this.revision;this.polling=epoch;let delay=3000;
  try{
   if(!this.session()){this.ui({ready:false,status:'جاري اتصال الدردشة…'});return;}
   const data=await this.request('list');if(this.active&&epoch===this.epoch&&revision===this.revision)this.ui({ready:true,messages:data.messages,status:''});
  }catch(e){
   delay=10000;if(this.active&&epoch===this.epoch){this.ui({status:this.errorText(e)});if(!this.externalSession&&(e.status===401||e.status===403)){this.admitted=false;this.admit();}}
  }finally{if(this.polling===epoch)this.polling=null;if(this.active&&epoch===this.epoch)this.timer=setTimeout(()=>this.refresh(),delay);}
 }
 async send(text,name){
  text=String(text).trim();if(this.sending)return false;
  if(!text||text.length>500){this.ui({sendStatus:'اكتب رسالة من حرف إلى ٥٠٠ حرف'});return false;}
  if(!this.active||!this.session()){this.ui({sendStatus:'الدردشة بعد ما اتصلت؛ انتظر لحظة وحاول مجدداً'});if(this.active&&!this.externalSession)this.admit();return false;}
  const epoch=this.epoch;this.sending=true;this.revision++;this.ui({sending:true,sendStatus:'جاري الإرسال…'});
  try{
   if(!this.retry||this.retry.text!==text)this.retry={text,messageId:councilChatMessageId()};
   const data=await this.request('send',{...this.retry,name:String(name||'عضو').slice(0,35)});if(!this.active||epoch!==this.epoch)return false;
   this.retry=null;this.revision++;this.ui({messages:data.messages,sendStatus:'تم الإرسال'});return true;
  }catch(e){if(this.active&&epoch===this.epoch){this.ui({sendStatus:this.errorText(e)});if(!this.externalSession&&(e.status===401||e.status===403)){this.admitted=false;this.admit();}}return false;}
  finally{if(epoch===this.epoch){this.sending=false;this.ui({sending:false});}}
 }
}
if(typeof module!=='undefined')module.exports={CouncilChat,councilChatMessageId};
