/* In-council voice. Never stores certificates or RTC tokens. */
class RoyalVoice {
 constructor({sdk,token,user,ui}) { Object.assign(this,{sdk,token,user,ui}); this.queue=Promise.resolve();this.epoch=0;this.client=null;this.track=null;this.session=null;this.muted=false;this.timer=null; }
 serial(fn){const p=this.queue.then(fn);this.queue=p.catch(()=>{});return p;}
 async cleanup(){clearInterval(this.timer);this.timer=null;const track=this.track;this.track=null;if(track){track.stop();track.close();}const client=this.client;this.client=null;if(client){try{await client.leave();}catch{}client.removeAllListeners();}const session=this.session;this.session=null;if(session){try{await this.token('leave',session);}catch{}}this.ui({connected:false,speaking:false,users:[]});}
 join(roomId){const epoch=++this.epoch;return this.serial(async()=>{await this.cleanup();try{const sdk=await this.sdk();if(epoch!==this.epoch)return;const session={roomId,sessionId:crypto.randomUUID()};this.session=session;const data=await this.token('join',session);if(epoch!==this.epoch){await this.cleanup();return;}const c=sdk.createClient({mode:'rtc',codec:'vp8'});this.client=c;
 const users=()=>this.ui({users:c.remoteUsers.map(u=>({uid:u.uid,speaking:!!u.hasAudio}))});
 c.on('user-published',async(u,type)=>{if(type!=='audio'||epoch!==this.epoch)return;try{await c.subscribe(u,type);if(epoch===this.epoch){u.audioTrack?.play();users();}}catch{this.ui({message:'تعذر سماع أحد المشاركين؛ جرّب تفعيل السماعة.'});}});
 for(const event of ['user-joined','user-left','user-unpublished'])c.on(event,users);
 c.on('token-privilege-will-expire',()=>this.renew(epoch));
 c.on('token-privilege-did-expire',()=>{if(epoch===this.epoch){this.ui({message:'انتهى اتصال الصوت. اضغط إعادة الاتصال.'});this.leave();}});
 c.on('connection-state-change',(state)=>{if(epoch!==this.epoch)return;if(state==='RECONNECTING')this.ui({message:'جاري استعادة اتصال الصوت...'});if(state==='CONNECTED')this.ui({message:'متصل بالصوت — اضغط صعود للمايك حتى تحچي.'});if(state==='DISCONNECTED'){this.ui({message:'انقطع الصوت. اضغط إعادة الاتصال.'});this.leave();}});
 await c.join(data.appId,data.channel,data.token,data.uid);if(epoch!==this.epoch){await this.cleanup();return;}
 this.timer=setInterval(()=>this.renew(epoch),300000);this.ui({connected:true,speaking:false,message:'تسمع المجلس — اضغط صعود للمايك حتى تحچي.'});users();
 }catch(e){await this.cleanup();if(epoch===this.epoch)this.ui({message:e.message||'تعذر الاتصال بالصوت.'});}});}
 renew(epoch){return this.serial(async()=>{if(epoch!==this.epoch||!this.client||!this.session)return;try{const data=await this.token('renew',this.session);if(epoch===this.epoch)await this.client.renewToken(data.token);}catch{if(epoch===this.epoch){++this.epoch;await this.cleanup();this.ui({message:'تعذر تجديد اتصال الصوت. اضغط إعادة الاتصال.'});}}});}
 rise(){const epoch=this.epoch;return this.serial(async()=>{if(!this.client||!this.session){this.ui({message:'انتظر اتصال الصوت أو اضغط إعادة الاتصال.'});return;}if(this.track)return;
 let track;try{const sdk=await this.sdk();track=await sdk.createMicrophoneAudioTrack({AEC:true,ANS:true,AGC:true});if(epoch!==this.epoch){track.stop();track.close();return;}this.track=track;await this.client.publish(track);if(epoch!==this.epoch){await this.cleanup();return;}this.muted=false;this.ui({speaking:true,muted:false,message:'المايك شغّال — الموجودون بالمجلس يسمعونك.'});}catch{if(track){track.stop();track.close();}this.track=null;this.ui({speaking:false,message:'تعذر تشغيل المايك. اسمح باستخدامه من إعدادات المتصفح ثم حاول.'});}});}
 mute(){return this.serial(async()=>{if(!this.track)return;try{const muted=!this.muted;await this.track.setMuted(muted);this.muted=muted;this.ui({muted,message:muted?'المايك مكتوم.':'المايك شغّال.'});}catch{this.ui({message:'تعذر تغيير حالة المايك؛ انزل من المايك وحاول ثانية.'});}});}
 down(){return this.serial(async()=>{const track=this.track;if(!track)return;try{await this.client?.unpublish(track);}finally{track.stop();track.close();this.track=null;this.muted=false;this.ui({speaking:false,message:'نزلت من المايك — بعدك تسمع المجلس.'});}});}
 leave(){++this.epoch;if(this.track){this.track.stop();this.track.close();this.track=null;}return this.serial(()=>this.cleanup());}
 listen(){for(const u of this.client?.remoteUsers||[])u.audioTrack?.play();}
}
if(typeof module!=='undefined')module.exports={RoyalVoice};
