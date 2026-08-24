(function(){
  const byId=id=>document.getElementById(id);

  function goToTab(name){
    if(typeof activateTab==='function'){
      activateTab(name);
      return;
    }
    document.querySelectorAll('.repasse-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.tab===name));
    document.querySelectorAll('.repasse-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`tab-${name}`));
  }

  // As abas Serviços e Rotas são criadas depois do carregamento do script principal.
  // Delegação garante que elas também possam ser abertas normalmente.
  document.querySelector('.repasse-tabs')?.addEventListener('click',event=>{
    const tab=event.target.closest('.repasse-tab[data-tab]');
    if(!tab)return;
    goToTab(tab.dataset.tab);
  });

  function addEditShortcut(selectId,tabName,label){
    const select=byId(selectId);
    const field=select?.closest('label');
    if(!select||!field||field.querySelector(`[data-edit-catalog="${tabName}"]`))return;

    const button=document.createElement('button');
    button.type='button';
    button.className='text-button';
    button.dataset.editCatalog=tabName;
    button.textContent=label;
    button.style.marginTop='7px';
    button.style.alignSelf='flex-start';
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      goToTab(tabName);
    });
    field.appendChild(button);
  }

  addEditShortcut('serviceSelect','servicos','Editar serviços');
  addEditShortcut('routeSelect','rotas','Editar rotas / sentidos');

  const serviceTab=document.querySelector('.repasse-tab[data-tab="servicos"]');
  if(serviceTab)serviceTab.textContent='Serviços';
  const routeTab=document.querySelector('.repasse-tab[data-tab="rotas"]');
  if(routeTab)routeTab.textContent='Rotas / Sentidos';
})();