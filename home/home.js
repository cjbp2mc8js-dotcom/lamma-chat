(()=>{
 const sync=()=>{const el=document.querySelector('[data-home-gold]');if(el){el.textContent=window.lammaGoldAccount?Number(window.lammaGoldAccount.gold).toLocaleString('ar-IQ'):'—';el.title=window.lammaGoldAccount?'ذهب المهام':'ذهب المهام';}};
 window.openHomeTasks=()=>window.show('events');
 window.addEventListener('lamma-gold-updated',sync);window.addEventListener('lamma-account-changed',()=>{const el=document.querySelector('[data-home-gold]');if(el)el.textContent='—';document.getElementById('homeTasks')?.close();});document.addEventListener('DOMContentLoaded',sync);
})();
