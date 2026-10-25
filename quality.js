(()=>{
 'use strict';
 const root=document.documentElement;
 const notice=document.createElement('div');notice.className='connection-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;document.body.append(notice);
 const network=()=>{notice.hidden=navigator.onLine!==false;notice.textContent='الإنترنت مقطوع. تحقق من اتصالك حتى تكمل اللعب والمحادثة.';};
 window.addEventListener('online',()=>{if(window.lammaUser)window.loadLammaGold?.();});
 window.addEventListener('offline',network);window.addEventListener('online',network);network();
 // Recovery stays independent of the external authentication SDK.
 const timeout=setTimeout(()=>{
  if(root.dataset.authState!=='loading')return;
  const gate=document.getElementById('authGate'),msg=document.getElementById('authMsg');if(!gate||!msg||gate.classList.contains('off'))return;
  msg.textContent=navigator.onLine===false?'تسجيل الدخول يحتاج إنترنت. اتصل بالشبكة وجرب مجدداً.':'تحميل خدمة الدخول أخذ وقت أطول من المعتاد. تحقق من اتصالك وأعد المحاولة.';
  const retry=document.createElement('button');retry.type='button';retry.className='social auth-retry';retry.textContent='إعادة تحميل التطبيق';retry.onclick=()=>location.reload();msg.after(retry);
 },20000);
 const observer=new MutationObserver(()=>{if(root.dataset.authState!=='loading'){clearTimeout(timeout);document.querySelector('.auth-retry')?.remove();observer.disconnect();}});observer.observe(root,{attributes:true,attributeFilter:['data-auth-state']});
 // Track the actual selected screen for assistive technology and keyboard users.
 const originalShow=window.show;
 if(typeof originalShow==='function')window.show=function(...args){const result=originalShow.apply(this,args);document.querySelectorAll('#tabs [data-page]').forEach(button=>{if(button.classList.contains('active'))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});const page=document.getElementById('other');if(page&&!page.classList.contains('hidden')){const title=page.querySelector('.app-page-header h1');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}}return result;};
 document.addEventListener('error',event=>{const image=event.target;if(image?.tagName!=='IMG')return;image.classList.add('asset-unavailable');if(image.alt)image.setAttribute('aria-label',image.alt);},true);
 document.querySelector('#tabs .active')?.setAttribute('aria-current','page');
})();
