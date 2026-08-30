(function(){
  const client=window.jeriSupabase;
  const main=document.querySelector('.main-content');
  const navRoot=document.querySelector('.main-nav');
  if(!client||!main||!navRoot)return;

  const byId=id=>document.getElementById(id);
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const parseMoney=value=>{const raw=String(value??'').trim();return Math.max(0,Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw)||0)};
  const formatMoney=value=>Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  let services=[];
  let editingServiceId=null;

  if(!document.querySelector('link[href^="manager-services-section.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='manager-services-section.css?v=20260830-3';
    document.head.appendChild(link);
  }

  let nav=[...navRoot.querySelectorAll('.nav-item')].find(x=>x.dataset.section==='servicos');
  if(!nav){
    nav=document.createElement('button');
    nav.className='nav-item';
    nav.type='button';
    nav.dataset.section='servicos';
    nav.innerHTML='<span>◆</span> Serviços';
    const repasses=[...navRoot.querySelectorAll('.nav-item')].find(x=>/Repasses/i.test(x.textContent||''));
    if(repasses)navRoot.insertBefore(nav,repasses);else navRoot.appendChild(nav);
  }

  let section=byId('servicos');
  if(!section){
    section=document.createElement('section');
    section.className='content-section manager-services-section';
    section.id='servicos';
    section.innerHTML=`
      <div class="section-heading manager-services-heading">
        <div>
          <p class="eyebrow">CATÁLOGO</p>
          <h2>Serviços</h2>
          <p>Cadastre as combinações de serviço, veículo, modalidade e NET disponíveis nas reservas.</p>
        </div>
        <button type="button" class="primary-button" id="managerNewService">+ Novo serviço</button>
      </div>
      <div class="manager-services-grid">
        <article class="panel manager-services-panel">
          <div class="panel-head">
            <div><p class="eyebrow">CADASTRO</p><h3 id="managerServiceFormTitle">Novo serviço</h3></div>
            <span id="managerServiceCount"></span>
          </div>
          <form id="managerServiceForm" class="manager-service-form">
            <label class="full">Serviço / rota *<input id="managerServiceName" placeholder="Ex.: Fortaleza → Jericoacoara" required></label>
            <label class="manager-service-compat-field">Categoria<select id="managerServiceCategory"><option>Transfer</option><option>Passeio</option><option>Hospedagem</option><option>Outro</option></select></label>
            <label>Veículo <span class="optional-label">opcional</span><input id="managerServiceVehicle" placeholder="Ex.: Hilux, van ou ônibus"></label>
            <label>Modalidade<select id="managerServiceModality"><option>Compartilhado</option><option>Privativo</option><option>Regular</option><option>Outro</option></select></label>
            <label class="manager-service-compat-field">Origem<input id="managerServiceOrigin"></label>
            <label class="manager-service-compat-field">Destino<input id="managerServiceDestination"></label>
            <label class="manager-service-compat-field">Sigla / identificação da rota<input id="managerServiceRoute"></label>
            <label class="manager-service-compat-field">Base do NET<select id="managerServiceBasis"><option value="fixed">Valor fixo</option><option value="per_person">Por pessoa</option><option value="per_vehicle">Por veículo</option></select></label>
            <label>NET padrão *<input id="managerServiceNet" type="text" inputmode="decimal" placeholder="0,00" required></label>
            <label class="manager-service-compat-field">Venda padrão (R$)<input id="managerServiceSale" type="number" min="0" step="0.01"></label>
            <label class="manager-service-compat-field">Regra financeira<select id="managerServiceReceipt"><option value="net_first">NET primeiro</option><option value="commission_first">Comissão primeiro</option></select></label>
            <label>Status<select id="managerServiceActive"><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
            <label class="manager-service-compat-field">Parceiro / motorista padrão<input id="managerServicePartner"></label>
            <label class="manager-service-compat-field">WhatsApp padrão<input id="managerServicePartnerPhone"></label>
            <div class="manager-service-help"><strong>Uso na Reserva:</strong> este cadastro alimenta diretamente o seletor de serviços da reserva. O NET é carregado como padrão e continua editável na reserva. Embarque e desembarque são informados somente na reserva.</div>
            <div class="manager-service-actions"><button type="button" class="outline-button" id="managerServiceCancel" style="display:none">Cancelar</button><button class="primary-button" type="submit" id="managerServiceSave">Salvar serviço</button></div>
          </form>
        </article>
        <article class="panel manager-services-panel">
          <div class="panel-head"><div><p class="eyebrow">SERVIÇOS CADASTRADOS</p><h3>Disponíveis nas reservas</h3></div></div>
          <div class="manager-service-list" id="managerServiceList"></div>
        </article>
      </div>`;
    main.appendChild(section);
  }

  function notifyCatalogChanged(reason='updated'){
    window.jeriServiceCatalog=services;
    window.dispatchEvent(new CustomEvent('jeri-service-catalog-changed',{detail:{reason,services}}));
  }

  function showSection(){
    if(typeof setSection==='function')setSection('servicos');
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===nav));
    const title=byId('pageTitle');if(title)title.textContent='Serviços e NET';
    const newButton=byId('newReservationButton');if(newButton)newButton.style.display='none';
    byId('sidebar')?.classList.remove('open');
    loadAll();
  }

  nav.addEventListener('click',showSection);
  document.querySelectorAll('.main-nav .nav-item').forEach(item=>{
    if(item!==nav)item.addEventListener('click',()=>{const b=byId('newReservationButton');if(b&&item.dataset.section!=='repasses')b.style.display=''});
  });

  function serviceFormRow(){
    return{
      name:byId('managerServiceName').value.trim(),
      category:byId('managerServiceCategory').value||null,
      modality:byId('managerServiceModality').value||null,
      vehicle_type:byId('managerServiceVehicle').value.trim()||null,
      origin:byId('managerServiceOrigin').value.trim()||null,
      destination:byId('managerServiceDestination').value.trim()||null,
      route_code:byId('managerServiceRoute').value.trim()||null,
      pricing_basis:'fixed',
      net_value:parseMoney(byId('managerServiceNet').value),
      default_sale_value:byId('managerServiceSale').value===''?null:Number(byId('managerServiceSale').value)||0,
      receipt_rule:byId('managerServiceReceipt').value,
      active:byId('managerServiceActive').value==='true',
      default_partner_name:byId('managerServicePartner').value.trim()||null,
      default_partner_phone:byId('managerServicePartnerPhone').value.trim()||null,
      updated_at:new Date().toISOString()
    };
  }

  function resetServiceForm(){
    editingServiceId=null;
    byId('managerServiceForm')?.reset();
    byId('managerServiceCategory').value='Transfer';
    byId('managerServiceModality').value='Compartilhado';
    byId('managerServiceBasis').value='fixed';
    byId('managerServiceReceipt').value='net_first';
    byId('managerServiceActive').value='true';
    byId('managerServiceNet').value='';
    byId('managerServiceSave').textContent='Salvar serviço';
    byId('managerServiceFormTitle').textContent='Novo serviço';
    byId('managerServiceCancel').style.display='none';
  }

  function editService(item,{duplicate=false}={}){
    editingServiceId=duplicate?null:item.id;
    byId('managerServiceName').value=item.name||'';
    byId('managerServiceVehicle').value=item.vehicle_type||'';
    byId('managerServiceCategory').value=item.category||'Transfer';
    byId('managerServiceModality').value=item.modality||'Compartilhado';
    byId('managerServiceOrigin').value=item.origin||'';
    byId('managerServiceDestination').value=item.destination||'';
    byId('managerServiceRoute').value=item.route_code||'';
    byId('managerServiceBasis').value='fixed';
    byId('managerServiceNet').value=formatMoney(item.net_value);
    byId('managerServiceSale').value=item.default_sale_value??'';
    byId('managerServiceReceipt').value=item.receipt_rule||'net_first';
    byId('managerServiceActive').value=String(item.active!==false);
    byId('managerServicePartner').value=item.default_partner_name||'';
    byId('managerServicePartnerPhone').value=item.default_partner_phone||'';
    byId('managerServiceSave').textContent=duplicate?'Criar cópia':'Salvar alterações';
    byId('managerServiceFormTitle').textContent=duplicate?'Duplicar serviço':'Editar serviço';
    byId('managerServiceCancel').style.display='inline-flex';
    byId('managerServiceName').focus();
  }

  function renderServices(){
    const host=byId('managerServiceList');if(!host)return;
    byId('managerServiceCount').textContent=`${services.length} ${services.length===1?'serviço':'serviços'}`;
    if(!services.length){host.innerHTML='<div class="manager-services-empty">Nenhum serviço cadastrado.</div>';return;}
    host.innerHTML=`<div class="manager-service-table-head"><span>Serviço / rota</span><span>Veículo</span><span>Modalidade</span><span>NET padrão</span><span>Status</span><span>Ações</span></div>`+
      services.map(x=>`<div class="manager-service-card">
        <div class="manager-service-main"><strong>${esc(x.name||'Serviço')}</strong></div>
        <span>${esc(x.vehicle_type||'—')}</span>
        <span>${esc(x.modality||'—')}</span>
        <strong>${money(x.net_value)}</strong>
        <span class="manager-service-tag ${x.active?'':'inactive'}">${x.active?'Ativo':'Inativo'}</span>
        <div class="manager-card-actions">
          <button class="mini-button" data-service-edit="${x.id}">Editar</button>
          <button class="mini-button" data-service-duplicate="${x.id}">Duplicar</button>
          <button class="mini-button" data-service-toggle="${x.id}">${x.active?'Desativar':'Ativar'}</button>
          <button class="mini-button manager-delete-service" data-service-delete="${x.id}">Excluir</button>
        </div>
      </div>`).join('');
  }

  async function loadAll(reason='loaded'){
    const {data,error}=await client.from('service_catalog').select('*').order('name').order('modality');
    if(error){console.error('Não foi possível carregar os serviços:',error);return;}
    services=data||[];
    renderServices();
    notifyCatalogChanged(reason);
  }

  async function deleteService(item){
    if(!item)return;
    const label=item.name||'este serviço';
    if(!confirm(`Excluir “${label}” do catálogo?\n\nEsta ação só será permitida se o serviço ainda não estiver ligado a nenhuma reserva.`))return;

    try{
      const usage=await client.from('reservation_services').select('id').eq('service_catalog_id',item.id).limit(1);
      if(!usage.error&&(usage.data||[]).length){
        alert('Este serviço já está ligado a uma reserva e não pode ser excluído sem afetar o histórico. Use “Desativar” para impedir novas seleções.');
        return;
      }
      if(usage.error)console.warn('Não foi possível validar o uso do serviço antes da exclusão:',usage.error);

      const result=await client.from('service_catalog').delete().eq('id',item.id);
      if(result.error){
        alert('Não foi possível excluir o serviço. Se ele já foi usado em reservas, desative-o para preservar o histórico.');
        console.error(result.error);
        return;
      }
      if(String(editingServiceId)===String(item.id))resetServiceForm();
      await loadAll('deleted');
    }catch(error){
      console.error(error);
      alert('Não foi possível excluir o serviço.');
    }
  }

  byId('managerServiceForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const row=serviceFormRow();if(!row.name)return;
    const result=editingServiceId
      ?await client.from('service_catalog').update(row).eq('id',editingServiceId)
      :await client.from('service_catalog').insert(row);
    if(result.error){
      alert('Não foi possível salvar o serviço. Verifique se já existe um cadastro igual.');
      console.error(result.error);
      return;
    }
    resetServiceForm();
    await loadAll(editingServiceId?'updated':'created');
  });

  byId('managerServiceCancel')?.addEventListener('click',resetServiceForm);
  byId('managerNewService')?.addEventListener('click',()=>{resetServiceForm();byId('managerServiceName')?.focus()});
  byId('managerServiceNet')?.addEventListener('focus',e=>e.currentTarget.select());
  byId('managerServiceNet')?.addEventListener('blur',e=>{if(e.currentTarget.value.trim()!=='')e.currentTarget.value=formatMoney(parseMoney(e.currentTarget.value))});

  byId('managerServiceList')?.addEventListener('click',async e=>{
    const edit=e.target.dataset.serviceEdit;
    const duplicate=e.target.dataset.serviceDuplicate;
    const toggle=e.target.dataset.serviceToggle;
    const remove=e.target.dataset.serviceDelete;

    if(edit){const item=services.find(x=>String(x.id)===String(edit));if(item)editService(item);return;}
    if(duplicate){const item=services.find(x=>String(x.id)===String(duplicate));if(item)editService(item,{duplicate:true});return;}
    if(toggle){
      const item=services.find(x=>String(x.id)===String(toggle));
      if(item){
        const {error}=await client.from('service_catalog').update({active:!item.active,updated_at:new Date().toISOString()}).eq('id',toggle);
        if(error){console.error(error);alert('Não foi possível alterar o status do serviço.');return;}
        await loadAll('status');
      }
      return;
    }
    if(remove){const item=services.find(x=>String(x.id)===String(remove));await deleteService(item);}
  });

  resetServiceForm();
})();
