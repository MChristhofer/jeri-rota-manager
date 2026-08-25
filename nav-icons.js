(function(){
  const iconBySection={
    dashboard:'ph-house',
    reservas:'ph-calendar-check',
    servicos:'ph-briefcase',
    operacao:'ph-steering-wheel',
    financeiro:'ph-wallet',
    prestacao:'ph-receipt'
  };

  function ensurePhosphor(){
    if(document.querySelector('link[data-phosphor-icons]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css';
    link.dataset.phosphorIcons='1';
    document.head.appendChild(link);
  }

  function iconClass(item){
    if(item.id==='logoutSystemButton')return 'ph-sign-out';
    if(item.matches('a[href*="repasses.html"]'))return 'ph-arrows-left-right';
    return iconBySection[item.dataset.section]||'ph-circle';
  }

  function decorateItem(item){
    if(!item||item.dataset.phosphorReady==='1')return;
    const old=item.querySelector(':scope > span');
    if(old)old.remove();
    const icon=document.createElement('i');
    icon.className=`ph ${iconClass(item)} nav-icon`;
    icon.setAttribute('aria-hidden','true');
    item.prepend(icon);
    item.dataset.phosphorReady='1';
  }

  function decorateAll(){
    document.querySelectorAll('.main-nav .nav-item, #logoutSystemButton').forEach(decorateItem);
  }

  ensurePhosphor();
  decorateAll();

  const nav=document.querySelector('.main-nav');
  if(nav)new MutationObserver(decorateAll).observe(nav,{childList:true,subtree:true});
})();
