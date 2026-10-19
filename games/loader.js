(()=>{
 let loading;const clientURL=new URL('./client.mjs?v=7',document.currentScript.src).href;
 const goldURL=new URL('./gold.mjs?v=1',document.currentScript.src).href;
 window.openLammaTasks=()=>import(goldURL).then(m=>m.openGoldTasks());
 window.loadLammaGold=()=>import(goldURL).then(m=>{window.paintLammaGold=m.paintGold;return m.refreshGold();}).catch(()=>{});
 const load=()=>loading||(loading=import(clientURL).catch(e=>{loading=null;throw e;}));
 window.renderLammaGames=()=>'<section id="gamesArea"><p role="status">جاري تجهيز الألعاب…</p></section>';
 window.mountLammaGames=async()=>{try{const m=await load(),el=document.getElementById('gamesArea');if(el){el.innerHTML=m.menuHTML();el.querySelector('[data-cmd="gold-tasks"]')?.addEventListener('click',()=>window.openLammaTasks());window.loadLammaGold();}}catch{const el=document.getElementById('gamesArea');if(el)el.innerHTML='<p>تعذر تحميل الألعاب. تأكد من الإنترنت.</p><button class="btn" onclick="mountLammaGames()">إعادة المحاولة</button>';}};
 window.openLammaGamesMenu=async()=>{try{const m=await load();m.openMenu();}catch{alert('تعذر تحميل ألعاب المجلس. حاول مجدداً.');}};
 window.openLammaGame=async kind=>{try{window.closeModal?.();document.getElementById('lammaGamesMenu')?.close();const m=await load();await m.openGame(kind);}catch{alert('تعذر فتح اللعبة. تحقق من الإنترنت وحاول مجدداً.');}};
})();


