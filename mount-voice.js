const mountRoyalVoice=()=>{
 let sdkPromise;
 const loadSDK=()=>sdkPromise||(sdkPromise=new Promise((resolve,reject)=>{
  if(window.AgoraRTC)return resolve(window.AgoraRTC);
  const s=document.createElement('script');s.src='https://download.agora.io/sdk/release/AgoraRTC_N-4.23.2.js';
  s.onload=()=>{if(!window.AgoraRTC){sdkPromise=null;reject(Error('تعذر تحميل الصوت'));return;}AgoraRTC.onAutoplayFailed=()=>update({message:'اضغط تفعيل السماعة حتى تسمع المجلس.'});resolve(AgoraRTC);};
  s.onerror=()=>{s.remove();sdkPromise=null;reject(Error('تعذر تحميل الصوت. تحقق من الإنترنت وحاول.'));};document.head.appendChild(s);
 }));
 const micSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
 const personSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>';
 const speakerSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
 const control=(button,icon,label)=>{if(!button)return;button.replaceChildren();const graphic=document.createElement('span');graphic.className='control-icon';graphic.setAttribute('aria-hidden','true');if(icon==='mic')graphic.innerHTML=micSVG;else if(icon==='speaker')graphic.innerHTML=speakerSVG;else if(icon==='profile')graphic.innerHTML=personSVG;else graphic.textContent=icon;button.append(graphic,document.createTextNode(label));button.setAttribute('aria-label',label);};
 let state={connected:false,speaking:false,muted:false,users:[],rtcUid:null},roomId=null;
 function update(next){Object.assign(state,next);const stage=document.querySelector('.council-stage');if(!stage)return;
  const status=document.getElementById('seatStatus');if(status&&next.message)status.textContent=next.message;
  const rise=document.getElementById('micToggle'),mute=document.getElementById('voiceMute'),down=document.getElementById('voiceDown');
  if(rise){rise.disabled=!state.connected||state.speaking;control(rise,'mic',state.speaking?(state.muted?'مكتوم':'على المايك'):'صعود');}
  if(mute){mute.disabled=!state.speaking;control(mute,'mic',state.muted?'فتح المايك':'كتم');mute.setAttribute('aria-pressed',String(state.muted));}if(down)down.disabled=!state.speaking;
  const speakers=state.users.filter(u=>u.speaking).map(u=>({...u,own:false}));
  if(state.speaking)speakers.push({uid:state.rtcUid,own:true,muted:state.muted});
  speakers.sort((a,b)=>Number(a.uid)-Number(b.uid));
  const list=stage.querySelector('.seat-grid');if(list){list.replaceChildren();const slots=Math.max(10,speakers.length);for(let i=0;i<slots;i++){
   const u=speakers[i],seat=document.createElement('button');seat.type='button';seat.className='royal-seat'+(u?' occupied'+(u.muted?' muted':' on-air'):'');
   const circle=document.createElement('span');circle.className='seat-circle';
   const label=document.createElement('small');
   if(u){seat.disabled=!u.own;if(u.own)seat.onclick=()=>stage.querySelector('#ownMicMenu')?.showModal();const avatar=document.createElement('span');avatar.className='seat-avatar';avatar.innerHTML=personSVG;circle.appendChild(avatar);
    if(u.own){try{const photo=localStorage.getItem('lammaAvatarDemo:'+window.lammaUser?.uid);if(photo&&/^data:image\/(jpeg|png|webp);base64,/.test(photo)){const img=document.createElement('img');img.src=photo;img.alt='';avatar.replaceChildren(img);avatar.style.cssText='width:100%;height:100%;display:grid;place-items:center';}}catch{}}
    const badge=document.createElement('span');badge.className='seat-badge';if(u.muted)badge.textContent='×';else badge.innerHTML=micSVG;circle.appendChild(badge);
    label.textContent=u.own?'أنت':('ضيف '+String(u.uid).slice(-4));seat.setAttribute('aria-label',label.textContent+(u.muted?' — مكتوم':' — على المايك'));
   }else{circle.innerHTML=micSVG;label.textContent=String(i+1).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);seat.disabled=!state.connected||state.speaking;seat.setAttribute('aria-label','صعود للمايك');seat.onclick=()=>voice.rise();}
   seat.append(circle,label);list.appendChild(seat);
  }}
  const listeners=stage.querySelector('.voice-listeners');if(listeners){listeners.replaceChildren();const people=state.users.filter(u=>!u.speaking).length+(state.connected&&!state.speaking?1:0);const title=document.createElement('span');title.textContent='المستمعون '+people;listeners.appendChild(title);for(let i=0;i<Math.min(3,people);i++){const avatar=document.createElement('span');avatar.className='listener-avatar';avatar.innerHTML=personSVG;avatar.setAttribute('aria-hidden','true');listeners.appendChild(avatar);}}
 }
 const voice=new RoyalVoice({sdk:loadSDK,ui:update,user:()=>window.lammaUser,
  token:async(action,session)=>{const user=window.lammaUser;if(!user)throw Error('سجّل دخولك أولاً');const idToken=await user.getIdToken();const endpoint=window.LAMMA_VOICE_ENDPOINT;if(!endpoint)throw Error('الصوت بعده يحتاج تفعيل خادم المجلس.');let r;try{r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},body:JSON.stringify({action,...session}),signal:AbortSignal.timeout(20000)});}catch{throw Error('خدمة الصوت غير متاحة بعد. تحتاج تفعيل الخادم.');}let data;try{data=await r.json();}catch{throw Error('خدمة الصوت تحتاج إعداد الخادم.');}if(!r.ok)throw Error(data.error||'تعذر الاتصال بالصوت');return data;}});
 window.lammaVoice=voice;
 window.lammaVoiceMount=id=>{roomId=id;state={connected:false,speaking:false,muted:false,users:[],rtcUid:null};const stage=document.querySelector('.council-stage');if(!stage)return;
  const actions=stage.querySelector('.stage-actions');for(const [id,icon,label,handler]of [['voiceMute','mic','كتم',()=>voice.mute()],['voiceListen','speaker','السماعة',()=>voice.listen()],['voiceRetry','↻','اتصال',()=>voice.join(roomId)],['councilGifts','🎁','هدايا',()=>update({message:'الهدايا داخل المجلس قريباً.'})]]){const b=document.createElement('button');b.id=id;control(b,icon,label);b.onclick=()=>Promise.resolve(handler()).catch(()=>update({message:'تعذر تنفيذ الطلب. حاول ثانية.'}));actions.appendChild(b);}
  const menu=document.createElement('dialog');menu.id='ownMicMenu';menu.className='mic-menu';menu.setAttribute('aria-label','خيارات المايك');
  const exit=document.createElement('button');control(exit,'mic','الخروج من المايك');exit.onclick=()=>{menu.close();Promise.resolve(voice.down()).catch(()=>update({message:'تعذر النزول من المايك. حاول ثانية.'}));};
  const profile=document.createElement('button');control(profile,'profile','فتح ملفي الشخصي');profile.onclick=()=>{menu.close();const info=stage.querySelector('#councilOwnProfile');if(info)info.showModal();};menu.append(exit,profile);stage.appendChild(menu);
  const info=document.createElement('dialog');info.id='councilOwnProfile';info.className='mic-profile';info.setAttribute('aria-label','ملفي الشخصي');const title=document.createElement('h3');title.textContent=window.lammaUser?.displayName||window.lammaUser?.email?.split('@')[0]||'ملفي الشخصي';const uid=document.createElement('p');uid.textContent=window.lammaUser?.uid||'';uid.dir='ltr';const close=document.createElement('button');close.textContent='رجوع للمجلس';close.onclick=()=>info.close();info.append(title,uid,close);stage.appendChild(info);
  for(const dialog of [menu,info])dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
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
