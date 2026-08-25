(function(){
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const REPASSES_KEY_LOCAL='jeri-rota-manager-repasses-v1';
  const client=window.jeriSupabase;
  const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const br=v=>{if(!v)return'';const [y,m,d]=String(v).split('-');return y&&m&&d?`${d}/${m}/${y}`:v};
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);

  if(!document.querySelector('link[href^="integrated-repasses.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='integrated-repasses.css?v=20260825-3';document.head.appendChild(l)}
  if(!document.getElementById('repasseManagerCleanupStyle')){
    const s=document.createElement('style');s.id='repasseManagerCleanupStyle';s.textContent=`
      .repasse-tab[data-tab="novo"],.repasse-tab[data-tab="passeios"],.repasse-tab[data-tab="locais"],.repasse-tab[data-tab="servicos"],.repasse-tab[data-tab="rotas"]{display:none!important}
      #tab-novo,#tab-passeios,#tab-locais,#tab-servicos,#tab-rotas,#centralNewAvulso{display:none!important}
      .repasse-tabs{width:max-content;max-width:100%}
      .repasse-decision-modal input{width:100%;min-height:42px;border:1px solid #ded4c5;border-radius:10px;padding:9px 11px;font:500 13px 'DM Sans',sans-serif}
      .repasse-decision-modal .modal-subtitle{margin-bottom:8px}
      .central-item.operation-own .central-status{background:#fff1c9;color:#75510a}
      .central-item.operation-own{border-left:4px solid #d6a94e}
      .central-item.operation-own.operation-done{border-left-color:#2e7d59}
      .central-item.operation-own.operation-done .central-status{background:#eaf7f0;color:#286746}
    `;document.head.appendChild(s)
  }

  function services(){return read(SERVICES_KEY)}
  function reservations(){return read(RESERVATIONS_KEY)}
  function reservationFor(service){return reservations().find(r=>String(r.id)===String(service.reservationId))||null}
  function serviceFor(id){return services().find(s=>String(s.id)===String(id))||null}
  function nextCode(){const nums=read(REPASSES_KEY_LOCAL).map(x=>Number(String(x.code||'').replace(/\D/g,''))||0);return `REP-${String((Math.max(0,...nums)+1)).padStart(5,'0')}`}
  function legData(service,leg){
    const isReturn=leg==='return';
    return{
      date:isReturn?service.returnDate:(service.date||''),
      service:isReturn?(service.returnService||service.service||service.title||'Serviço'):(service.service||service.title||service.tour||'Serviço'),
      route:isReturn?(service.returnRoute||''):(service.route||''),
      boarding:isReturn?(service.dropoff||''):(service.boarding||''),
      dropoff:isReturn?(service.boarding||''):(service.dropoff||''),
      apartment:service.apartment||'',
      amount:isReturn?(service.returnRepasseAmount??service.repasseAmount??null):(service.repasseAmount??null),
      catalogId:isReturn?(service.returnServiceCatalogId||service.serviceCatalogId):(service.serviceCatalogId||null)
    }
  }
  function passengerPhones(r){const list=Array.isArray(r?.phones)?r.phones.map(x=>x.phone||x.phoneE164).filter(Boolean):[];if(!list.length&&r?.phone)list.push(r.phone);return list}
  function makeMessage(code,r,data){
    const lines=[`Código: ${code}`];
    if(r?.reservationCode)lines.push(`Reserva: ${r.reservationCode}`);
    if(data.date)lines.push(`Data: ${br(data.date)}`);
    if(data.service)lines.push(`Serviço: ${data.service}`);
    if(data.route)lines.push(`Rota: ${String(data.route).split(' — ')[0].trim()}`);
    if(data.boarding)lines.push(`Embarque: ${data.boarding}`);
    if(data.dropoff)lines.push(`Desembarque: ${data.dropoff}`);
    if(data.apartment)lines.push(`AP / Quarto: ${data.apartment}`);
    if(r?.client)lines.push(`Passageiro(s): ${r.client}`);
    const phones=passengerPhones(r);if(phones.length>1)lines.push(`Telefones: ${phones.join(' / ')}`);else if(phones[0])lines.push(`Telefone: ${phones[0]}`);
    if(r?.people)lines.push(`Quantidade: ${r.people} pessoa${Number(r.people)===1?'':'s'}`);
    if(data.amount!==null&&data.amount!==undefined&&data.amount!=='')lines.push(`Valor a receber: ${money(data.amount)}`);
    return lines.join('\n');
  }
  function waPhone(raw){let digits=String(raw||'').replace(/\D/g,'');if((digits.length===10||digits.length===11)&&!digits.startsWith('55'))digits='55'+digits;return digits}

  async function catalogDefaults(id){
    if(!id||!client)return{};
    try{const {data}=await client.from('service_catalog').select('default_partner_name,default_partner_phone').eq('id',id).maybeSingle();return data||{}}catch{return{}}
  }
  async function cloudServiceRow(service,r){
    if(!client||!r?.reservationCode)return null;
    const {data:cloudReservation}=await client.from('reservations').select('id').eq('code',r.reservationCode).maybeSingle();if(!cloudReservation)return null;
    const {data:rows}=await client.from('reservation_services').select('id,sort_order').eq('reservation_id',cloudReservation.id).order('sort_order');
    const localOwn=services().filter(x=>String(x.reservationId)===String(r.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
    const idx=localOwn.findIndex(x=>String(x.id)===String(service.id));
    return{reservationId:cloudReservation.id,serviceId:rows?.[idx]?.id||null}
  }

  async function openRepasse(serviceId,leg){
    const service=serviceFor(serviceId);if(!service)return;const r=reservationFor(service);const data=legData(service,leg);const defaults=await catalogDefaults(data.catalogId);const code=nextCode();
    let modal=document.getElementById('repasseDecisionModal');if(!modal){modal=document.createElement('div');modal.id='repasseDecisionModal';modal.className='modal-backdrop';document.body.appendChild(modal)}
    const savedName=leg==='return'?service.returnExecutionPartnerName:service.executionPartnerName;
    const savedPhone=leg==='return'?service.returnExecutionPartnerPhone:service.executionPartnerPhone;
    const name=savedName||defaults.default_partner_name||service.responsible||'';
    const phone=savedPhone||defaults.default_partner_phone||'';
    const msg=makeMessage(code,r,data);
    modal.innerHTML=`<div class="modal repasse-decision-modal"><button class="close-button" type="button" data-close-decision>×</button><p class="eyebrow">${leg==='return'?'VOLTA':'REPASSE'}</p><h2>Repassar serviço</h2><p class="modal-subtitle">Confira o destinatário e a mensagem antes de abrir o WhatsApp.</p><div class="repasse-decision-grid"><label>Parceiro / motorista<input id="decisionRecipientName" value="${esc(name)}" placeholder="Nome do destinatário"></label><label>WhatsApp do destinatário<input id="decisionRecipientPhone" value="${esc(phone)}" inputmode="tel" placeholder="Ex.: (88) 99999-9999"></label></div><div class="repasse-preview-box" id="decisionMessagePreview">${esc(msg)}</div><div class="repasse-preview-actions"><button class="outline-button" type="button" data-copy-decision>Copiar mensagem</button><button class="outline-button" type="button" data-close-decision>Cancelar</button><button class="primary-button" type="button" data-send-decision>Abrir WhatsApp e marcar repassado</button></div></div>`;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    modal.querySelectorAll('[data-close-decision]').forEach(b=>b.addEventListener('click',()=>modal.classList.remove('open')));
    modal.querySelector('[data-copy-decision]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(msg);if(typeof toast==='function')toast('Mensagem copiada.')}catch{}});
    modal.querySelector('[data-send-decision]')?.addEventListener('click',async e=>{
      const button=e.currentTarget;const recipientName=document.getElementById('decisionRecipientName')?.value.trim()||'';const recipientPhone=document.getElementById('decisionRecipientPhone')?.value.trim()||'';const phoneDigits=waPhone(recipientPhone);
      if(!phoneDigits){alert('Informe o WhatsApp do parceiro ou motorista.');return}
      button.disabled=true;button.textContent='Salvando...';
      const wa=window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`,'_blank');
      try{await saveRepasse(service,r,data,leg,code,recipientName,recipientPhone,msg)}catch(err){console.error(err)}
      if(!wa)window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`,'_blank');
      modal.classList.remove('open');location.reload();
    });
  }

  async function saveRepasse(service,r,data,leg,code,recipientName,recipientPhone,msg){
    const reps=read(REPASSES_KEY_LOCAL);const phones=Array.isArray(r?.phones)?r.phones:[];
    reps.push({id:`rep-${Date.now()}`,number:Number(code.replace(/\D/g,'')),code,date:data.date||'',returnDate:'',tour:'',service:data.service||'',route:data.route||'',boarding:data.boarding||'',dropoff:data.dropoff||'',apartment:data.apartment||'',names:r?.client||'',phone:r?.phone||'',phones,people:r?.people??null,amount:data.amount??null,status:'Enviado',reservationId:r?.id||null,reservationCode:r?.reservationCode||'',reservationServiceId:service.id,reservationLeg:leg,recipientName,recipientPhone,messageSnapshot:msg,createdAt:new Date().toISOString()});
    if(typeof window.write==='function'){try{window.write(REPASSES_KEY_LOCAL,reps)}catch{write(REPASSES_KEY_LOCAL,reps)}}else write(REPASSES_KEY_LOCAL,reps);
    const all=services();const i=all.findIndex(x=>String(x.id)===String(service.id));if(i>=0){const now=new Date().toISOString();if(leg==='return'){all[i].returnExecutionMode='repassed';all[i].returnExecutionPartnerName=recipientName;all[i].returnExecutionPartnerPhone=recipientPhone;all[i].returnExecutionDecidedAt=now;all[i].returnRepasseStatus='Repassado'}else{all[i].executionMode='repassed';all[i].executionPartnerName=recipientName;all[i].executionPartnerPhone=recipientPhone;all[i].executionDecidedAt=now;all[i].repasseStatus='Repassado'}write(SERVICES_KEY,all)}
    await syncCloud(service,r,data,leg,code,recipientName,recipientPhone);
  }

  async function syncCloud(service,r,data,leg,code,recipientName,recipientPhone){
    const cloud=await cloudServiceRow(service,r);if(!cloud)return;
    if(cloud.serviceId){const update=leg==='return'?{return_execution_mode:'repassed',return_execution_partner_name:recipientName||null,return_execution_partner_phone:recipientPhone||null,return_execution_decided_at:new Date().toISOString(),return_repasse_status:'Repassado'}:{execution_mode:'repassed',execution_partner_name:recipientName||null,execution_partner_phone:recipientPhone||null,execution_decided_at:new Date().toISOString(),repasse_status:'Repassado'};await client.from('reservation_services').update({...update,updated_at:new Date().toISOString()}).eq('id',cloud.serviceId)}
    await client.from('repasses').upsert({code,number:Number(code.replace(/\D/g,'')),service_date:data.date||null,tour:null,service:data.service||null,route:data.route||null,boarding:data.boarding||null,dropoff:data.dropoff||null,apartment:data.apartment||null,names:r.client||null,people:r.people??null,amount:data.amount??null,status:'Enviado',reservation_id:cloud.reservationId,reservation_service_id:cloud.serviceId,reservation_code:r.reservationCode,reservation_leg:leg,recipient_name:recipientName||null,recipient_phone:recipientPhone||null,updated_at:new Date().toISOString()},{onConflict:'code'});
  }

  async function markOwn(serviceId,leg){
    const all=services();const i=all.findIndex(x=>String(x.id)===String(serviceId));if(i<0)return;const now=new Date().toISOString();
    if(leg==='return'){all[i].returnExecutionMode='own';all[i].returnExecutionDecidedAt=now;all[i].returnExecutionPartnerName='Jeri Rota';all[i].returnExecutionPartnerPhone=''}else{all[i].executionMode='own';all[i].executionDecidedAt=now;all[i].executionPartnerName='Jeri Rota';all[i].executionPartnerPhone=''}
    write(SERVICES_KEY,all);try{await syncOwnCloud(all[i],leg)}catch(e){console.error(e)}location.reload();
  }
  async function syncOwnCloud(service,leg){
    const r=reservationFor(service);const cloud=await cloudServiceRow(service,r);if(!cloud?.serviceId)return;
    const patch=leg==='return'?{return_execution_mode:'own',return_execution_partner_name:'Jeri Rota',return_execution_partner_phone:null,return_execution_decided_at:new Date().toISOString()}:{execution_mode:'own',execution_partner_name:'Jeri Rota',execution_partner_phone:null,execution_decided_at:new Date().toISOString()};
    await client.from('reservation_services').update({...patch,updated_at:new Date().toISOString()}).eq('id',cloud.serviceId);
  }
  async function markOwnDone(serviceId,leg){
    const all=services();const i=all.findIndex(x=>String(x.id)===String(serviceId));if(i<0)return;
    if(leg==='return')all[i].returnRepasseStatus='Realizado';else all[i].repasseStatus='Realizado';write(SERVICES_KEY,all);
    try{const r=reservationFor(all[i]);const cloud=await cloudServiceRow(all[i],r);if(cloud?.serviceId){const patch=leg==='return'?{return_repasse_status:'Realizado'}:{repasse_status:'Realizado'};await client.from('reservation_services').update({...patch,updated_at:new Date().toISOString()}).eq('id',cloud.serviceId)}}catch(e){console.error(e)}
    location.reload();
  }

  function decorate(){
    const note=document.querySelector('.central-section-note span');if(note)note.textContent='Todos os itens desta central são gerados a partir dos serviços das reservas.';
    document.querySelectorAll('.central-item').forEach(item=>{
      const isReturn=item.classList.contains('central-return-item');
      const prepare=item.querySelector(isReturn?'[data-return-prepare]':'[data-central-prepare]');
      const anyId=prepare?.dataset[isReturn?'returnPrepare':'centralPrepare']||item.querySelector(isReturn?'[data-return-reservation]':'[data-central-reservation]')?.dataset[isReturn?'returnReservation':'centralReservation'];if(!anyId)return;
      const svc=serviceFor(anyId);if(!svc)return;const mode=isReturn?svc.returnExecutionMode:svc.executionMode;const opStatus=isReturn?svc.returnRepasseStatus:svc.repasseStatus;
      if(prepare){prepare.textContent='Repassar';if(!item.querySelector('[data-manager-keep]')){const b=document.createElement('button');b.type='button';b.className='outline-button';b.dataset.managerKeep=anyId;b.dataset.managerLeg=isReturn?'return':'outbound';b.textContent='Manter';prepare.insertAdjacentElement('beforebegin',b)}}
      if(mode==='own'){
        item.classList.add('operation-own');const status=item.querySelector('.central-status');if(status)status.textContent=opStatus==='Realizado'?'Realizado · operação própria':'Operação própria';prepare?.remove();item.querySelector('[data-manager-keep]')?.remove();
        if(opStatus==='Realizado')item.classList.add('operation-done');
        const actions=item.querySelector('.central-actions');if(actions&&!actions.querySelector('[data-manager-own-done]')&&opStatus!=='Realizado'){const b=document.createElement('button');b.type='button';b.className='primary-button';b.dataset.managerOwnDone=anyId;b.dataset.managerLeg=isReturn?'return':'outbound';b.textContent='Marcar realizado';actions.appendChild(b)}
      }
    });
  }

  document.addEventListener('click',async e=>{
    const prepare=e.target.closest('[data-central-prepare],[data-return-prepare]');if(prepare){e.preventDefault();e.stopImmediatePropagation();const isReturn=prepare.hasAttribute('data-return-prepare');const id=isReturn?prepare.dataset.returnPrepare:prepare.dataset.centralPrepare;const svc=serviceFor(id);const leg=isReturn?'return':(svc?.roundTripSameMode&&svc?.returnDate?'outbound':'single');await openRepasse(id,leg);return}
    const keep=e.target.closest('[data-manager-keep]');if(keep){e.preventDefault();e.stopImmediatePropagation();await markOwn(keep.dataset.managerKeep,keep.dataset.managerLeg==='return'?'return':'outbound');return}
    const done=e.target.closest('[data-manager-own-done]');if(done){e.preventDefault();e.stopImmediatePropagation();await markOwnDone(done.dataset.managerOwnDone,done.dataset.managerLeg==='return'?'return':'outbound')}
  },true);

  function cleanup(){document.querySelector('.repasse-tab[data-tab="central"]')?.classList.add('active');decorate()}
  const wait=setInterval(()=>{const host=document.getElementById('centralRepasseList');if(!host)return;clearInterval(wait);new MutationObserver(()=>setTimeout(decorate,0)).observe(host,{childList:true,subtree:true});cleanup()},80);
  const tabs=document.querySelector('.repasse-tabs');if(tabs)new MutationObserver(cleanup).observe(tabs,{childList:true,subtree:true});
})();