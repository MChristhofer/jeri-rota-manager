(function(){
  const SERVICES_KEY='jeri-rota-manager-servicos-v1';
  const ROUTES_KEY='jeri-rota-manager-rotas-v1';
  const DEFAULT_SERVICES=[
    'Hilux compartilhada',
    'Hilux privativa',
    'Ônibus compartilhado',
    'Ônibus privativo',
    'Micro-ônibus compartilhado',
    'Micro-ônibus privativo',
    'Van compartilhada',
    'Van privativa'
  ];
  const DEFAULT_ROUTES=[
    {id:'jeri-fort',code:'Jeri-Fort',origin:'Jericoacoara',destination:'Fortaleza'},
    {id:'fort-jeri',code:'Fort-Jeri',origin:'Fortaleza',destination:'Jericoacoara'}
  ];

  const byId=id=>document.getElementById(id);

  function getServices(){
    let items=read(SERVICES_KEY);
    if(!items.length){items=[...DEFAULT_SERVICES];write(SERVICES_KEY,items)}
    return items;
  }

  function getRoutes(){
    let items=read(ROUTES_KEY);
    if(!items.length){items=DEFAULT_ROUTES.map(x=>({...x}));write(ROUTES_KEY,items)}
    return items;
  }

  function routeText(route){
    if(!route)return'';
    return `${route.code} — ${route.origin} → ${route.destination}`;
  }

  function routeForCode(code){
    return getRoutes().find(x=>x.code===code)||null;
  }

  function ensureOption(select,value,label=value){
    if(!select||!value)return;
    if(![...select.options].some(o=>o.value===value)){
      const option=document.createElement('option');
      option.value=value;
      option.textContent=label;
      select.appendChild(option);
    }
    select.value=value;
  }

  const serviceSelect=byId('serviceSelect');
  const serviceLabel=serviceSelect?.closest('label');
  let routeSelect=byId('routeSelect');

  if(serviceLabel&&!routeSelect){
    const routeLabel=document.createElement('label');
    routeLabel.innerHTML='Rota / Sentido<select id="routeSelect" required></select><small class="field-help">Ex.: Jeri-Fort = Jericoacoara → Fortaleza.</small>';
    serviceLabel.insertAdjacentElement('afterend',routeLabel);
    routeSelect=byId('routeSelect');
  }

  function renderServiceSelect(){
    if(!serviceSelect)return;
    const selected=serviceSelect.value;
    const services=getServices().slice().sort((a,b)=>a.localeCompare(b,'pt-BR'));
    serviceSelect.innerHTML='<option value="">Selecione...</option>'+services.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
    if(selected)ensureOption(serviceSelect,selected);
  }

  function renderRouteSelect(){
    if(!routeSelect)return;
    const selected=routeSelect.value;
    const routes=getRoutes().slice().sort((a,b)=>a.code.localeCompare(b.code,'pt-BR'));
    routeSelect.innerHTML='<option value="">Selecione...</option>'+routes.map(x=>`<option value="${escapeHtml(x.code)}">${escapeHtml(routeText(x))}</option>`).join('');
    if(selected){
      const route=routeForCode(selected);
      ensureOption(routeSelect,selected,route?routeText(route):selected);
    }
  }

  renderServiceSelect();
  renderRouteSelect();

  serviceSelect?.addEventListener('change',updatePreview);
  serviceSelect?.addEventListener('input',updatePreview);
  routeSelect?.addEventListener('change',updatePreview);
  routeSelect?.addEventListener('input',updatePreview);

  function addCatalogTabs(){
    const tabs=document.querySelector('.repasse-tabs');
    const main=document.querySelector('.main-content');
    if(!tabs||!main)return;

    if(!tabs.querySelector('[data-tab="servicos"]')){
      const button=document.createElement('button');
      button.className='repasse-tab';
      button.dataset.tab='servicos';
      button.type='button';
      button.textContent='Serviços';
      tabs.appendChild(button);
    }
    if(!tabs.querySelector('[data-tab="rotas"]')){
      const button=document.createElement('button');
      button.className='repasse-tab';
      button.dataset.tab='rotas';
      button.type='button';
      button.textContent='Rotas';
      tabs.appendChild(button);
    }

    if(!byId('tab-servicos')){
      const section=document.createElement('section');
      section.className='repasse-panel';
      section.id='tab-servicos';
      section.innerHTML=`
        <div class="section-heading"><div><p class="eyebrow">CADASTRO</p><h2>Serviços</h2><p>Edite os tipos de veículo e modalidade disponíveis nos repasses.</p></div></div>
        <article class="panel catalog-panel">
          <form id="serviceCatalogForm" class="catalog-form">
            <label>Nome do serviço<input id="newServiceInput" placeholder="Ex.: Hilux privativa" required></label>
            <button class="primary-button" type="submit">+ Adicionar serviço</button>
          </form>
          <div class="catalog-list" id="serviceCatalogList"></div>
          <div class="empty-state repasse-empty" id="serviceCatalogEmpty"><strong>Nenhum serviço cadastrado.</strong></div>
        </article>`;
      main.appendChild(section);
    }

    if(!byId('tab-rotas')){
      const section=document.createElement('section');
      section.className='repasse-panel';
      section.id='tab-rotas';
      section.innerHTML=`
        <div class="section-heading"><div><p class="eyebrow">ORIENTAÇÃO</p><h2>Rotas / Sentidos</h2><p>Defina a sigla e o sentido completo de origem para destino.</p></div></div>
        <article class="panel catalog-panel">
          <form id="routeCatalogForm" class="location-form">
            <label>Sigla da rota<input id="newRouteCode" placeholder="Ex.: Jeri-Fort" required></label>
            <label>Origem<input id="newRouteOrigin" placeholder="Ex.: Jericoacoara" required></label>
            <label>Destino<input id="newRouteDestination" placeholder="Ex.: Fortaleza" required></label>
            <div class="location-form-actions full"><button class="primary-button" type="submit">+ Adicionar rota</button></div>
          </form>
          <div class="catalog-list" id="routeCatalogList"></div>
          <div class="empty-state repasse-empty" id="routeCatalogEmpty"><strong>Nenhuma rota cadastrada.</strong></div>
        </article>`;
      main.appendChild(section);
    }
  }

  addCatalogTabs();

  function renderServiceCatalog(){
    const list=byId('serviceCatalogList');
    if(!list)return;
    const items=getServices().slice().sort((a,b)=>a.localeCompare(b,'pt-BR'));
    list.innerHTML=items.map(x=>`<div class="catalog-item"><div><strong>${escapeHtml(x)}</strong><small>Disponível no campo Serviço e na mensagem do WhatsApp</small></div><div class="catalog-actions"><button class="mini-button" data-service-edit="${encodeURIComponent(x)}">Editar</button><button class="mini-button" data-service-delete="${encodeURIComponent(x)}">Excluir</button></div></div>`).join('');
    const empty=byId('serviceCatalogEmpty');
    if(empty)empty.style.display=items.length?'none':'block';
    renderServiceSelect();
  }

  function renderRouteCatalog(){
    const list=byId('routeCatalogList');
    if(!list)return;
    const items=getRoutes().slice().sort((a,b)=>a.code.localeCompare(b.code,'pt-BR'));
    list.innerHTML=items.map(x=>`<div class="catalog-item"><div><strong>${escapeHtml(x.code)}</strong><small>${escapeHtml(x.origin)} → ${escapeHtml(x.destination)}</small></div><div class="catalog-actions"><button class="mini-button" data-route-edit="${x.id}">Editar</button><button class="mini-button" data-route-delete="${x.id}">Excluir</button></div></div>`).join('');
    const empty=byId('routeCatalogEmpty');
    if(empty)empty.style.display=items.length?'none':'block';
    renderRouteSelect();
  }

  byId('serviceCatalogForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const input=byId('newServiceInput');
    const name=input.value.trim();
    if(!name)return;
    const items=getServices();
    if(items.some(x=>x.toLowerCase()===name.toLowerCase()))return toast('Esse serviço já está cadastrado.');
    items.push(name);write(SERVICES_KEY,items);input.value='';renderServiceCatalog();renderHistory();toast('Serviço cadastrado.');
  });

  byId('serviceCatalogList')?.addEventListener('click',e=>{
    const edit=e.target.dataset.serviceEdit;
    const del=e.target.dataset.serviceDelete;
    if(edit){
      const old=decodeURIComponent(edit);
      const novo=prompt('Novo nome do serviço:',old);
      if(novo===null||!novo.trim())return;
      const items=getServices();
      const idx=items.indexOf(old);
      if(idx>=0){items[idx]=novo.trim();write(SERVICES_KEY,items);renderServiceCatalog();renderHistory();toast('Serviço atualizado.');}
    }
    if(del){
      const name=decodeURIComponent(del);
      if(confirm(`Excluir "${name}"?`)){write(SERVICES_KEY,getServices().filter(x=>x!==name));renderServiceCatalog();renderHistory();toast('Serviço excluído.');}
    }
  });

  byId('routeCatalogForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const code=byId('newRouteCode').value.trim();
    const origin=byId('newRouteOrigin').value.trim();
    const destination=byId('newRouteDestination').value.trim();
    if(!code||!origin||!destination)return;
    const items=getRoutes();
    if(items.some(x=>x.code.toLowerCase()===code.toLowerCase()))return toast('Essa rota já está cadastrada.');
    items.push({id:`route-${Date.now()}`,code,origin,destination});
    write(ROUTES_KEY,items);e.target.reset();renderRouteCatalog();renderHistory();toast('Rota cadastrada.');
  });

  byId('routeCatalogList')?.addEventListener('click',e=>{
    const edit=e.target.dataset.routeEdit;
    const del=e.target.dataset.routeDelete;
    const items=getRoutes();
    if(edit){
      const idx=items.findIndex(x=>String(x.id)===String(edit));
      if(idx<0)return;
      const current=items[idx];
      const code=prompt('Sigla da rota:',current.code);if(code===null||!code.trim())return;
      const origin=prompt('Origem:',current.origin);if(origin===null||!origin.trim())return;
      const destination=prompt('Destino:',current.destination);if(destination===null||!destination.trim())return;
      items[idx]={...current,code:code.trim(),origin:origin.trim(),destination:destination.trim()};
      write(ROUTES_KEY,items);renderRouteCatalog();renderHistory();toast('Rota atualizada.');
    }
    if(del){
      const route=items.find(x=>String(x.id)===String(del));
      if(route&&confirm(`Excluir rota "${route.code}"?`)){write(ROUTES_KEY,items.filter(x=>String(x.id)!==String(del)));renderRouteCatalog();renderHistory();toast('Rota excluída.');}
    }
  });

  renderServiceCatalog();
  renderRouteCatalog();

  const previousFormData=formData;
  formData=function(){
    const data=previousFormData();
    const route=routeForCode(routeSelect?.value||'');
    return{
      ...data,
      service:serviceSelect?.value||'',
      route:routeSelect?.value||'',
      routeOrigin:route?.origin||'',
      routeDestination:route?.destination||'',
      routeLabel:route?routeText(route):(routeSelect?.selectedOptions?.[0]?.textContent||'')
    };
  };

  message=function(data,code){
    const phones=Array.isArray(data.phones)&&data.phones.length
      ?data.phones.map(p=>p.phone).filter(Boolean)
      :[data.phone].filter(Boolean);
    const lines=[`Código: ${code}`];
    if(data.date)lines.push(`Ida: ${brDate(data.date)}`);
    if(data.returnDate)lines.push(`Volta: ${brDate(data.returnDate)}`);
    if(data.tour)lines.push(`Passeio: ${data.tour}`);
    if(data.service)lines.push(`Serviço: ${data.service}`);
    if(data.routeLabel||data.route){lines.push(`Rota: ${data.routeLabel||data.route}`);}
    if(data.boarding)lines.push(`Embarque: ${data.boarding}`);
    if(data.apartment)lines.push(`AP / Quarto: ${data.apartment}`);
    if(data.names)lines.push(`Passageiro(s): ${data.names}`);
    if(phones.length>1)lines.push(`Telefones: ${phones.join(' / ')}`);
    else if(phones[0])lines.push(`Telefone: ${phones[0]}`);
    if(data.people)lines.push(`Quantidade: ${data.people} pessoa${data.people===1?'':'s'}`);
    lines.push(`Valor a receber: ${currency.format(data.amount||0)}`);
    return lines.join('\n');
  };

  const previousEditRepasse=editRepasse;
  editRepasse=function(id){
    const item=getRepasses().find(x=>x.id===id);
    previousEditRepasse(id);
    if(!item)return;
    if(item.service)ensureOption(serviceSelect,item.service);
    if(item.route){
      const label=item.routeLabel||[item.route,item.routeOrigin&&item.routeDestination?`${item.routeOrigin} → ${item.routeDestination}`:''].filter(Boolean).join(' — ');
      ensureOption(routeSelect,item.route,label);
    }
    updatePreview();
  };

  const previousResetRepasseForm=resetRepasseForm;
  resetRepasseForm=function(){
    previousResetRepasseForm();
    if(serviceSelect)serviceSelect.value='';
    if(routeSelect)routeSelect.value='';
    updatePreview();
  };

  function installHistoryRouteFilter(){
    const serviceFilter=byId('historyService');
    if(!serviceFilter||byId('historyRoute'))return;
    const label=document.createElement('label');
    label.innerHTML='Rota<select id="historyRoute"><option value="">Todas as rotas</option></select>';
    serviceFilter.closest('label')?.insertAdjacentElement('afterend',label);
    byId('historyRoute')?.addEventListener('change',()=>renderHistory());

    const header=document.querySelector('#tab-historico thead tr');
    if(header&&![...header.children].some(th=>th.textContent.trim()==='Rota')){
      const serviceTh=[...header.children].find(th=>th.textContent.trim()==='Serviço');
      const th=document.createElement('th');th.textContent='Rota';serviceTh?.insertAdjacentElement('afterend',th);
    }
  }

  installHistoryRouteFilter();

  function updateHistoryFilters(){
    const serviceFilter=byId('historyService');
    if(serviceFilter){
      const selected=serviceFilter.value;
      const values=[...new Set([...getServices(),...getRepasses().map(x=>x.service).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      serviceFilter.innerHTML='<option value="">Todos os serviços</option>'+values.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
      if(selected)ensureOption(serviceFilter,selected);
    }
    const routeFilter=byId('historyRoute');
    if(routeFilter){
      const selected=routeFilter.value;
      const current=getRoutes().map(x=>({code:x.code,label:routeText(x)}));
      const historical=getRepasses().filter(x=>x.route).map(x=>({code:x.route,label:x.routeLabel||x.route}));
      const map=new Map([...current,...historical].map(x=>[x.code,x.label]));
      routeFilter.innerHTML='<option value="">Todas as rotas</option>'+[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')).map(([code,label])=>`<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`).join('');
      if(selected)ensureOption(routeFilter,selected,map.get(selected)||selected);
    }
  }

  renderHistory=function(){
    updateHistoryFilters();
    const code=(byId('historyCode')?.value||'').trim().toLowerCase();
    const date=byId('historyDate')?.value||'';
    const tour=byId('historyTour')?.value||'';
    const service=byId('historyService')?.value||'';
    const route=byId('historyRoute')?.value||'';
    const status=byId('historyStatus')?.value||'';
    const q=(byId('historySearch')?.value||'').trim().toLowerCase();

    const items=getRepasses().filter(x=>{
      const extraPhones=Array.isArray(x.phones)?x.phones.map(p=>`${p.phone||''} ${p.phoneE164||''}`).join(' '):'';
      const generalText=`${x.names||''} ${x.phone||''} ${x.phoneE164||''} ${extraPhones} ${x.boarding||''} ${x.apartment||''} ${x.service||''} ${x.route||''} ${x.routeLabel||''}`.toLowerCase();
      return (!code||String(x.code||'').toLowerCase().includes(code))
        &&(!date||x.date===date||x.returnDate===date)
        &&(!tour||x.tour===tour)
        &&(!service||x.service===service)
        &&(!route||x.route===route)
        &&(!status||x.status===status)
        &&(!q||generalText.includes(q));
    });

    const body=byId('historyBody');
    if(body){
      body.innerHTML=items.map(x=>{
        const dates=[x.date?`Ida: ${brDate(x.date)}`:'',x.returnDate?`Volta: ${brDate(x.returnDate)}`:''].filter(Boolean).join('<br>')||'—';
        const routeLabel=x.routeLabel||([x.route,x.routeOrigin&&x.routeDestination?`${x.routeOrigin} → ${x.routeDestination}`:''].filter(Boolean).join(' — '))||'—';
        return `<tr><td><strong>${escapeHtml(x.code)}</strong></td><td>${dates}</td><td>${escapeHtml(x.tour||'—')}</td><td>${escapeHtml(x.service||'—')}</td><td>${escapeHtml(routeLabel)}</td><td>${escapeHtml(x.boarding||'—')}<small><a href="${mapUrl(locationMapQuery(x.boarding))}" target="_blank" rel="noopener">Ver no Maps</a></small></td><td>${escapeHtml(x.names||'—')}</td><td>${x.people||1}</td><td><strong>${currency.format(x.amount||0)}</strong></td><td><select class="status-select" data-repasse-status-select="${x.id}" aria-label="Status de ${escapeHtml(x.code)}">${STATUS.map(s=>`<option value="${s}"${s===x.status?' selected':''}>${s}</option>`).join('')}</select></td><td><div class="repasse-row-actions"><button class="mini-button" data-repasse-edit="${x.id}">Editar</button><button class="mini-button maps" data-repasse-wa="${x.id}">WhatsApp</button><button class="mini-button" data-repasse-delete="${x.id}">Excluir</button></div></td></tr>`;
      }).join('');
    }
    const empty=byId('historyEmpty');if(empty)empty.style.display=items.length?'none':'block';
    const count=byId('historyResultCount');if(count)count.textContent=`${items.length} ${items.length===1?'repasse encontrado':'repasses encontrados'}`;
  };
  window.renderHistory=renderHistory;

  byId('historyService')?.addEventListener('change',renderHistory);
  byId('historyRoute')?.addEventListener('change',renderHistory);

  const clearButton=byId('clearHistoryFilters');
  clearButton?.addEventListener('click',()=>{if(byId('historyRoute'))byId('historyRoute').value='';if(byId('historyService'))byId('historyService').value='';setTimeout(renderHistory,0)});

  updatePreview();
  renderHistory();
})();