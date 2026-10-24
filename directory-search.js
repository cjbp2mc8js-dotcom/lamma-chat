(()=>{
 const normalize=value=>String(value||'').trim().replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632).replace(/[۰-۹]/g,c=>c.charCodeAt(0)-1776);
 let generation=0,controller;
 function clear(){generation++;controller?.abort();document.getElementById('directoryProfile')?.close();document.querySelectorAll('[data-directory-results]').forEach(el=>el.replaceChildren());}
 window.addEventListener('lamma-account-changed',clear);
 function message(el,text){el.replaceChildren();const p=document.createElement('p');p.className='directory-status';p.setAttribute('role','status');p.textContent=text;el.append(p);}
 function card(kind,result){
  const article=document.createElement('article');article.className='directory-card';
  const icon=document.createElement('span');icon.className='directory-icon';icon.textContent=kind==='person'?'👤':'♛';icon.setAttribute('aria-hidden','true');
  const copy=document.createElement('div'),heading=document.createElement('h3'),id=document.createElement('p');heading.textContent=result.name;id.textContent=(kind==='person'?'آيدي الشخص: ':'آيدي المجلس: ')+result.id;id.dir='auto';copy.append(heading,id);
  const button=document.createElement('button');button.type='button';button.className='goldbtn';button.textContent=kind==='person'?'عرض الحساب':result.canEnter?'دخول المجلس':'مغلق مؤقتاً';button.disabled=kind==='council'&&!result.canEnter;
  button.onclick=()=>{if(kind==='person')openProfile(result);else window.enterRoom?.(result.roomId);};article.append(icon,copy,button);return article;
 }
 function openProfile(person){
  document.getElementById('directoryProfile')?.close();const d=document.createElement('dialog');d.id='directoryProfile';d.className='directory-profile';d.dir='rtl';
  const title=document.createElement('h2'),id=document.createElement('p'),close=document.createElement('button');title.textContent=person.name;id.textContent='ID: '+person.id;id.dir='ltr';close.type='button';close.className='goldbtn';close.textContent='رجوع';close.onclick=()=>d.close();d.append(title,id,close);d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
 }
 window.mountDirectorySearch=()=>{
  const form=document.getElementById('directorySearchForm');if(!form)return;
  const input=form.querySelector('input'),results=form.querySelector('[data-directory-results]'),button=form.querySelector('[type="submit"]');
  let scope='all',timer;
  const search=async()=>{
   const id=normalize(input.value),user=window.lammaUser;const version=++generation;controller?.abort();button.disabled=false;input.setCustomValidity('');
   if(!id){results.replaceChildren();return;}
   if(!/^[1-9]\d{6,7}$/.test(id)){message(results,'اكتب آيدي من ٧ أو ٨ أرقام');return;}
   if(!user){message(results,'سجّل دخولك حتى تبحث عن صديق أو مجلس');return;}
   controller=new AbortController();const requestController=controller,timeout=setTimeout(()=>requestController.abort(),12000);button.disabled=true;message(results,'جاري البحث بالآيدي…');
   try{
    let response;for(let i=0;i<2;i++){const token=await user.getIdToken(i===1);if(version!==generation)return;response=await fetch(new URL('/search',window.LAMMA_VOICE_ENDPOINT),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({id,scope}),signal:requestController.signal});if(response.status!==401)break;}
    const data=await response.json();if(version!==generation||!form.isConnected||window.lammaUser?.uid!==user.uid)return;
    if(!response.ok)throw Error(data.error||'تعذر البحث الآن؛ حاول مجدداً');
    results.replaceChildren();if(data.person)results.append(card('person',data.person));if(data.council)results.append(card('council',data.council));
    if(!data.person&&!data.council)message(results,scope==='councils'?'ماكو مجلس عام بهذا الآيدي':'ماكو نتيجة بهذا الآيدي؛ تأكد من الرقم');
   }catch(e){if(version===generation&&form.isConnected&&window.lammaUser?.uid===user.uid)message(results,e.name==='AbortError'?'انتهت مهلة البحث؛ حاول مجدداً':e instanceof TypeError?'تعذر الاتصال؛ تحقق من الإنترنت وحاول مجدداً':e.message);}
   finally{clearTimeout(timeout);if(version===generation)button.disabled=false;}
  };
  form.onsubmit=e=>{e.preventDefault();clearTimeout(timer);search();};
  input.oninput=()=>{generation++;controller?.abort();button.disabled=false;clearTimeout(timer);results.replaceChildren();if(/^[1-9]\d{6,7}$/.test(normalize(input.value)))timer=setTimeout(search,500);};
  form.querySelectorAll('[data-directory-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.directoryScope;form.querySelectorAll('[data-directory-scope]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));clearTimeout(timer);search();});
 };
 window.toggleCouncilSearch=()=>document.getElementById('councilSearch')?.focus();
})();
