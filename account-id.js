// Public account numbers are allocated once by the authenticated server.
(()=>{
 let user=null,pending=null,revision=0,error='';
 window.lammaPublicId=null;
 const paint=()=>{
  document.querySelectorAll('[data-account-id]').forEach(el=>{el.textContent=window.lammaPublicId||error||(user?'جاري تحميل الآيدي…':'سجّل دخولك');});
  document.querySelectorAll('[data-copy-account-id]').forEach(el=>{el.disabled=!window.lammaPublicId;});
  document.querySelectorAll('[data-retry-account-id]').forEach(el=>{el.hidden=!error;});
 };
 window.renderLammaAccountId=paint;
 window.loadLammaAccountId=()=>{
  if(!user||window.lammaPublicId)return Promise.resolve(window.lammaPublicId);
  if(pending)return pending;
  const current=user,version=revision;error='';paint();
  const task=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   try{
    const endpoint=new URL('/account-id',window.LAMMA_VOICE_ENDPOINT);
    let response;
    for(let attempt=0;attempt<2;attempt++){
     const token=await current.getIdToken(attempt===1);
     response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name:current.displayName||'عضو لمة شات'}),signal:controller.signal});
     if(response.status!==401)break;
    }
    const data=await response.json();
    if(!response.ok||!/^\d{7,8}$/.test(data.id))throw Error('ID unavailable');
    if(version===revision){window.lammaPublicId=data.id;error='';}
    return data.id;
   }catch(e){if(version===revision)error='تعذر تحميل الآيدي؛ اضغط إعادة المحاولة';return null;}
   finally{clearTimeout(timer);if(version===revision){pending=null;paint();}}
  })();
  pending=task;return task;
 };
 window.setLammaAccountUser=next=>{
  revision++;user=next;pending=null;error='';window.lammaPublicId=null;paint();
  if(user)window.loadLammaAccountId();
 };
})();
