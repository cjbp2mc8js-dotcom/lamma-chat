const premiumGoldArt='<svg viewBox="0 0 64 64" width="46" height="46" focusable="false"><g stroke="#b87812" stroke-width="2"><ellipse cx="24" cy="46" rx="19" ry="9" fill="#c78c1d"/><ellipse cx="24" cy="40" rx="19" ry="9" fill="#ffd655"/><ellipse cx="24" cy="33" rx="19" ry="9" fill="#e2a931"/><ellipse cx="24" cy="27" rx="19" ry="9" fill="#ffe27a"/><circle cx="43" cy="42" r="16" fill="#f7bf35"/><circle cx="43" cy="42" r="11" fill="#ffe89a"/></g><path d="m44 33-6 10h9l-5 8" fill="none" stroke="#b57a16" stroke-width="3"/><path d="M48 5v10m-5-5h10" stroke="#fff2ad" stroke-width="3" stroke-linecap="round"/></svg>';
export const STAKES=[500,1000,5000,10000,50000,100000,500000,1000000,2000000,5000000];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const goldNumber=n=>Number(n||0).toLocaleString('ar-IQ');
let inFlight;let accountUID=null;
export async function goldAPI(body){
 const user=window.lammaUser;if(!user)throw Error('سجّل دخولك حتى تجمع ذهب المهام');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{const endpoint=new URL('/games',window.LAMMA_VOICE_ENDPOINT);let r;for(let i=0;i<2;i++){const token=await user.getIdToken(i===1);r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});if(r.status!==401)break;}const data=await r.json();if(window.lammaUser?.uid!==user.uid)throw Error('تغير الحساب؛ افتح المهام من جديد');if(!r.ok)throw Error(r.status===400&&body.action==='gold-status'?'نظام الذهب بانتظار تفعيل تحديث الخادم':data.error||'تعذر تحميل ذهب المهام');if(!data.account)throw Error('نظام الذهب بانتظار تفعيل تحديث الخادم');updateGold(data.account,user.uid);return data;}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('تعذر الاتصال؛ حاول مجدداً');throw e;}finally{clearTimeout(timeout);}
}
export function updateGold(account,uid=window.lammaUser?.uid){
 if(!account||!uid||window.lammaUser?.uid!==uid)return;const previous=accountUID===uid?window.lammaGoldAccount:null;accountUID=uid;window.lammaGoldAccount=account;
 paintGold();window.dispatchEvent(new CustomEvent('lamma-gold-updated'));
 if(previous&&account.level>previous.level&&account.xp>previous.xp)announceLevel(account.level);
}
let levelNoticeTimer;
function announceLevel(level){
 clearTimeout(levelNoticeTimer);document.getElementById('lammaLevelUp')?.remove();
 const notice=document.createElement('div');notice.id='lammaLevelUp';notice.className='game-level-notice';notice.setAttribute('popover','manual');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const icon=document.createElement('span');icon.textContent='🏅';icon.setAttribute('aria-hidden','true');
 const text=document.createElement('div'),title=document.createElement('strong'),caption=document.createElement('small');title.textContent='مبروك! وصلت للمستوى '+goldNumber(level);caption.textContent='نقاط خبرتك محفوظة بحسابك';text.append(title,caption);
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','إغلاق تنبيه المستوى');close.onclick=()=>notice.remove();notice.append(icon,text,close);document.body.append(notice);try{notice.showPopover?.();}catch{}levelNoticeTimer=setTimeout(()=>notice.remove(),7000);
}
export function paintGold(){const a=accountUID===window.lammaUser?.uid?window.lammaGoldAccount:null;
 window.paintLammaBalances?.();document.querySelectorAll('[data-gold-value]').forEach(el=>el.textContent=a?goldNumber(a.gold):'—');
 document.querySelectorAll('[data-gold-level]').forEach(el=>el.textContent=a?goldNumber(a.level):'—');
 document.querySelectorAll('[data-gold-xp]').forEach(el=>el.textContent=a?goldNumber(a.levelXP)+' / '+goldNumber(a.nextLevelXP):'—');
 document.querySelectorAll('[data-gold-progress]').forEach(el=>{const max=a?.nextLevelXP||1000,value=a?Math.max(0,Math.min(a.levelXP,max)):0;el.setAttribute('aria-valuenow',value);el.setAttribute('aria-valuemax',max);el.setAttribute('aria-valuetext',a?goldNumber(value)+' من '+goldNumber(max)+' نقطة خبرة':'جاري تحميل نقاط الخبرة');el.style.setProperty('--gold-progress',(value/max*100)+'%');});
 document.querySelectorAll('[data-gold-remaining]').forEach(el=>el.textContent=a?goldNumber(Math.max(0,a.nextLevelXP-a.levelXP))+' XP للمستوى التالي':'جاري تحميل المستوى…');
 document.querySelectorAll('[data-gold-matches]').forEach(el=>el.textContent=a?goldNumber(a.matches):'—');
 document.querySelectorAll('[data-gold-win-rate]').forEach(el=>el.textContent=a&&a.matches?goldNumber(Math.round(100*a.wins/a.matches))+'٪':'—');
}
export async function refreshGold(){const uid=window.lammaUser?.uid;if(!uid){window.lammaGoldAccount=null;accountUID=null;paintGold();return null;}if(inFlight?.uid===uid)return inFlight.promise;const promise=goldAPI({action:'gold-status'}).then(r=>r.account).finally(()=>{if(inFlight?.uid===uid)inFlight=null;});inFlight={uid,promise};return promise;}
export function goldBarHTML(){return `<div class="game-gold-bar"><span>🪙 <b data-gold-value>${window.lammaGoldAccount?goldNumber(window.lammaGoldAccount.gold):'—'}</b></span><span>المستوى <b data-gold-level>${window.lammaGoldAccount?goldNumber(window.lammaGoldAccount.level):'—'}</b></span><span class="game-xp-count">XP <b data-gold-xp>${window.lammaGoldAccount?goldNumber(window.lammaGoldAccount.levelXP)+' / '+goldNumber(window.lammaGoldAccount.nextLevelXP):'—'}</b></span><button type="button" data-cmd="gold-tasks">🎁 المهام والصناديق</button></div>`;}
export function stakeHTML(stake,kind){return kind==='dare'?'':`<label class="game-stake-label">ذهب الدخول لكل لاعب<select data-stake aria-label="مبلغ ذهب المباراة"><option value="0" ${stake===0?'selected':''}>مباراة مجانية</option>${STAKES.map(n=>`<option value="${n}" ${n===stake?'selected':''}>${goldNumber(n)} ذهب</option>`).join('')}</select></label><p class="game-stake-note">الفائز يأخذ مجموع ذهب اللاعبين • التدريب ضد الجهاز مجاني</p>`;}
export async function openGoldTasks(options={}){
 const view=['daily','missions','chests'].includes(options?.view)?options.view:'chests';
 const title={daily:'المكافأة اليومية',missions:'المهام اليومية',chests:'صناديق الكنوز'}[view];
 document.getElementById('lammaGoldTasks')?.close();const user=window.lammaUser,uid=user?.uid,d=document.createElement('dialog');d.id='lammaGoldTasks';d.className='gold-tasks-dialog';document.body.append(d);let busy=false,message='',error=false;
 const render=()=>{const a=window.lammaGoldAccount;d.innerHTML=`<button type="button" class="gold-close" aria-label="إغلاق">×</button><header><span>🎁</span><h2>${title}</h2><p>كمّل مهامك وافتح صناديق الذهب</p></header>${goldBarHTML()}<div class="gold-tasks-list">${a?a.tasks.filter(t=>view==='daily'?t.id==='login':view==='missions'?t.need>0:true).map(t=>`<article class="gold-task ${t.type}"><span class="gold-chest" aria-hidden="true">${t.type==='premium'?premiumGoldArt:'🎁'}</span><div><small>${t.type==='premium'?'صندوق مميز':'صندوق عادي'}</small><h3>${esc(t.title)}</h3><b>🪙 ${goldNumber(t.min)} – ${goldNumber(t.max)}</b>${t.need?`<p>${goldNumber(t.progress)} / ${goldNumber(t.need)} مباريات</p>`:'<p>مرة واحدة كل يوم</p>'}</div><button type="button" data-claim="${t.id}" ${busy||t.claimed||!t.ready?'disabled':''}>${t.claimed?'تم الفتح ✓':t.ready?'افتح الصندوق':'أكمل المهمة'}</button></article>`).join(''):'<p class="gold-empty">'+(user?'جاري تحميل المهام…':'سجّل دخولك حتى تجمع ذهبك')+'</p>'}</div><p class="gold-message ${error?'error':''}" role="status">${esc(message)}</p>${error?'<button type="button" class="gold-refresh">إعادة المحاولة</button>':''}<p class="gold-info">الصندوق العادي: ١٠٠–٥٠٠ • المميز: ٢٬٠٠٠–٥٬٠٠٠ ذهب.<br>المهام تتجدد منتصف الليل بتوقيت العراق. أكمل مباريات حقيقية للحصول على تقدم المهام ونقاط المستوى؛ إلغاء البحث والانسحاب ما يحسبن.<br>ذهب مجاني للعب داخل التطبيق، بدون شراء أو سحب نقدي.</p>`;
 d.querySelector('.gold-close').onclick=()=>d.close();d.querySelectorAll('[data-cmd="gold-tasks"]').forEach(el=>el.remove());
 d.querySelector('.gold-refresh')?.addEventListener('click',load);
 d.querySelectorAll('[data-claim]').forEach(el=>el.onclick=async()=>{if(busy)return;busy=true;error=false;message='جاري فتح الصندوق…';render();try{const r=await goldAPI({action:'gold-claim',task:el.dataset.claim});if(!d.isConnected||window.lammaUser?.uid!==uid)return;message='✨ حصلت على '+goldNumber(r.reward)+' ذهب!';}catch(e){message=e.message;error=true;}finally{busy=false;if(d.isConnected)render();}});paintGold();};
 const load=async()=>{if(busy)return;busy=true;error=false;message='';render();try{await refreshGold();}catch(e){message=e.message;error=true;}finally{busy=false;if(d.isConnected&&window.lammaUser?.uid===uid)render();}};
 d.addEventListener('close',()=>d.remove());render();d.showModal();if(user)await load();
}
window.addEventListener('lamma-account-changed',()=>{clearTimeout(levelNoticeTimer);document.getElementById('lammaLevelUp')?.remove();window.lammaGoldAccount=null;accountUID=null;document.getElementById('lammaGoldTasks')?.close();paintGold();});
