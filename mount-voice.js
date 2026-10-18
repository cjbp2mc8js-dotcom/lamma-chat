const mountRoyalVoice=()=>{
 let sdkPromise;
 const loadSDK=()=>sdkPromise||(sdkPromise=new Promise((resolve,reject)=>{
  if(window.AgoraRTC)return resolve(window.AgoraRTC);
  const s=document.createElement('script');s.src='https://download.agora.io/sdk/release/AgoraRTC_N-4.23.2.js';
  s.onload=()=>{if(!window.AgoraRTC){sdkPromise=null;reject(Error('تعذر تحميل الصوت'));return;}AgoraRTC.onAutoplayFailed=()=>update({message:'اضغط تفعيل السماعة حتى تسمع المجلس.'});resolve(AgoraRTC);};
  s.onerror=()=>{s.remove();sdkPromise=null;reject(Error('تعذر تحميل الصوت. تحقق من الإنترنت وحاول.'));};document.head.appendChild(s);
 }));
 let state={connected:false,speaking:false,muted:false,users:[]},roomId=null;
 function update(next){Object.assign(state,next);const stage=document.querySelector('.council-stage');if(!stage)return;
  const status=document.getElementById('seatStatus');if(status&&next.message)status.textContent=next.message;
  const rise=document.getElementById('micToggle'),mute=document.getElementById('voiceMute'),down=document.getElementById('voiceDown');
  if(rise){rise.disabled=!state.connected||state.speaking;rise.textContent=state.speaking?'🎙️ إنت على المايك':'🎤 صعود للمايك';}
  if(mute){mute.disabled=!state.speaking;mute.textContent=state.muted?'🎙️ فتح المايك':'🔇 كتم المايك';}if(down)down.disabled=!state.speaking;
  const list=stage.querySelector('.seat-grid');if(list){list.replaceChildren();const own=document.createElement('div');own.className='royal-seat';own.textContent=state.speaking?(state.muted?'🔇 إنت — مكتوم':'🎙️ إنت — على المايك'):'🔊 إنت — مستمع';list.appendChild(own);for(const u of state.users){const e=document.createElement('div');e.className='royal-seat';e.textContent=(u.speaking?'🎙️ متحدث ':'🔊 مستمع ')+u.uid;list.appendChild(e);}}
 }
 const voice=new RoyalVoice({sdk:loadSDK,ui:update,user:()=>window.lammaUser,
  token:async(action,session)=>{const user=window.lammaUser;if(!user)throw Error('سجّل دخولك أولاً');const idToken=await user.getIdToken();const endpoint=window.LAMMA_VOICE_ENDPOINT;if(!endpoint)throw Error('الصوت بعده يحتاج تفعيل خادم المجلس.');let r;try{r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},body:JSON.stringify({action,...session}),signal:AbortSignal.timeout(20000)});}catch{throw Error('خدمة الصوت غير متاحة بعد. تحتاج تفعيل الخادم.');}let data;try{data=await r.json();}catch{throw Error('خدمة الصوت تحتاج إعداد الخادم.');}if(!r.ok)throw Error(data.error||'تعذر الاتصال بالصوت');return data;}});
 window.lammaVoice=voice;
 window.lammaVoiceMount=id=>{roomId=id;state={connected:false,speaking:false,muted:false,users:[]};const stage=document.querySelector('.council-stage');if(!stage)return;
  const actions=stage.querySelector('.stage-actions');for(const [id,label,handler]of [['voiceMute','🔇 كتم المايك',()=>voice.mute()],['voiceDown','⬇️ نزول من المايك',()=>voice.down()],['voiceListen','🔊 تفعيل السماعة',()=>voice.listen()],['voiceRetry','↻ إعادة اتصال الصوت',()=>voice.join(roomId)]]){const b=document.createElement('button');b.id=id;b.textContent=label;b.onclick=()=>Promise.resolve(handler()).catch(()=>update({message:'تعذر تنفيذ الطلب. حاول ثانية.'}));actions.appendChild(b);}
  const mic=document.getElementById('micToggle');mic.onclick=()=>voice.rise();update({message:'جاري اتصال صوت المجلس...'});voice.join(id);
 };
 const originalShow=window.show;window.show=function(page){window.lammaRoomEpoch=(window.lammaRoomEpoch||0)+1;voice.leave();return originalShow(page);};
 const originalRender=window.renderRooms;window.renderRooms=function(){window.lammaRoomEpoch=(window.lammaRoomEpoch||0)+1;voice.leave();return originalRender();};
 const originalManage=window.openMyRoom;window.openMyRoom=function(){window.lammaRoomEpoch=(window.lammaRoomEpoch||0)+1;voice.leave();return originalManage();};
 const originalLogout=window.lammaLogout;window.lammaLogout=async()=>{await voice.leave();return originalLogout();};
 window.addEventListener('pagehide',()=>voice.leave());
 window.addEventListener('pageshow',e=>{if(e.persisted&&document.querySelector('.council-stage'))update({message:'اضغط إعادة اتصال الصوت للرجوع للمجلس.'});});
};
if(window.lammaAppReady)mountRoyalVoice();
else window.addEventListener("lamma-app-ready",mountRoyalVoice,{once:true});
