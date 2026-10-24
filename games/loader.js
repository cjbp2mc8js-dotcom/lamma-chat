(()=>{
 let loading;const clientURL=new URL('./client.mjs?v=16',document.currentScript.src).href;
 const goldURL=new URL('./gold.mjs?v=4',document.currentScript.src).href;
 window.openLammaTasks=options=>import(goldURL).then(m=>m.openGoldTasks(options));
 window.loadLammaGold=()=>import(goldURL).then(m=>{window.paintLammaGold=m.paintGold;return m.refreshGold();}).catch(()=>{});
 const load=()=>loading||(loading=import(clientURL).catch(e=>{loading=null;throw e;}));
 window.renderLammaGames=()=>'<section id="gamesArea"><p role="status">جاري تجهيز الألعاب…</p></section>';
 window.mountLammaGames=async()=>{try{const m=await load(),el=document.getElementById('gamesArea');if(el){el.innerHTML=m.menuHTML();const {mountLobby}=await import(new URL("./lobby.mjs?v=2",clientURL));mountLobby(el);window.loadLammaGold();}}catch{const el=document.getElementById('gamesArea');if(el)el.innerHTML='<p>تعذر تحميل الألعاب. تأكد من الإنترنت.</p><button class="btn" onclick="mountLammaGames()">إعادة المحاولة</button>';}};
 window.openLammaGamesMenu=async()=>{try{const m=await load();m.openMenu();}catch{alert('تعذر تحميل ألعاب المجلس. حاول مجدداً.');}};
 window.openLammaGame=async (kind,options={})=>{try{window.closeModal?.();document.getElementById('lammaGamesMenu')?.close();const m=await load();await m.openGame(kind,options);}catch{alert('تعذر فتح اللعبة. تحقق من الإنترنت وحاول مجدداً.');}};
})();


