const mountRoyalVoice=()=>{
 let sdkPromise;
 const loadSDK=()=>sdkPromise||(sdkPromise=new Promise((resolve,reject)=>{
  if(window.AgoraRTC)return resolve(window.AgoraRTC);
  const s=document.createElement('script');s.src='https://download.agora.io/sdk/release/AgoraRTC_N-4.23.2.js';
  s.onload=()=>{if(!window.AgoraRTC){sdkPromise=null;reject(Error('تعذر تحميل الصوت'));return;}AgoraRTC.onAutoplayFailed=()=>update({message:'اضغط زر السماعة حتى تسمع المجلس.'});resolve(AgoraRTC);};
  s.onerror=()=>{s.remove();sdkPromise=null;reject(Error('تعذر تحميل الصوت. تحقق من الإنترنت وحاول.'));};document.head.appendChild(s);
 }));
 const micSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
 const personSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>';
 const speakerSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
 const micMutedSVG=micSVG.replace('</svg>','<path d="M3 3 21 21"/></svg>'),speakerMutedSVG=speakerSVG.replace('</svg>','<path d="m16 9 6 6m0-6-6 6"/></svg>');
 const control=(button,icon,label)=>{if(!button)return;button.replaceChildren();const graphic=document.createElement('span');graphic.className='control-icon';graphic.setAttribute('aria-hidden','true');if(icon==='mic')graphic.innerHTML=micSVG;else if(icon==='mic-muted')graphic.innerHTML=micMutedSVG;else if(icon==='speaker-muted')graphic.innerHTML=speakerMutedSVG;else if(icon==='speaker')graphic.innerHTML=speakerSVG;else if(icon==='profile')graphic.innerHTML=personSVG;else graphic.textContent=icon;button.append(graphic,document.createTextNode(label));button.setAttribute('aria-label',label);};
 let state={connected:false,speaking:false,muted:false,outputMuted:false,users:[],rtcUid:null},roomId=null;
 function update(next){Object.assign(state,next);const stage=document.querySelector('.council-stage');if(!stage)return;
  const status=document.getElementById('seatStatus');if(status&&next.message)status.textContent=next.message;
  const rise=document.getElementById('micToggle'),mute=document.getElementById('voiceMute'),down=document.getElementById('voiceDown');
  if(rise){rise.disabled=!state.connected||state.speaking;control(rise,'mic',state.speaking?(state.muted?'مكتوم':'على المايك'):'صعود');}
  if(mute){mute.disabled=!state.speaking;mute.hidden=!state.speaking;control(mute,state.muted?'mic-muted':'mic',state.muted?'فتح المايك':'كتم المايك');mute.setAttribute('aria-pressed',String(state.muted));}if(down)down.disabled=!state.speaking;
  const speaker=document.getElementById('voiceListen');if(speaker){speaker.disabled=!state.connected;control(speaker,state.outputMuted?'speaker-muted':'speaker',state.outputMuted?'فتح صوت المجلس':'كتم صوت المجلس');speaker.setAttribute('aria-pressed',String(state.outputMuted));}
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
 window.lammaVoiceMount=id=>{roomId=id;state={connected:false,speaking:false,muted:false,outputMuted:false,users:[],rtcUid:null};const stage=document.querySelector('.council-stage');if(!stage)return;
  const controls=stage.querySelector('.voice-controls');for(const [id,icon,label,handler]of [['voiceMute','mic','كتم المايك',()=>voice.mute()],['voiceListen','speaker','كتم صوت المجلس',()=>voice.toggleSpeaker()]]){const b=document.createElement('button');b.id=id;control(b,icon,label);b.onclick=()=>Promise.resolve(handler()).catch(()=>update({message:'تعذر تنفيذ الطلب. حاول ثانية.'}));controls.appendChild(b);}
  const retry=document.createElement('button');retry.id='voiceRetry';retry.className='stage-settings';retry.textContent='↻';retry.setAttribute('aria-label','إعادة اتصال الصوت');retry.onclick=()=>voice.join(roomId);stage.querySelector('.council-stage-header').appendChild(retry);
  const giftItems=[
   {id:'rose',name:'وردة',group:'لطيفة',color:'#fb719d',shape:'<path d="M49 54v34M49 76c-18 0-22-12-22-12 17-4 22 12 22 12m0-8c16 0 23-14 23-14-18-1-23 14-23 14" stroke="#66d5a0" stroke-width="5" fill="#32a66d"/><path d="M49 56C14 42 29 16 47 25 63 8 88 34 63 48Z"/><path d="M49 51C31 37 39 24 51 29c17-7 22 11 9 17" fill="none" stroke="#ffd1e2" stroke-width="3"/>'},
   {id:'heart',name:'قلب',group:'لطيفة',color:'#f45e8c',shape:'<path d="M50 82 18 51C-3 27 31 7 50 31 69 7 103 27 82 51Z"/><path d="M24 34q7-10 17-1" fill="none" stroke="#ffcfdf" stroke-width="6" stroke-linecap="round"/>'},
   {id:'coffee',name:'قهوة',group:'لطيفة',color:'#ffd49a',shape:'<ellipse cx="49" cy="81" rx="35" ry="7" fill="#b88954"/><path d="M72 42h8c21 0 18 25-4 25" fill="none" stroke="#e3ae69" stroke-width="7"/><path d="m22 39 5 27c4 22 41 22 45 0l5-27Z"/><ellipse cx="49" cy="40" rx="28" ry="9" fill="#663e30"/><path d="M39 41q10-11 20 0-10 11-20 0M39 24q-8-6 0-13M57 24q-8-6 0-13" fill="none" stroke="#fff0d8" stroke-width="3" stroke-linecap="round"/>'},
   {id:'crown',name:'تاج ملكي',group:'ملكية',color:'#ffdb70',shape:'<path d="m15 35 18 16 17-30 17 30 18-16-9 43H24Z"/><path d="M26 85h48" stroke="#e3a43e" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="60" r="7" fill="#d76bba"/><circle cx="15" cy="31" r="5"/><circle cx="50" cy="17" r="5"/><circle cx="85" cy="31" r="5"/>'},
   {id:'diamond',name:'ألماسة',group:'ملكية',color:'#92edff',shape:'<path d="m10 36 20-21h40l20 21-40 51Z"/><path d="m10 36 40 51-20-51 20-21 20 21-20 51M10 36h80M30 36h40" fill="none" stroke="#e4fbff" stroke-width="2.5"/>'},
   {id:'car',name:'سيارة فخمة',group:'ملكية',color:'#f58794',shape:'<path d="m13 53 12-23h48l14 23 7 8v18H6V61Z"/><path d="m31 35-9 19h55l-10-19Z" fill="#29375e"/><path d="M50 36v17M14 63h14m44 0h14" stroke="#fff2c1" stroke-width="5"/><rect x="13" y="74" width="15" height="13" rx="4" fill="#292840"/><rect x="72" y="74" width="15" height="13" rx="4" fill="#292840"/><path d="M35 69h30" stroke="#934450" stroke-width="5"/>'},
   {id:'plane',name:'طائرة',group:'ملكية',color:'#d3e7ff',shape:'<path d="m46 9 9 0 6 31 29 19v10L61 58l-3 22 11 7v6L50 89 31 93v-6l11-7-3-22L10 69V59l29-19Z"/><path d="M47 18h6v16h-6Z" fill="#78a8e8"/>'},
   {id:'palace',name:'قصر ملكي',group:'ملكية',color:'#f8d58a',shape:'<path d="M18 40h64v47H18Z"/><path d="M10 26h19v61H10Zm61 0h19v61H71Z"/><path d="M7 27 20 9l13 18M67 27 80 9l13 18M34 41l16-24 16 24" fill="#c895e5"/><path d="M41 87V65a9 9 0 0 1 18 0v22Z" fill="#5a3d77"/><path d="M17 41h5v10h-5m61-10h5v10h-5M29 48h5v10h-5m37-10h5v10h-5" stroke="#8e5fa8" stroke-width="3"/>'}
  ];
  const giftArt=item=>'<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="gift-'+item.id+'" x2=".8" y2="1"><stop stop-color="#fff7dc"/><stop offset=".35" stop-color="'+item.color+'"/><stop offset="1" stop-color="'+item.color+'" stop-opacity=".68"/></linearGradient></defs><g fill="url(#gift-'+item.id+')">'+item.shape+'</g></svg>';
  const gallery=document.createElement('dialog');gallery.id='councilGiftGallery';gallery.className='gift-gallery';gallery.setAttribute('aria-label','معرض الهدايا');
  gallery.innerHTML='<header class="gift-gallery-heading"><div><h2>معرض الهدايا</h2><p>اختار هدية حتى تشوفها</p></div><button type="button" class="gift-gallery-close" aria-label="إغلاق معرض الهدايا">×</button></header><div class="gift-filters" aria-label="أنواع الهدايا"></div><div class="gift-grid"></div><footer class="gift-preview"><div class="gift-preview-art"></div><div><strong></strong><p>معاينة الهدية • الإرسال قريباً</p></div></footer>';
  stage.appendChild(gallery);gallery.querySelector('.gift-gallery-close').onclick=()=>gallery.close();
  let selectedGift='rose';const chooseGift=id=>{selectedGift=id;const item=giftItems.find(g=>g.id===id);gallery.querySelector('.gift-preview-art').innerHTML=giftArt(item);gallery.querySelector('.gift-preview strong').textContent=item.name;for(const button of gallery.querySelectorAll('.gift-card'))button.setAttribute('aria-pressed',String(button.dataset.gift===id));};
  const drawGifts=filter=>{const grid=gallery.querySelector('.gift-grid');grid.replaceChildren();for(const item of giftItems.filter(g=>filter==='الكل'||g.group===filter)){const button=document.createElement('button');button.type='button';button.className='gift-card';button.dataset.gift=item.id;button.innerHTML=giftArt(item);const name=document.createElement('span');name.textContent=item.name;button.appendChild(name);button.onclick=()=>chooseGift(item.id);grid.appendChild(button);}for(const button of gallery.querySelectorAll('.gift-filters button'))button.setAttribute('aria-pressed',String(button.textContent===filter));chooseGift(selectedGift);};
  for(const filter of ['الكل','لطيفة','ملكية']){const button=document.createElement('button');button.type='button';button.textContent=filter;button.onclick=()=>drawGifts(filter);gallery.querySelector('.gift-filters').appendChild(button);}drawGifts('الكل');
  stage.querySelector('#councilGifts').onclick=()=>gallery.showModal();
  gallery.addEventListener('click',e=>{if(e.target===gallery){const r=gallery.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)gallery.close();}});
  const toolDialog=document.createElement('dialog');toolDialog.id='councilToolDialog';toolDialog.className='mic-profile';const toolTitle=document.createElement('h3'),toolText=document.createElement('p'),toolClose=document.createElement('button');toolClose.textContent='رجوع للمجلس';toolClose.onclick=()=>toolDialog.close();toolDialog.append(toolTitle,toolText,toolClose);stage.appendChild(toolDialog);
  for(const [id,title,text]of [['councilMusic','الموسيقى','تشغيل الموسيقى ومشاركتها داخل المجلس غير مفعّل بعد.'],['councilMessages','الرسائل','الرسائل الكتابية داخل المجلس غير مفعّلة بعد.']]){const button=stage.querySelector('#'+id);if(button)button.onclick=()=>{toolTitle.textContent=title;toolText.textContent=text;toolDialog.showModal();};}
  const menu=document.createElement('dialog');menu.id='ownMicMenu';menu.className='mic-menu';menu.setAttribute('aria-label','خيارات المايك');
  const exit=document.createElement('button');control(exit,'mic','الخروج من المايك');exit.onclick=()=>{menu.close();Promise.resolve(voice.down()).catch(()=>update({message:'تعذر النزول من المايك. حاول ثانية.'}));};
  const profile=document.createElement('button');control(profile,'profile','فتح ملفي الشخصي');profile.onclick=()=>{menu.close();const info=stage.querySelector('#councilOwnProfile');if(info)info.showModal();};menu.append(exit,profile);stage.appendChild(menu);
  const info=document.createElement('dialog');info.id='councilOwnProfile';info.className='mic-profile';info.setAttribute('aria-label','ملفي الشخصي');const title=document.createElement('h3');title.textContent=window.lammaUser?.displayName||window.lammaUser?.email?.split('@')[0]||'ملفي الشخصي';const uid=document.createElement('p');uid.textContent=window.lammaUser?.uid||'';uid.dir='ltr';const close=document.createElement('button');close.textContent='رجوع للمجلس';close.onclick=()=>info.close();info.append(title,uid,close);stage.appendChild(info);
  for(const dialog of [menu,info,toolDialog])dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  update({message:'جاري اتصال صوت المجلس...'});voice.join(id);
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
