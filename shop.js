(()=>{
 const kinds={diamonds:{name:'الجواهر',unit:'جوهرة',icon:'💎',packs:[[450,'$1'],[1450,'$3'],[5200,'$10']]},gold:{name:'الذهب',unit:'قطعة ذهب',icon:'🪙',packs:[]}};
 let selected='diamonds',lastFocus=null;
 const number=n=>Number(n).toLocaleString('en-US');
 function balances(){return '<div class="shop-balances">'+Object.entries(kinds).map(([key,k])=>`<div class="shop-balance"><span aria-hidden="true">${k.icon}</span><div><small>${k.name}</small><b data-currency-balance="${key}">…</b></div><button type="button" aria-label="${key==='gold'?'مهام الذهب المجاني':'شراء الجواهر'}" onclick="openLammaTopup('${key}')">+</button></div>`).join('')+'</div>';}
 function tabs(){return '<div class="shop-tabs" role="tablist" aria-label="الجواهر أو الذهب المجاني">'+Object.entries(kinds).map(([key,k])=>`<button type="button" role="tab" aria-selected="${key===selected}" onclick="selectLammaCurrency('${key}')">${k.icon} ${k.name}</button>`).join('')+'</div>';}
 function packs(){if(selected==='gold')return '<div class="shop-payment-note"><h3>🪙 ذهبك من لعبك ومهامك</h3><p>صناديق عادية: ١٠٠–٥٠٠ ذهب<br>صناديق مميزة: ٢٬٠٠٠–٥٬٠٠٠ ذهب</p><button class="shop-checkout" onclick="openLammaTasks()">🎁 افتح المهام والصناديق</button><p>الذهب مجاني داخل التطبيق، بدون شراء أو سحب نقدي.</p></div>';const k=kinds[selected];return `<div class="shop-packages" role="tabpanel" aria-label="باقات ${k.name}">${k.packs.map(([amount,price])=>`<button type="button" class="shop-package" aria-pressed="false" data-package="${amount}" onclick="selectLammaPackage(this)"><span class="package-art" aria-hidden="true">${k.icon}</span><b>${number(amount)}</b><small>${k.unit}</small><strong>${price||'السعر قريباً'}</strong></button>`).join('')}</div><p class="shop-payment-note">الشراء والشحن غير متاحين حالياً. ما يتم خصم أي مبلغ أو إضافة رصيد.</p><button type="button" class="shop-checkout" disabled>الشراء غير متاح حالياً</button>`;}
 window.renderLammaShop=()=>`<section class="shop-page" aria-label="المتجر"><p class="shop-intro">رصيدك، الجواهر وصناديق الذهب بمكان واحد</p>${balances()}<h2>الجواهر والذهب المجاني</h2><div id="shopCatalog">${tabs()+packs()}</div></section>`;
 const paint=()=>window.paintLammaBalances?.();
 window.selectLammaCurrency=key=>{if(!kinds[key])return;selected=key;const target=document.getElementById('topupCatalog')||document.getElementById('shopCatalog');if(target)target.innerHTML=tabs()+packs();};
 window.selectLammaPackage=button=>{button.closest('.shop-packages').querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));};
 window.closeLammaTopup=()=>{document.getElementById('lammaTopup')?.close();};
 window.openLammaTopup=(key='diamonds')=>{
  if(key==='gold')return window.openLammaTasks?.();if(!kinds[key])return;selected=key;document.getElementById('lammaTopup')?.remove();lastFocus=document.activeElement;
  const dialog=document.createElement('dialog');dialog.id='lammaTopup';dialog.className='topup-dialog';dialog.setAttribute('aria-labelledby','topupTitle');
  dialog.innerHTML=`<button type="button" class="topup-close" aria-label="إغلاق" onclick="closeLammaTopup()">×</button><h2 id="topupTitle">شحن الجواهر والذهب</h2>${balances()}<div id="topupCatalog">${tabs()+packs()}</div>`;
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{dialog.remove();if(lastFocus?.isConnected)lastFocus.focus();});document.body.append(dialog);dialog.showModal();paint();window.refreshDiamonds?.();
 };
})();
