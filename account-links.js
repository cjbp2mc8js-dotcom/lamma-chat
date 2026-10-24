import {GoogleAuthProvider,FacebookAuthProvider,linkWithPopup,signInWithPopup,linkWithPhoneNumber,signInWithPhoneNumber,RecaptchaVerifier,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizePhone(value){
 let n=String(value).trim().replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[\s()-]/g,'');
 if(/^07\d{9}$/.test(n))n='+964'+n.slice(1);
 if(n.startsWith('00'))n='+'+n.slice(2);
 return /^\+[1-9]\d{7,14}$/.test(n)?n:null;
}
const errors={
 'auth/operation-not-allowed':'هاي الطريقة تحتاج تفعيل من إعدادات تسجيل الدخول في Firebase.',
 'auth/unauthorized-domain':'نطاق التطبيق يحتاج إضافة ضمن النطاقات المسموحة في Firebase.',
 'auth/credential-already-in-use':'هاي الطريقة مرتبطة بحساب ثاني. ما نكدر نربطها حتى نحافظ على حسابك الحالي.',
 'auth/email-already-in-use':'هذا البريد مرتبط بحساب ثاني. استخدم طريقة دخول حسابك الأصلية.',
 'auth/account-exists-with-different-credential':'هذا البريد مسجل بطريقة ثانية. ادخل بالطريقة الأصلية وبعدها افتح ربط الحساب.',
 'auth/provider-already-linked':'هاي الطريقة مرتبطة بحسابك بالفعل.',
 'auth/popup-blocked':'المتصفح منع نافذة الدخول. افتح التطبيق مباشرة في Safari واسمح بالنوافذ المنبثقة.',
 'auth/popup-closed-by-user':'أغلقت نافذة الربط. تقدر تحاول مرة ثانية.',
 'auth/requires-recent-login':'حتى نحمي حسابك، سجّل خروج وادخل مرة ثانية قبل الربط.',
 'auth/invalid-verification-code':'رمز التحقق مو صحيح. تأكد من رسالة SMS.',
 'auth/code-expired':'انتهت صلاحية الرمز. ارجع واطلب رمز جديد.',
 'auth/invalid-phone-number':'تأكد من رقم الهاتف ورمز الدولة، مثال: +9647XXXXXXXXX.',
 'auth/too-many-requests':'محاولات كثيرة. انتظر شوية وحاول مرة ثانية.',
 'auth/quota-exceeded':'خدمة رسائل التحقق وصلت حدّها. حاول لاحقاً.',
 'auth/billing-not-enabled':'رسائل الهاتف تحتاج تفعيل الفوترة من إدارة التطبيق.',
 'auth/captcha-check-failed':'تعذّر التحقق الأمني. أغلق النافذة وافتحها وحاول مجدداً.',
 'auth/network-request-failed':'تحقق من الإنترنت وحاول مرة ثانية.',
 'auth/invalid-app-credential':'تعذّر التحقق من التطبيق. إعدادات تسجيل الهاتف تحتاج مراجعة.'
};
export const accountLinkError=e=>errors[e?.code]||'تعذّرت العملية. حاول لاحقاً أو تواصل مع دعم التطبيق.';

export function initAccountLinks(auth){
 let panel=null,verifier=null,confirmation=null,owner=null,mode='link',busy=false,epoch=0,cooldown=0,timer=null;
 const current=()=>mode==='login'?!auth.currentUser:auth.currentUser?.uid===owner;
 const message=t=>{const e=panel?.querySelector('[data-link-message]');if(e)e.textContent=t;};
 function clearVerifier(){try{verifier?.clear();}catch{}verifier=null;}
 function close(){epoch++;clearVerifier();clearInterval(timer);timer=null;confirmation=null;busy=false;panel?.remove();panel=null;}
 function setBusy(value){busy=value;panel?.querySelectorAll('button,input').forEach(e=>{if(!e.hasAttribute('data-link-close'))e.disabled=value||e.dataset.linked==='true';});}
 function finish(text){window.lammaUser=auth.currentUser;window.dispatchEvent(new Event('lamma-auth-linked'));message(text);}
 function render(){
 const u=auth.currentUser;owner=u?.uid||null;
 const linked=id=>u?.providerData?.find(p=>p.providerId===id);
 const row=(id,name,icon)=>{const p=linked(id);return `<div class="account-link-row"><span class="account-link-icon" aria-hidden="true">${icon}</span><div><strong>${name}</strong><small>${p?esc(p.phoneNumber||p.email||'مرتبط بحسابك'):'غير مرتبط'}</small></div><button type="button" data-provider="${id}" data-linked="${!!p}" ${p?'disabled':''}>${p?'✓ مرتبط':'ربط'}</button></div>`;};
 panel.innerHTML=`<header><button type="button" data-link-close aria-label="إغلاق">×</button><h2>${mode==='link'?'ربط الحساب':'الدخول برقم الهاتف'}</h2></header><div class="account-link-body">${mode==='link'?`<p>اربط طرق الدخول بنفس حسابك حتى تبقى معلوماتك والأيدي والمستوى وياك.</p>${row('google.com','Google / جيميل','G')}${row('facebook.com','فيسبوك','f')}${row('phone','رقم الهاتف','☎')}`:''}<section data-phone-section ${mode==='link'?'hidden':''}><form data-phone-form><label>رقم الهاتف ويّا رمز الدولة<input type="tel" dir="ltr" name="phone" autocomplete="tel" placeholder="+9647XXXXXXXXX" required></label><p class="account-link-note">راح توصلك رسالة تحقق. بإرسال الرمز توافق على استخدام رقمك للتحقق من الدخول وحماية الحساب بواسطة Google.</p><div id="lamma-phone-recaptcha"></div><button type="submit" data-send-code>إرسال رمز SMS</button></form><form data-code-form hidden><label>رمز التحقق من SMS<input name="code" dir="ltr" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9٠-٩۰-۹]{6}" maxlength="6" required></label><button type="submit">${mode==='link'?'تأكيد وربط الرقم':'تأكيد والدخول'}</button><button type="button" data-resend>إرسال رمز جديد</button></form></section><p data-link-message role="status" aria-live="polite"></p></div>`;
 panel.querySelector('[data-link-close]').onclick=()=>{panel.close();close();};
 panel.querySelectorAll('[data-provider]').forEach(button=>button.onclick=()=>{if(button.dataset.provider==='phone'){panel.querySelector('[data-phone-section]').hidden=false;panel.querySelector('[name=phone]').focus();}else return oauth(button.dataset.provider);});
 panel.querySelector('[data-phone-form]').onsubmit=sendCode;
 panel.querySelector('[data-code-form]').onsubmit=confirmCode;
 panel.querySelector('[data-resend]').onclick=()=>{if(Date.now()<cooldown){message('انتظر دقيقة قبل طلب رمز جديد.');return;}confirmation=null;panel.querySelector('[data-code-form]').hidden=true;panel.querySelector('[data-phone-form]').hidden=false;clearVerifier();message('تأكد من الرقم واضغط إرسال رمز SMS.');};
 }
 async function oauth(id){
 if(busy||!current())return;setBusy(true);const token=epoch;
 try{const p=id==='google.com'?new GoogleAuthProvider():new FacebookAuthProvider();if(id==='google.com')p.setCustomParameters({prompt:'select_account'});await linkWithPopup(auth.currentUser,p);if(token!==epoch||!current())return;render();finish('تم الربط بنجاح ✓ نفس حسابك والأيدي والمستوى.');}
 catch(e){if(token===epoch&&current())message(accountLinkError(e));}finally{if(token===epoch)setBusy(false);}
 }
 async function sendCode(event){
 event.preventDefault();if(busy||!current())return;
 const phone=normalizePhone(panel.querySelector('[name=phone]').value);if(!phone){message(errors['auth/invalid-phone-number']);return;}
 if(Date.now()<cooldown){message('انتظر دقيقة قبل طلب رمز جديد.');return;}
 setBusy(true);message('جاري التحقق وإرسال الرمز…');const token=epoch;
 try{clearVerifier();verifier=new RecaptchaVerifier(auth,'lamma-phone-recaptcha',{size:'normal'});await verifier.render();if(token!==epoch||!current())return;
 const result=mode==='link'?await linkWithPhoneNumber(auth.currentUser,phone,verifier):await signInWithPhoneNumber(auth,phone,verifier);
 if(token!==epoch||!current())return;confirmation=result;cooldown=Date.now()+60000;panel.querySelector('[data-phone-form]').hidden=true;panel.querySelector('[data-code-form]').hidden=false;message('دزّينا الرمز برسالة SMS. اكتبه هنا داخل التطبيق.');}
 catch(e){if(token===epoch){clearVerifier();message(accountLinkError(e));}}finally{if(token===epoch)setBusy(false);}
 }
 async function confirmCode(event){
 event.preventDefault();if(busy||!confirmation||!current())return;const token=epoch;
 const code=panel.querySelector('[name=code]').value.replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
 if(!/^\d{6}$/.test(code)){message('اكتب رمز التحقق المكوّن من 6 أرقام.');return;}
 setBusy(true);try{await confirmation.confirm(code);if(token!==epoch)return;if(mode==='login'){panel?.close();close();return;}if(!current())return;clearVerifier();confirmation=null;render();finish('تم ربط رقم الهاتف بنجاح ✓');}catch(e){if(token===epoch)message(accountLinkError(e));}finally{if(token===epoch)setBusy(false);}
 }
 function open(nextMode='link'){
 close();mode=nextMode;if(mode==='link'&&!auth.currentUser)return;
 panel=document.createElement('dialog');panel.className='account-link-dialog';panel.dir='rtl';document.body.append(panel);render();panel.addEventListener('cancel',close);panel.showModal();
 }
 window.openLammaAccountLinks=()=>open('link');window.openLammaPhoneLogin=()=>open('login');
 document.getElementById('phoneLogin').onclick=()=>open('login');
 document.getElementById('facebookLogin').onclick=async()=>{const msg=document.getElementById('authMsg');try{await signInWithPopup(auth,new FacebookAuthProvider());}catch(e){msg.textContent=accountLinkError(e);}};
 onAuthStateChanged(auth,user=>{if(panel&&((mode==='link'&&user?.uid!==owner)||(mode==='login'&&user)))close();});
}
