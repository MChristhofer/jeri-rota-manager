(function(){
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const RESERVATION_CODE_KEY='jeri-rota-manager-reservation-code-v1';
  const $=s=>document.querySelector(s);
  const byId=id=>document.getElementById(id);
  const client=window.jeriSupabase;
  let serviceDrafts=[];
  let cloudReservationMap=new Map();

  function readServices(){try{return JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]')}catch{return[]}}
  function writeServices(v){localStorage.setItem(SERVICES_KEY,JSON.stringify(v))}
  function nextReservationNumber(){const current=Number(localStorage.getItem(RESERVATION_CODE_KEY)||0)+1;localStorage.setItem(RESERVATION_CODE_KEY,String(current));return current}
  function ensureReservationCode(r){if(r.reservationCode)return r.reservationCode;const n=nextReservationNumber();r.reservationCode=`JR-${String(n).padStart(5,'0')}`;return r.reservationCode}
  function reservationServices(id){
    const seen=new Set();
    return readServices().filter(s=>String(s.reservationId)===String(id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).filter(service=>{
      const key=[service.title,service.date,service.returnDate,service.tour,service.service,service.route,service.boarding,service.dropoff,service.apartment,service.responsible,Number(service.saleTotal)||0].map(value=>String(value??'').trim().toLowerCase()).join('|');
      if(seen.has(key))return false;seen.add(key);return true;
    });
  }
  function escape(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  const OP_META_PREFIX='JR_OP_V1:';
  function decodeOperationalMeta(value){if(!String(value||'').startsWith(OP_META_PREFIX))return{};try{return JSON.parse(decodeURIComponent(String(value).slice(OP_META_PREFIX.length)))}catch{return{}}}
  function encodeOperationalMeta(service){
    const meta={serviceType:service.serviceType,modality:service.modality,origin:service.origin,destination:service.destination,startTime:service.startTime,endTime:service.endTime,serviceNotes:service.serviceNotes,hotel:service.hotel,locator:service.locator,vehicle:service.vehicle,serviceName:service.serviceName,boardingPoints:service.boardingPoints,dropoffPoints:service.dropoffPoints,legacyResponsible:service.legacyResponsible};
    return OP_META_PREFIX+encodeURIComponent(JSON.stringify(meta));
  }
  function inferServiceType(service){const text=[service.serviceType,service.title,service.service,service.tour].filter(Boolean).join(' ').toLowerCase();if(/hosped|hotel|pousada/.test(text))return'hospedagem';if(/passeio|leste|oeste|lagoa|praia/.test(text))return'passeio';if(/transfer|aeroporto|jeri|fortaleza/.test(text))return'transfer';return service.serviceType||'transfer'}
  function normalizeServiceDraft(service={},fallbackSale=null){
    const meta=decodeOperationalMeta(service.responsible);const originalType=meta.serviceType||inferServiceType(service);const serviceType=originalType==='hospedagem'?'hospedagem':originalType==='transfer'?'transfer':'passeio';const route=String(service.route||'').split(/\s*(?:→|->)\s*/);
    const boardingPoints=Array.isArray(meta.boardingPoints)&&meta.boardingPoints.length?meta.boardingPoints:[{location:service.boarding||'',apartment:service.apartment||'',passengers:''}];
    const dropoffPoints=Array.isArray(meta.dropoffPoints)&&meta.dropoffPoints.length?meta.dropoffPoints:[{location:service.dropoff||'',apartment:'',passengers:''}];
    const legacyTour=['bate_volta','outro'].includes(originalType)?(service.serviceName||meta.serviceName||service.service||service.title||''):'';
    return{...service,serviceType,modality:service.modality||meta.modality||(/compartilh/i.test(service.service||'')?'Compartilhado':'Privativo'),origin:service.origin||meta.origin||route[0]||'',destination:service.destination||meta.destination||route[1]||service.dropoff||'',startTime:service.startTime||service.time||meta.startTime||'',endTime:service.endTime||meta.endTime||'',serviceNotes:service.serviceNotes||meta.serviceNotes||'',hotel:service.hotel||meta.hotel||(serviceType==='hospedagem'?(service.service||service.title||''):''),locator:service.locator||meta.locator||'',vehicle:service.vehicle||meta.vehicle||(!String(service.responsible||'').startsWith(OP_META_PREFIX)?service.responsible||'':''),serviceName:service.serviceName||meta.serviceName||'',tour:service.tour||legacyTour,boardingPoints,dropoffPoints,legacyResponsible:meta.legacyResponsible||(!String(service.responsible||'').startsWith(OP_META_PREFIX)?service.responsible||'':''),saleTotal:service.saleTotal??fallbackSale??0};
  }

  function migrate(){
    let changed=false;const all=readServices();
    reservations.forEach(r=>{
      if(!r.reservationCode){ensureReservationCode(r);changed=true}
      if(!all.some(s=>String(s.reservationId)===String(r.id))){
        all.push(normalizeServiceDraft({id:`svc-${r.id}-1`,reservationId:r.id,sortOrder:0,title:r.service||'Serviço',date:r.date||'',returnDate:'',tour:r.service&&/passeio/i.test(r.service)?r.service:'',service:r.service||'',route:'',boarding:r.boarding||'',dropoff:'',apartment:'',responsible:r.responsible||'',repasseAmount:r.netAmount||0,repasseStatus:'Aguardando repasse'},r.amount||0));
      }
    });
    writeServices(all);if(changed)saveReservations();
  }

  function injectServiceEditor(){
    const form=byId('reservationForm');if(!form||byId('reservationServicesEditor'))return;
    const partner=byId('partnerFields');
    const box=document.createElement('fieldset');box.id='reservationServicesEditor';box.className='reservation-services-editor';
    box.innerHTML=`<legend>2. Serviços da reserva</legend><div class="service-editor-head"><p>Adicione cada transfer ou passeio como um serviço independente.</p><button type="button" class="outline-button" id="addReservationService">+ Adicionar serviço</button></div><div id="reservationServiceDrafts"></div><div class="reservation-sale-total" aria-label="Resumo do pagamento"><div class="reservation-payment-item"><span>Total da reserva</span><strong id="reservationServicesSaleTotal">R$ 0,00</strong></div><label class="reservation-payment-item received"><span>Valor recebido</span><span class="reservation-money-input"><b>R$</b><input id="reservationReceivedAmount" type="number" min="0" step="0.01" value="0" inputmode="decimal" aria-describedby="reservationPaymentFeedback"></span></label><div class="reservation-payment-item balance"><span>Saldo a receber</span><strong id="reservationServicesBalance">R$ 0,00</strong></div><small id="reservationPaymentFeedback">O saldo é calculado automaticamente.</small></div>`;
    partner?.insertAdjacentElement('beforebegin',box);
    const legacyService=form.querySelector('[name="service"]')?.closest('label');
    const legacyDate=form.querySelector('[name="date"]')?.closest('label');
    if(legacyService)legacyService.classList.add('legacy-service-field');if(legacyDate)legacyDate.classList.add('legacy-service-field');
    byId('addReservationService')?.addEventListener('click',()=>{serviceDrafts.push(blankService());renderDrafts()});
    byId('reservationReceivedAmount')?.addEventListener('input',syncPaymentSummary);
    byId('reservationReceivedAmount')?.addEventListener('blur',()=>syncPaymentSummary(true));
  }
  function blankService(){return normalizeServiceDraft({id:`draft-${Date.now()}-${Math.random()}`,title:'',date:'',returnDate:'',tour:'',service:'',route:'',boarding:'',dropoff:'',apartment:'',responsible:'',repasseAmount:null,repasseStatus:'Aguardando repasse',saleTotal:0,serviceType:'transfer'})}
  const serviceTypeLabel=type=>({transfer:'Transfer',passeio:'Passeio',hospedagem:'Hospedagem existente'}[type]||'Serviço');
  function updateConditionalFields(card){
    const type=card.querySelector('[data-field="serviceType"]')?.value||'transfer';card.dataset.serviceType=type;
    card.querySelectorAll('[data-types]').forEach(field=>{const visible=field.dataset.types.split(' ').includes(type);field.hidden=!visible;field.querySelectorAll('input,select,textarea').forEach(input=>{input.disabled=!visible;if(input.dataset.typeRequired==='true')input.required=visible})});
    const dateInput=card.querySelector('[data-field="date"]');const dateLabel=dateInput?.closest('label');if(dateLabel){const text=[...dateLabel.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);if(text)text.textContent=type==='hospedagem'?'Check-in *':'Data *'}
    const title=card.querySelector('[data-service-title]');if(title)title.textContent=`${serviceTypeLabel(type)} ${Number(card.dataset.serviceIndex)+1}`;
  }
  function syncReservationTotal(){
    const total=serviceDrafts.reduce((sum,s)=>sum+(Number(String(s.saleTotal??0).replace(',','.'))||0),0);const amount=byId('reservationForm')?.elements.amount;if(amount){amount.value=total.toFixed(2);amount.dispatchEvent(new Event('input',{bubbles:true}))}const output=byId('reservationServicesSaleTotal');if(output)output.textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(total);
    const first=serviceDrafts[0]||{};const form=byId('reservationForm');if(form){form.elements.service.value=serviceDisplay(first)||'Serviço da reserva';form.elements.date.value=first.date||new Date().toISOString().slice(0,10);form.elements.boarding.value=first.boardingPoints?.[0]?.location||first.boarding||first.hotel||'Não se aplica'}
    syncPaymentSummary();
  }
  function syncPaymentSummary(formatInput=false){
    const form=byId('reservationForm');const input=byId('reservationReceivedAmount');if(!form||!input)return;const total=Math.max(0,Number(form.elements.amount.value)||0);const requested=Math.max(0,Number(input.value)||0);const received=Math.min(requested,total);const balance=Math.max(0,total-received);form.elements.paidAmount.value=received.toFixed(2);form.elements.paidAmount.dispatchEvent(new Event('input',{bubbles:true}));input.max=String(total);if(formatInput||requested>total||requested<0)input.value=received.toFixed(2);const output=byId('reservationServicesBalance');if(output)output.textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(balance);const feedback=byId('reservationPaymentFeedback');if(feedback)feedback.textContent=requested>total?'O valor recebido foi limitado ao total da reserva.':'O saldo é calculado automaticamente.';
  }
  function serviceDisplay(s){if(s.serviceType==='transfer')return['Transfer',s.origin&&s.destination?`${s.origin} → ${s.destination}`:'',s.modality].filter(Boolean).join(' · ');if(s.serviceType==='passeio')return s.tour||'Passeio';if(s.serviceType==='hospedagem')return s.hotel||'Hospedagem';return s.service||s.title||'Serviço'}
  function locationPointsMarkup(points,kind){const label=kind==='boarding'?'Embarque':'Desembarque';return`<section class="service-location-points" data-point-kind="${kind}"><div class="location-points-head"><strong>${label}</strong><button type="button" class="text-button add-location-point" data-kind="${kind}">+ Adicionar ponto</button></div><div class="location-points-list">${points.map((point,index)=>`<div class="service-location-row" data-point-index="${index}"><label>Local ${index===0?'*':''}<input data-point-field="location" ${index===0?'required':''} value="${escape(point.location||'')}" placeholder="Hotel, pousada, aeroporto ou endereço"></label><label>AP / quarto <span class="optional-label">opcional</span><input data-point-field="apartment" value="${escape(point.apartment||'')}" placeholder="Ex.: 205"></label><label>Passageiros deste local <span class="optional-label">opcional</span><input data-point-field="passengers" value="${escape(point.passengers||'')}" placeholder="Ex.: João + Maria"></label>${points.length>1?`<button type="button" class="remove-location-point" data-kind="${kind}" data-index="${index}" aria-label="Remover ponto de ${label.toLowerCase()}">×</button>`:''}</div>`).join('')}</div></section>`}
  function renderDrafts(){
    const host=byId('reservationServiceDrafts');if(!host)return;
    if(!serviceDrafts.length)serviceDrafts=[blankService()];
    host.innerHTML=serviceDrafts.map((s,i)=>`<article class="reservation-service-draft operational-service-card" data-service-index="${i}"><div class="service-draft-top"><div><span class="service-number">${i+1}</span><strong data-service-title>${serviceTypeLabel(s.serviceType)} ${i+1}</strong></div>${serviceDrafts.length>1?`<button type="button" class="text-button remove-service-draft" data-index="${i}">Remover</button>`:''}</div><div class="service-draft-grid operational-service-grid">
      <label>Tipo de serviço *<select data-field="serviceType" required>${s.serviceType==='hospedagem'?'<option value="hospedagem" selected>Hospedagem (existente)</option>':''}<option value="transfer" ${s.serviceType==='transfer'?'selected':''}>Transfer</option><option value="passeio" ${s.serviceType==='passeio'?'selected':''}>Passeio</option></select></label>
      <label>Data *<input data-field="date" type="date" required value="${escape(s.date||'')}"></label>
      <label>Valor de venda (R$) *<input data-field="saleTotal" type="number" min="0" step="0.01" required value="${escape(s.saleTotal??0)}"></label>
      <label data-types="transfer">Modalidade *<select data-field="modality" data-type-required="true"><option value="Privativo" ${s.modality==='Privativo'?'selected':''}>Privativo</option><option value="Compartilhado" ${s.modality==='Compartilhado'?'selected':''}>Compartilhado</option></select></label>
      <label data-types="transfer">Origem *<input data-field="origin" data-type-required="true" value="${escape(s.origin||'')}" placeholder="Ex.: Jericoacoara"></label>
      <label data-types="transfer">Destino *<input data-field="destination" data-type-required="true" value="${escape(s.destination||'')}" placeholder="Ex.: Fortaleza"></label>
      <label data-types="passeio">Passeio contratado *<input data-field="tour" data-type-required="true" value="${escape(s.tour||'')}" placeholder="Ex.: Litoral Leste"></label>
      <label data-types="hospedagem">Hotel / pousada existente<input data-field="hotel" value="${escape(s.hotel||'')}" readonly></label>
      <label data-types="transfer passeio">Horário de saída / início<input data-field="startTime" type="time" value="${escape(s.startTime||'')}"></label>
      <label data-types="transfer passeio">Horário de retorno / fim<input data-field="endTime" type="time" value="${escape(s.endTime||'')}"></label>
      <label data-types="transfer">Veículo <span class="optional-label">opcional</span><input data-field="vehicle" value="${escape(s.vehicle||'')}" placeholder="Ex.: Hilux, Spin, van"></label>
      <label data-types="hospedagem">Check-out *<input data-field="returnDate" data-type-required="true" type="date" value="${escape(s.returnDate||'')}"></label>
      <label data-types="hospedagem">Apartamento / quarto<input data-field="apartment" value="${escape(s.apartment||'')}" placeholder="Ex.: 305"></label>
      <label data-types="hospedagem">Localizador / nº da reserva<input data-field="locator" value="${escape(s.locator||'')}" placeholder="Se houver"></label>
      ${locationPointsMarkup(s.boardingPoints||[], 'boarding')}
      ${locationPointsMarkup(s.dropoffPoints||[], 'dropoff')}
      <label class="service-notes-field">Observação do serviço<textarea data-field="serviceNotes" placeholder="Orientações específicas deste serviço">${escape(s.serviceNotes||'')}</textarea></label>
    </div></article>`).join('');
    host.querySelectorAll('.operational-service-card').forEach(updateConditionalFields);
    host.querySelectorAll('[data-field]').forEach(input=>{const update=()=>{const card=input.closest('[data-service-index]');const i=Number(card.dataset.serviceIndex);serviceDrafts[i][input.dataset.field]=input.value;if(input.dataset.field==='serviceType')updateConditionalFields(card);syncReservationTotal()};input.addEventListener('input',update);input.addEventListener('change',update)});
    host.querySelectorAll('[data-point-field]').forEach(input=>{input.addEventListener('input',()=>{const card=input.closest('[data-service-index]');const kind=input.closest('[data-point-kind]').dataset.pointKind;const pointIndex=Number(input.closest('[data-point-index]').dataset.pointIndex);serviceDrafts[Number(card.dataset.serviceIndex)][`${kind}Points`][pointIndex][input.dataset.pointField]=input.value;syncReservationTotal()})});
    host.querySelectorAll('.add-location-point').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('[data-service-index]');serviceDrafts[Number(card.dataset.serviceIndex)][`${button.dataset.kind}Points`].push({location:'',apartment:'',passengers:''});renderDrafts()}));
    host.querySelectorAll('.remove-location-point').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('[data-service-index]');serviceDrafts[Number(card.dataset.serviceIndex)][`${button.dataset.kind}Points`].splice(Number(button.dataset.index),1);renderDrafts()}));
    host.querySelectorAll('.remove-service-draft').forEach(b=>b.addEventListener('click',()=>{serviceDrafts.splice(Number(b.dataset.index),1);renderDrafts()}));
    syncReservationTotal();
  }
  function loadDrafts(id){const reservation=id?reservations.find(r=>String(r.id)===String(id)):null;const list=reservationServices(id);const known=list.reduce((sum,s)=>sum+(Number(s.saleTotal)||0),0);serviceDrafts=list.length?list.map((x,index)=>{const saleTotal=index===0&&known===0?(Number(reservation?.amount)||0):(x.saleTotal??0);return normalizeServiceDraft({...x,saleTotal},saleTotal)}):[blankService()];const received=byId('reservationForm')?.elements.paidAmount?.value||0;if(byId('reservationReceivedAmount'))byId('reservationReceivedAmount').value=received;renderDrafts();syncPaymentSummary(true)}

  const baseOpenModal=window.openModal||openModal;
  window.openModal=function(id=null){baseOpenModal(id);setTimeout(()=>{loadDrafts(id)},0)};
  openModal=window.openModal;

  function persistDrafts(reservation){
    const old=readServices().filter(s=>String(s.reservationId)!==String(reservation.id));
    const clean=serviceDrafts.map((draft,i)=>{
      const s={...draft};const display=serviceDisplay(s);const route=s.serviceType==='transfer'?[s.origin,s.destination].filter(Boolean).join(' → '):s.route||'';
      const boarding=s.boardingPoints?.[0]||{};const dropoff=s.dropoffPoints?.[0]||{};
      return{...s,id:String(s.id||'').startsWith('draft-')?`svc-${reservation.id}-${Date.now()}-${i}`:s.id,reservationId:reservation.id,sortOrder:i,title:display,service:display,tour:s.serviceType==='passeio'?s.tour:(s.tour||''),route,boarding:boarding.location||s.boarding||'',dropoff:dropoff.location||s.dropoff||(s.serviceType==='transfer'?s.destination||'':''),apartment:boarding.apartment||s.apartment||'',returnDate:s.returnDate||'',saleTotal:Number(String(s.saleTotal??0).replace(',','.'))||0,startTime:s.startTime||'',endTime:s.endTime||'',time:s.startTime||'',responsible:encodeOperationalMeta(s),repasseAmount:s.repasseAmount,repasseStatus:s.repasseStatus||'Aguardando repasse'};
    });
    writeServices([...old,...clean]);
    const first=clean[0];if(first){reservation.service=first.title||first.service||first.tour||reservation.service;reservation.date=first.date||reservation.date;reservation.amount=clean.reduce((sum,s)=>sum+(Number(s.saleTotal)||0),0);saveReservations()}
  }

  byId('reservationForm')?.addEventListener('submit',()=>{
    setTimeout(()=>{
      const target=editingReservationId?reservations.find(r=>r.id===editingReservationId):reservations[reservations.length-1];
      if(target){ensureReservationCode(target);persistDrafts(target);renderAll()}
    },0);
  });

  async function syncReservationCloud(r,services){
    if(!client)return;
    const {data:{user}}=await client.auth.getUser();if(!user)return;
    const row={code:r.reservationCode,legacy_id:Number(r.id)||null,client:r.client||null,phone:r.phone||null,people:r.people||null,amount:r.amount||0,paid_amount:r.paidAmount||0,collected_by:r.collectedBy||null,status:r.status||'Pendente',notes:r.notes||null,partner_operation:r.partnerOperation||'propria',partner:r.partner||null,net_amount:r.netAmount||0,settled_amount:r.settledAmount||0,settlement_date:r.settlementDate||null,updated_at:new Date().toISOString()};
    let q=await client.from('reservations').upsert(row,{onConflict:'code'}).select('id,code').single();if(q.error)throw q.error;cloudReservationMap.set(r.reservationCode,q.data.id);
    await client.from('reservation_services').delete().eq('reservation_id',q.data.id);
    if(services.length){const payload=services.map((s,i)=>({reservation_id:q.data.id,sort_order:i,title:s.title||null,service_date:s.date||null,return_date:s.returnDate||null,tour:s.tour||null,service:s.service||null,route:s.route||null,boarding:s.boarding||null,dropoff:s.dropoff||null,apartment:s.apartment||null,responsible:s.responsible||null,sale_total:s.saleTotal??0,repasse_amount:s.repasseAmount??null,repasse_status:s.repasseStatus||'Aguardando repasse'}));const ins=await client.from('reservation_services').insert(payload);if(ins.error)throw ins.error}
  }
  async function syncAll(){for(const r of reservations){ensureReservationCode(r);await syncReservationCloud(r,reservationServices(r.id))}saveReservations()}

  function enhanceReservationRows(){
    const tbody=byId('reservationsTable');if(!tbody)return;
    [...tbody.querySelectorAll('tr')].forEach(row=>{
      const edit=row.querySelector('[data-edit]');if(!edit)return;const id=Number(edit.dataset.edit);const r=reservations.find(x=>x.id===id);if(!r)return;
      const firstCell=row.cells[0];if(firstCell&&!firstCell.querySelector('.reservation-code-small'))firstCell.insertAdjacentHTML('afterbegin',`<small class="reservation-code-small">${escape(r.reservationCode||'')}</small>`);
      const actions=row.querySelector('.row-actions');if(actions&&!actions.querySelector('[data-services]')){const b=document.createElement('button');b.type='button';b.className='edit-button';b.dataset.services=id;b.textContent='Repasse';actions.prepend(b)}
    });
  }
  const baseRenderReservations=window.renderReservations||renderReservations;
  window.renderReservations=function(){baseRenderReservations();enhanceReservationRows()};renderReservations=window.renderReservations;

  function openServiceManager(id){
    const r=reservations.find(x=>x.id===id);if(!r)return;
    const list=reservationServices(id);
    if(list.length<=1){startRepasse(r,list[0]||{});return}
    let modal=byId('serviceRepasseModal');if(!modal){modal=document.createElement('div');modal.id='serviceRepasseModal';modal.className='modal-backdrop';document.body.appendChild(modal)}
    modal.innerHTML=`<div class="modal service-repasse-modal"><button class="close-button" type="button" data-close-services>×</button><p class="eyebrow">${escape(r.reservationCode)}</p><h2>${escape(r.client)}</h2><p class="modal-subtitle">Escolha o serviço que será enviado pelo WhatsApp.</p><div class="linked-services-list">${list.map(s=>`<article class="linked-service"><div><strong>${escape(s.title||s.service||s.tour||'Serviço')}</strong><small>${s.date?new Date(s.date+'T12:00:00').toLocaleDateString('pt-BR'): 'Sem data'}${s.route?` · ${escape(s.route)}`:''}${s.boarding?` · ${escape(s.boarding)}`:''}</small></div><button class="primary-button" type="button" data-repass-service="${escape(s.id)}">Abrir WhatsApp</button></article>`).join('')}</div></div>`;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    modal.querySelector('[data-close-services]')?.addEventListener('click',()=>modal.classList.remove('open'));
    modal.querySelectorAll('[data-repass-service]').forEach(b=>b.addEventListener('click',()=>{modal.classList.remove('open');startRepasse(r,list.find(s=>s.id===b.dataset.repassService))}));
  }
  function startRepasse(r,s){
    const formatDate=value=>{if(!value)return'Não informada';const date=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('pt-BR')};
    const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
    const leg={outbound:'IDA',return:'VOLTA',single:'IDA'}[s.reservationLeg||s.leg]||'IDA';
    const service=s.service||s.title||s.tour||r.service||'Não informado';
    const operational=decodeOperationalMeta(s.responsible);const time=s.startTime||s.time||s.serviceTime||s.boardingTime||operational.startTime||r.time||r.serviceTime||'Não informado';
    const people=Math.max(1,Number(r.people)||String(r.client||'').split('/').filter(name=>name.trim()).length||1);
    const message=[
      'JERI ROTA — DADOS DA RESERVA',
      `Reserva: ${r.reservationCode||'Não informada'}`,
      `Serviço: ${service}`,
      `Data: ${formatDate(s.date||r.date)}`,
      `Horário: ${time}`,
      `Trecho: ${leg}`,
      `Embarque: ${s.boarding||r.boarding||'Não informado'}`,
      `Desembarque: ${s.dropoff||r.dropoff||'Não informado'}`,
      `Passageiro(s): ${r.client||'Não informado'}`,
      `Telefone: ${r.phone||'Não informado'}`,
      `Quantidade: ${people} ${people===1?'pessoa':'pessoas'}`,
      `Valor do repasse: ${money(s.repasseAmount??s.netTotal??r.netAmount)}`
    ].join('\n');
    openRepassePreview(message,r.reservationCode);
  }
  function openRepassePreview(message,reservationCode){
    let modal=byId('repasseMessagePreviewModal');
    if(!modal){modal=document.createElement('div');modal.id='repasseMessagePreviewModal';modal.className='modal-backdrop';document.body.appendChild(modal)}
    modal.innerHTML=`<div class="modal repasse-message-preview-modal"><button class="close-button" type="button" data-close-repasse-preview aria-label="Fechar">×</button><p class="eyebrow">${escape(reservationCode||'REPASSE')}</p><h2>Confirmar mensagem</h2><p class="modal-subtitle">Confira os dados antes de abrir o WhatsApp.</p><textarea readonly data-repasse-preview aria-label="Prévia da mensagem"></textarea><div class="repasse-preview-actions"><button class="outline-button" type="button" data-close-repasse-preview>Cancelar</button><button class="outline-button" type="button" data-copy-repasse-preview>Copiar mensagem</button><button class="primary-button" type="button" data-confirm-repasse>Confirmar e abrir WhatsApp</button></div><small class="reservation-repasse-feedback" data-repasse-preview-feedback aria-live="polite"></small></div>`;
    const preview=modal.querySelector('[data-repasse-preview]');preview.value=message;
    const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')};
    modal.querySelectorAll('[data-close-repasse-preview]').forEach(button=>button.addEventListener('click',close));
    modal.querySelector('[data-copy-repasse-preview]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(message)}catch{preview.select();document.execCommand('copy');preview.setSelectionRange(0,0)}const feedback=modal.querySelector('[data-repasse-preview-feedback]');if(feedback)feedback.textContent='Mensagem copiada.'});
    modal.querySelector('[data-confirm-repasse]')?.addEventListener('click',()=>{window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');close()});
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  }
  byId('reservationsTable')?.addEventListener('click',e=>{const id=Number(e.target.dataset.services);if(id){e.preventDefault();e.stopPropagation();openServiceManager(id)}});

  async function init(){injectServiceEditor();migrate();renderAll()}
  init();
})();
