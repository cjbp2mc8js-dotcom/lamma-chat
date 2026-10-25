(()=>{
 let loading,attempt=0,panel;
 const clientURL=new URL('./client.mjs?v=21',document.currentScript.src).href;
 const goldURL=new URL('./gold.mjs?v=4',document.currentScript.src).href;
 const load=()=>loading||(loading=import(clientURL).catch(e=>{loading=null;throw e;}));
 function closePanel(){if(!panel)return;panel.close?.();panel.remove();panel=null;}
 function feedback(text,retry){closePanel();const d=document.createElement('dialog');d.className='game-load-dialog';d.setAttribute('aria-labelledby','gameLoadTitle');d.dir='rtl';d.innerHTML='<div class="game-load-symbol" aria-hidden="true">🎲</div><h2 id="gameLoadTitle"></h2><p>تحقق من الإنترنت وحاول مجدداً.</p><div><button type="button" data-load-retry>إعادة المحاولة</button><button type="button" data-load-close>رجوع</button></div>';d.querySelector('h2').textContent=text;d.querySelector('[data-load-retry]').onclick=retry;d.querySelector('[data-load-close]').onclick=closePanel;d.addEventListener('cancel',()=>{attempt++;closePanel();});document.body.append(d);panel=d;d.showModal();}
 async function open(run,retry){const ticket=++attempt;closePanel();let timer;
 try{if(navigator.onLine===false)throw Error('offline');timer=setTimeout(()=>{if(ticket!==attempt)return;const d=document.createElement('dialog');d.className='game-load-dialog';d.dir='rtl';d.innerHTML='<div class="game-load-ring" aria-hidden="true"></div><h2>جاري تجهيز اللعبة</h2><p role="status">نحمّل الملفات اللازمة للعب…</p><button type="button">إلغاء</button>';const cancel=()=>{attempt++;closePanel();};d.querySelector('button').onclick=cancel;d.addEventListener('cancel',cancel);document.body.append(d);panel=d;d.showModal();},180);
 const m=await load();clearTimeout(timer);if(ticket!==attempt)return;closePanel();await run(m);
 }catch{clearTimeout(timer);if(ticket===attempt)feedback('تعذّر فتح الألعاب',retry);}}
 window.openLammaTasks=async options=>{try{const m=await import(goldURL);closePanel();await m.openGoldTasks(options);}catch{feedback('تعذّر فتح المهام',()=>window.openLammaTasks(options));}};
 window.loadLammaGold=()=>import(goldURL).then(m=>{window.paintLammaGold=m.paintGold;return m.refreshGold();}).catch(()=>{});
 window.renderLammaGames=()=>'<section id="gamesArea"><p role="status">جاري تجهيز الألعاب…</p></section>';
 window.mountLammaGames=async()=>{const el=document.getElementById('gamesArea');try{const m=await load();if(!el?.isConnected)return;const {mountLobby}=await import(new URL('./lobby.mjs?v=2',clientURL));if(!el.isConnected)return;el.innerHTML=m.menuHTML();mountLobby(el);window.loadLammaGold();}catch{if(el?.isConnected)el.innerHTML='<p role="status">تعذر تحميل الألعاب. تأكد من الإنترنت.</p><button class="btn" onclick="mountLammaGames()">إعادة المحاولة</button>';}};
 window.openLammaGamesMenu=()=>open(m=>m.openMenu(),()=>window.openLammaGamesMenu());
 window.openLammaGame=(kind,options={})=>open(async m=>{window.closeModal?.();document.getElementById('lammaGamesMenu')?.close();await m.openGame(kind,options);},()=>window.openLammaGame(kind,options));
 window.addEventListener('lamma-account-changed',()=>{attempt++;closePanel();});
})();
