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
            <label class="full manager-service-image-field">Imagem principal do voucher
              <input id="managerServiceImage" type="file" accept="image/jpeg,image/png,image/webp">
              <small>Usada automaticamente no Voucher Premium. JPG, PNG ou WEBP até 5 MB.</small>
              <div id="managerServiceImagePreview" class="manager-service-image-preview"></div>
            </label>
            <label>Categoria<select id="managerServiceCategory"><option>Transfer</option><option>Passeio</option><option>Hospedagem</option><option>Outro</option></select></label>
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
            <fieldset class="manager-commercial-fieldset">
              <legend>Cérebro Comercial · Informações para o bot</legend>
              <p class="manager-commercial-help">Horários e condições oficiais deste serviço. Nunca cadastre NET, telefone de parceiros, comissões ou valores internos nestes campos.</p>
              <div class="manager-commercial-grid">
                <label>Sentido<select id="managerCommercialDirection"><option value="ida">Ida</option><option value="volta">Volta</option><option value="local">Transfer local</option><option value="passeio">Passeio</option><option value="ambos">Ambos (somente se horários iguais)</option><option value="especial">Especializado</option></select></label>
                <label>Atendimento<select id="managerCommercialOperation"><option value="regular">Regular</option><option value="especializado">Especializado / sob consulta</option></select></label>
                <label>Saída fixa<input id="managerCommercialDeparture" type="time"></label>
                <label>Janela de saída (início)<input id="managerCommercialStart" type="time"></label>
                <label>Janela de saída (fim)<input id="managerCommercialEnd" type="time"></label>
                <label>Chegada estimada<input id="managerCommercialArrival" type="time"></label>
                <label>Duração estimada (minutos)<input id="managerCommercialDuration" type="number" min="1" max="3000"></label>
                <label>Troca para 4x4?<select id="managerCommercialChange"><option value="false">Não confirmada</option><option value="true">Sim</option></select></label>
                <label>Local da troca<input id="managerCommercialChangePlace" maxlength="150" placeholder="Jijoca"></label>
                <label>Tempo da troca/trecho (min)<input id="managerCommercialChangeMinutes" type="number" min="1" max="500"></label>
                <label class="wide">Detalhes da saída<textarea id="managerCommercialDepartureNotes" maxlength="1000" rows="2"></textarea></label>
                <label class="wide">Detalhes da chegada<textarea id="managerCommercialArrivalNotes" maxlength="1000" rows="2"></textarea></label>
                <label class="wide">Inclusões confirmadas<textarea id="managerCommercialIncludes" maxlength="1000" rows="2"></textarea></label>
                <label class="wide">Paradas / roteiro (resumo)<textarea id="managerCommercialStops" maxlength="1000" rows="2"></textarea></label>
                <label class="wide">Paradas ordenadas · cérebro do bot
                  <textarea id="managerCommercialItinerary" rows="7" spellcheck="false" placeholder="Árvore da Preguiça | | | | Parada para fotos&#10;Lagun Beach | 50 | 50 | 50 | Banho e descanso"></textarea>
                  <small>Uma parada por linha: Nome | minutos | entrada mínima R$ | entrada máxima R$ | descrição. Deixe vazio quando não houver tempo/taxa confirmados. Não colocar o preço do passeio aqui.</small>
                </label>
                <label class="wide">Condições públicas e restrições<textarea id="managerCommercialConditions" maxlength="1300" rows="3"></textarea></label>
                <label>Preço anunciado / pessoa (R$)<input id="managerCommercialPrice" type="number" min="0" step="0.01" placeholder="180.00"></label>
                <label>Taxa turística / pessoa (R$)<input id="managerCommercialTourismFee" type="number" min="0" step="0.01" placeholder="41.50"></label>
                <label>Data de revisão da oferta<input id="managerCommercialPriceReviewed" type="date"></label>
                <label class="wide">Embarques (uma linha por local, horário | local | observação)<textarea id="managerCommercialBoarding" rows="4" placeholder="02:30 | Praia do Futuro |&#10;03:00 | Av. Beira Mar |"></textarea></label>
                <label class="wide">Regra de bagagem<textarea id="managerCommercialBaggage" maxlength="1200" rows="2"></textarea></label>
                <label class="wide">Formas de pagamento<textarea id="managerCommercialPayment" maxlength="1200" rows="2"></textarea></label>
                <label class="wide">Condições de reserva<textarea id="managerCommercialReservation" maxlength="1200" rows="2"></textarea></label>
                <label class="wide manager-commercial-publish">Disponível para o bot<select id="managerCommercialEnabled"><option value="false">Não — rascunho</option><option value="true">Sim — informação aprovada</option></select></label>
              </div>
              <p class="manager-commercial-help">Cada serviço tem seu próprio perfil. Se a ida e a volta têm horários diferentes, cadastre informações separadamente em cada serviço correspondente.</p>
            </fieldset>
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

  const commercialFields={
    direction:'managerCommercialDirection',operation_type:'managerCommercialOperation',
    departure_time:'managerCommercialDeparture',departure_window_start:'managerCommercialStart',
    departure_window_end:'managerCommercialEnd',arrival_time:'managerCommercialArrival',
    estimated_minutes:'managerCommercialDuration',departure_notes:'managerCommercialDepartureNotes',
    arrival_notes:'managerCommercialArrivalNotes',included_services:'managerCommercialIncludes',
    stops_description:'managerCommercialStops',requires_vehicle_change:'managerCommercialChange',
    vehicle_change_place:'managerCommercialChangePlace',
    vehicle_change_minutes:'managerCommercialChangeMinutes',
    public_conditions:'managerCommercialConditions',bot_enabled:'managerCommercialEnabled',
    advertised_price_per_person:'managerCommercialPrice',
    tourism_fee_per_person:'managerCommercialTourismFee',
    price_reviewed_at:'managerCommercialPriceReviewed',
    baggage_policy:'managerCommercialBaggage',
    payment_terms:'managerCommercialPayment',
    reservation_terms:'managerCommercialReservation'
  };
  const blankCommercial=()=>({direction:'ida',operation_type:'regular',bot_enabled:false,requires_vehicle_change:false});
  let commercialProfiles=new Map();
  function parseItineraryEditor(){
    const linhas=String(byId('managerCommercialItinerary')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(linhas.length>30)throw new Error('Máximo de 30 paradas.');
    return linhas.map((linha,index)=>{
      const partes=linha.split('|').map(x=>x.trim());
      if(partes.length!==5||!partes[0]||partes[0].length>90)throw new Error('Linha '+(index+1)+': use Nome | minutos | entrada mínima | entrada máxima | descrição.');
      const numero=(v,tipo)=>{if(!v)return null;const raw=v.replace(',','.');const n=Number(raw);if(!Number.isFinite(n)||n<0||n>10000)throw new Error('Valor inválido em '+tipo+' na linha '+(index+1));return n};
      const tempo=numero(partes[1],'minutos'),min=numero(partes[2],'entrada mínima'),max=numero(partes[3],'entrada máxima');
      if(tempo!==null&&(!Number.isInteger(tempo)||tempo<1))throw new Error('Minutos inválidos na linha '+(index+1));
      if((min===null)!==(max===null))throw new Error('Informe os dois valores da entrada na linha '+(index+1));
      if(min!==null&&max<min)throw new Error('Entrada máxima menor que mínima na linha '+(index+1));
      if(partes[4].length>180)throw new Error('Descrição longa na linha '+(index+1));
      return {order:index+1,name:partes[0],type:'parada',duration_minutes:tempo,admission_brl_min:min,admission_brl_max:max,description:partes[4]};
    });
  }
  function formatItineraryEditor(paradas){
    if(!Array.isArray(paradas))return '';
    return [...paradas].sort((a,b)=>(a.order||0)-(b.order||0)).map(p=>[
      String(p.name||'').replace(/[|\n]/g,' '),
      p.duration_minutes??'',p.admission_brl_min??'',p.admission_brl_max??'',
      String(p.description||'').replace(/[|\n]/g,' ')
    ].join(' | ')).join('\n');
  }

  function commercialFormRow(){
    const row={};
    for(const [field,id] of Object.entries(commercialFields)){
      const input=byId(id);const raw=String(input?.value??'').trim();
      if(field==='bot_enabled'||field==='requires_vehicle_change')row[field]=raw==='true';
      else if(field==='estimated_minutes'||field==='vehicle_change_minutes')row[field]=raw?Number(raw):null;
      else if(['departure_time','arrival_time','departure_window_start','departure_window_end'].includes(field))row[field]=raw||null;
      else row[field]=raw||(['direction','operation_type'].includes(field)?(field==='direction'?'ida':'regular'):'');
    }
    row.itinerary_stops=parseItineraryEditor();
    row.boarding_points=String(byId('managerCommercialBoarding')?.value||'')
      .split(/\r?\n/).map(v=>v.trim()).filter(Boolean).map((linha,i)=>{
        const p=linha.split('|').map(v=>v.trim());
        if(p.length!==3||!p[1]||(p[0]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[0])))
          throw new Error('Embarque '+(i+1)+': informe HH:MM | Local | Observação.');
        return {order:i+1,time:p[0]||null,name:p[1],notes:p[2]};
      });
    for(const k of ['advertised_price_per_person','tourism_fee_per_person']){
      if(row[k]!==''){const v=Number(row[k]);if(!Number.isFinite(v)||v<0)throw new Error('Preço ou taxa inválida');row[k]=v;}
      else row[k]=null;
    }
    row.price_reviewed_at=row.price_reviewed_at||null;
    return row;
  }
  function loadCommercialForm(profile){
    const values={...blankCommercial(),...(profile||{})};
    if(byId('managerCommercialItinerary'))byId('managerCommercialItinerary').value=formatItineraryEditor(values.itinerary_stops);
    if(byId('managerCommercialBoarding'))byId('managerCommercialBoarding').value=
      (Array.isArray(values.boarding_points)?values.boarding_points:[])
      .map(p=>[p.time||'',p.name||'',p.notes||''].join(' | ')).join('\n');
    for(const [field,id] of Object.entries(commercialFields)){
      if(!byId(id))continue;
      const value=values[field];
      byId(id).value=typeof value==='boolean'?String(value):
        ['departure_time','arrival_time','departure_window_start','departure_window_end'].includes(field)
          ?String(value||'').slice(0,5):String(value??'');
    }
  }
  async function loadCommercialProfiles(){
    const {data,error}=await client.from('service_commercial_profiles').select('*');
    if(error){console.error('[COMERCIAL] Falha de leitura:',error);return false;}
    commercialProfiles=new Map((data||[]).map(p=>[String(p.service_catalog_id),p]));
    return true;
  }
  async function saveCommercialProfile(serviceId,profile){
    const {error}=await client.from('service_commercial_profiles').upsert({
      service_catalog_id:serviceId,...profile,updated_at:new Date().toISOString()
    },{onConflict:'service_catalog_id'});
    if(error)throw error;
  }

  function serviceFormRow(){
    return{
      name:byId('managerServiceName').value.trim(),
      category:byId('managerServiceCategory').value||null,
      modality:byId('managerServiceModality').value||null,
      vehicle_type:byId('managerServiceVehicle').value.trim()||null,
      origin:byId('managerServiceOrigin').value.trim()||null,
      destination:byId('managerServiceDestination').value.trim()||null,
      route_code:byId('managerServiceRoute').value.trim()||null,
      pricing_basis:window.JeriFinance.basis(byId('managerServiceModality').value),
      net_value:parseMoney(byId('managerServiceNet').value),
      default_sale_value:byId('managerServiceSale').value===''?null:Number(byId('managerServiceSale').value)||0,
      receipt_rule:byId('managerServiceReceipt').value,
      active:byId('managerServiceActive').value==='true',
      default_partner_name:byId('managerServicePartner').value.trim()||null,
      default_partner_phone:byId('managerServicePartnerPhone').value.trim()||null,
      voucher_image_path:editingServiceId?(services.find(x=>String(x.id)===String(editingServiceId))?.voucher_image_path||null):null,
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
    loadCommercialForm(null);
    if(byId('managerServiceImage'))byId('managerServiceImage').value='';
    if(byId('managerServiceImagePreview'))byId('managerServiceImagePreview').innerHTML='';
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
    loadCommercialForm(duplicate?commercialProfiles.get(String(item.id)):commercialProfiles.get(String(item.id)));
    if(byId('managerServiceImage'))byId('managerServiceImage').value='';
    const publicImage=item.voucher_image_path?client.storage.from('service-images').getPublicUrl(item.voucher_image_path).data.publicUrl:'';
    if(byId('managerServiceImagePreview'))byId('managerServiceImagePreview').innerHTML=publicImage?'<img src="'+esc(publicImage)+'" alt="Imagem atual do serviço"><span>Imagem atual</span>':'<span>Sem imagem cadastrada</span>';
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
        <div class="manager-service-main">${x.voucher_image_path?`<img class="manager-service-thumb" src="${esc(client.storage.from('service-images').getPublicUrl(x.voucher_image_path).data.publicUrl)}" alt="">`:``}<div><strong>${esc(x.name||'Serviço')}</strong><small>${esc(x.category||'Serviço')}</small></div></div>
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
    await loadCommercialProfiles();
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

  async function uploadServiceImage(file,serviceId){
    if(!file)return null;
    if(file.size>5*1024*1024)throw new Error('A imagem deve ter no máximo 5 MB.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    const safeExt=['jpg','jpeg','png','webp'].includes(ext)?ext:'jpg';
    const path=serviceId+'/voucher.'+safeExt;
    const {error}=await client.storage.from('service-images').upload(path,file,{upsert:true,contentType:file.type||undefined});
    if(error)throw error;
    return path;
  }
  byId('managerServiceForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const row=serviceFormRow();if(!row.name)return;
    let commercial;
    try{commercial=commercialFormRow()}
    catch(error){alert('Verifique as paradas do roteiro: '+error.message);return}
    if(commercial.departure_window_start&&commercial.departure_window_end&&
      commercial.departure_window_start>commercial.departure_window_end){
      alert('A janela de saída termina antes do horário inicial.');return;
    }
    const imageFile=byId('managerServiceImage')?.files?.[0]||null;
    const wasEditing=Boolean(editingServiceId);
    const result=editingServiceId
      ?await client.from('service_catalog').update(row).eq('id',editingServiceId).select('id').single()
      :await client.from('service_catalog').insert(row).select('id').single();
    if(result.error){
      alert('Não foi possível salvar o serviço. Verifique se já existe um cadastro igual.');
      console.error(result.error);
      return;
    }
    const savedId=result.data.id;
    try{
      await saveCommercialProfile(savedId,commercial);
    }catch(commercialError){
      console.error('[COMERCIAL] Falha ao salvar perfil:',commercialError);
      alert('O serviço foi salvo, mas os dados do Cérebro Comercial NÃO foram publicados. Verifique a permissão e tente novamente.');
      editingServiceId=savedId;
      return;
    }
    if(imageFile){
      try{
        const path=await uploadServiceImage(imageFile,savedId);
        const imageUpdate=await client.from('service_catalog').update({voucher_image_path:path,updated_at:new Date().toISOString()}).eq('id',savedId);
        if(imageUpdate.error)throw imageUpdate.error;
      }catch(error){
        console.error(error);
        alert('O serviço foi salvo, mas não foi possível enviar a imagem do voucher: '+error.message);
      }
    }
    resetServiceForm();
    await loadAll(wasEditing?'updated':'created');
  });

  byId('managerServiceCancel')?.addEventListener('click',resetServiceForm);
  byId('managerNewService')?.addEventListener('click',()=>{resetServiceForm();byId('managerServiceName')?.focus()});
  byId('managerServiceNet')?.addEventListener('focus',e=>e.currentTarget.select());
  byId('managerServiceNet')?.addEventListener('blur',e=>{if(e.currentTarget.value.trim()!=='')e.currentTarget.value=formatMoney(parseMoney(e.currentTarget.value))});
  byId('managerServiceImage')?.addEventListener('change',e=>{const file=e.currentTarget.files?.[0],host=byId('managerServiceImagePreview');if(!file||!host)return;if(file.size>5*1024*1024){alert('A imagem deve ter no máximo 5 MB.');e.currentTarget.value='';return}const url=URL.createObjectURL(file);host.innerHTML='<img src="'+url+'" alt="Prévia da imagem"><span>Prévia da nova imagem</span>';});

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
