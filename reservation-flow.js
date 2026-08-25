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
  function reservationServices(id){return readServices().filter(s=>String(s.reservationId)===String(id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))}
  function escape(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

  function migrate(){
    let changed=false;const all=readServices();
    reservations.forEach(r=>{
      if(!r.reservationCode){ensureReservationCode(r);changed=true}
      if(!all.some(s=>String(s.reservationId)===String(r.id))){
        all.push({id:`svc-${r.id}-1`,reservationId:r.id,sortOrder:0,title:r.service||'Serviço',date:r.date||'',returnDate:'',tour:r.service&&/passeio/i.test(r.service)?r.service:'',service:r.service||'',route:'',boarding:'',dropoff:'',apartment:'',responsible:r.responsible||'',repasseAmount:r.netAmount||0,repasseStatus:'Aguardando repasse'});
      }
    });
    writeServices(all);if(changed)saveReservations();
  }

  function injectServiceEditor(){
    const form=byId('reservationForm');if(!form||byId('reservationServicesEditor'))return;
    const partner=byId('partnerFields');
    const box=document.createElement('fieldset');box.id='reservationServicesEditor';box.className='reservation-services-editor';
    box.innerHTML=`<legend>Serviços da reserva</legend><div class="service-editor-head"><p>Adicione transfer, passeio, hospedagem ou outro serviço. Cada item poderá ser repassado separadamente.</p><button type="button" class="outline-button" id="addReservationService">+ Adicionar serviço</button></div><div id="reservationServiceDrafts"></div>`;
    partner?.insertAdjacentElement('beforebegin',box);
    const legacyService=form.querySelector('[name="service"]')?.closest('label');
    const legacyDate=form.querySelector('[name="date"]')?.closest('label');
    if(legacyService)legacyService.classList.add('legacy-service-field');if(legacyDate)legacyDate.classList.add('legacy-service-field');
    byId('addReservationService')?.addEventListener('click',()=>{serviceDrafts.push(blankService());renderDrafts()});
  }
  function blankService(){return{id:`draft-${Date.now()}-${Math.random()}`,title:'',date:'',returnDate:'',tour:'',service:'',route:'',boarding:'',dropoff:'',apartment:'',responsible:'',repasseAmount:null,repasseStatus:'Aguardando repasse'}}
  function renderDrafts(){
    const host=byId('reservationServiceDrafts');if(!host)return;
    if(!serviceDrafts.length)serviceDrafts=[blankService()];
    host.innerHTML=serviceDrafts.map((s,i)=>`<article class="reservation-service-draft" data-service-index="${i}"><div class="service-draft-top"><strong>Serviço ${i+1}</strong>${serviceDrafts.length>1?`<button type="button" class="text-button remove-service-draft" data-index="${i}">Remover</button>`:''}</div><div class="service-draft-grid">
      <label>Descrição<input data-field="title" value="${escape(s.title||'')}" placeholder="Ex.: Transfer aeroporto → Jeri"></label>
      <label>Data<input data-field="date" type="date" value="${escape(s.date||'')}"></label>
      <label>Data de volta<input data-field="returnDate" type="date" value="${escape(s.returnDate||'')}"></label>
      <label>Passeio<input data-field="tour" value="${escape(s.tour||'')}" placeholder="Ex.: Litoral Leste"></label>
      <label>Serviço / veículo<input data-field="service" value="${escape(s.service||'')}" placeholder="Ex.: Hilux compartilhada"></label>
      <label>Rota<input data-field="route" value="${escape(s.route||'')}" placeholder="Ex.: Fort-Jeri"></label>
      <label>Embarque<input data-field="boarding" value="${escape(s.boarding||'')}" placeholder="Hotel, aeroporto..."></label>
      <label>Desembarque<input data-field="dropoff" value="${escape(s.dropoff||'')}" placeholder="Hotel, aeroporto..."></label>
      <label>AP / Quarto<input data-field="apartment" value="${escape(s.apartment||'')}" placeholder="Ex.: 305"></label>
      <label>Responsável<input data-field="responsible" value="${escape(s.responsible||'')}" placeholder="Motorista / parceiro"></label>
      <label>Valor do repasse (R$)<input data-field="repasseAmount" inputmode="decimal" value="${s.repasseAmount??''}" placeholder="0,00"></label>
    </div></article>`).join('');
    host.querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',()=>{const card=input.closest('[data-service-index]');const i=Number(card.dataset.serviceIndex);serviceDrafts[i][input.dataset.field]=input.value}));
    host.querySelectorAll('.remove-service-draft').forEach(b=>b.addEventListener('click',()=>{serviceDrafts.splice(Number(b.dataset.index),1);renderDrafts()}));
  }
  function loadDrafts(id){const list=reservationServices(id);serviceDrafts=list.length?list.map(x=>({...x})): [blankService()];renderDrafts()}

  const baseOpenModal=window.openModal||openModal;
  window.openModal=function(id=null){baseOpenModal(id);setTimeout(()=>{loadDrafts(id)},0)};
  openModal=window.openModal;

  function persistDrafts(reservation){
    const old=readServices().filter(s=>String(s.reservationId)!==String(reservation.id));
    const clean=serviceDrafts.filter(s=>Object.values(s).some(v=>v&&String(v).trim&&String(v).trim())).map((s,i)=>({...s,id:String(s.id||'').startsWith('draft-')?`svc-${reservation.id}-${Date.now()}-${i}`:s.id,reservationId:reservation.id,sortOrder:i,repasseAmount:s.repasseAmount===''?null:Number(String(s.repasseAmount).replace(',','.'))||0,repasseStatus:s.repasseStatus||'Aguardando repasse'}));
    writeServices([...old,...clean]);
    const first=clean[0];if(first){reservation.service=first.title||first.service||first.tour||reservation.service;reservation.date=first.date||reservation.date;reservation.responsible=first.responsible||reservation.responsible;saveReservations()}
    syncReservationCloud(reservation,clean).catch(console.error);
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
    if(services.length){const payload=services.map((s,i)=>({reservation_id:q.data.id,sort_order:i,title:s.title||null,service_date:s.date||null,return_date:s.returnDate||null,tour:s.tour||null,service:s.service||null,route:s.route||null,boarding:s.boarding||null,dropoff:s.dropoff||null,apartment:s.apartment||null,responsible:s.responsible||null,repasse_amount:s.repasseAmount??null,repasse_status:s.repasseStatus||'Aguardando repasse'}));const ins=await client.from('reservation_services').insert(payload);if(ins.error)throw ins.error}
  }
  async function syncAll(){for(const r of reservations){ensureReservationCode(r);await syncReservationCloud(r,reservationServices(r.id))}saveReservations()}

  function enhanceReservationRows(){
    const tbody=byId('reservationsTable');if(!tbody)return;
    [...tbody.querySelectorAll('tr')].forEach(row=>{
      const edit=row.querySelector('[data-edit]');if(!edit)return;const id=Number(edit.dataset.edit);const r=reservations.find(x=>x.id===id);if(!r)return;
      const firstCell=row.cells[0];if(firstCell&&!firstCell.querySelector('.reservation-code-small'))firstCell.insertAdjacentHTML('afterbegin',`<small class="reservation-code-small">${escape(r.reservationCode||'')}</small>`);
      const actions=row.querySelector('.row-actions');if(actions&&!actions.querySelector('[data-services]')){const b=document.createElement('button');b.type='button';b.className='edit-button';b.dataset.services=id;b.textContent='Serviços / Repassar';actions.prepend(b)}
    });
  }
  const baseRenderReservations=window.renderReservations||renderReservations;
  window.renderReservations=function(){baseRenderReservations();enhanceReservationRows()};renderReservations=window.renderReservations;

  function openServiceManager(id){
    const r=reservations.find(x=>x.id===id);if(!r)return;
    let modal=byId('serviceRepasseModal');if(!modal){modal=document.createElement('div');modal.id='serviceRepasseModal';modal.className='modal-backdrop';document.body.appendChild(modal)}
    const list=reservationServices(id);
    modal.innerHTML=`<div class="modal service-repasse-modal"><button class="close-button" type="button" data-close-services>×</button><p class="eyebrow">${escape(r.reservationCode)}</p><h2>${escape(r.client)}</h2><p class="modal-subtitle">Escolha o serviço que deseja repassar. Os dados da reserva serão levados automaticamente.</p><div class="linked-services-list">${list.length?list.map(s=>`<article class="linked-service"><div><strong>${escape(s.title||s.service||s.tour||'Serviço')}</strong><small>${s.date?new Date(s.date+'T12:00:00').toLocaleDateString('pt-BR'): 'Sem data'}${s.route?` · ${escape(s.route)}`:''}${s.boarding?` · ${escape(s.boarding)}`:''}</small><span class="status ${s.repasseStatus==='Repassado'?'pago':'pendente'}">${escape(s.repasseStatus||'Aguardando repasse')}</span></div><button class="primary-button" type="button" data-repass-service="${escape(s.id)}">${s.repasseStatus==='Repassado'?'Repassar novamente':'Repassar'}</button></article>`).join(''):`<div class="empty-state"><strong>Sem serviços cadastrados.</strong><p>Edite a reserva para adicionar serviços.</p></div>`}</div><button class="outline-button full" type="button" data-edit-reservation="${id}">Editar serviços da reserva</button></div>`;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    modal.querySelector('[data-close-services]')?.addEventListener('click',()=>modal.classList.remove('open'));
    modal.querySelector('[data-edit-reservation]')?.addEventListener('click',()=>{modal.classList.remove('open');openModal(id)});
    modal.querySelectorAll('[data-repass-service]').forEach(b=>b.addEventListener('click',()=>startRepasse(r,list.find(s=>s.id===b.dataset.repassService))));
  }
  function startRepasse(r,s){
    const payload={reservationId:r.id,reservationCode:r.reservationCode,serviceId:s.id,client:r.client,phone:r.phone,people:r.people,date:s.date||r.date||'',returnDate:s.returnDate||'',tour:s.tour||'',service:s.service||s.title||'',route:s.route||'',boarding:s.boarding||'',dropoff:s.dropoff||'',apartment:s.apartment||'',amount:s.repasseAmount??'',responsible:s.responsible||r.responsible||''};
    sessionStorage.setItem('jeri-rota-repasse-from-reservation',JSON.stringify(payload));location.href='repasses.html?fromReservation=1';
  }
  byId('reservationsTable')?.addEventListener('click',e=>{const id=Number(e.target.dataset.services);if(id){e.preventDefault();e.stopPropagation();openServiceManager(id)}});

  async function init(){injectServiceEditor();migrate();renderAll();try{await syncAll()}catch(e){console.error('Falha ao sincronizar reservas:',e)}}
  init();
})();