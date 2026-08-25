(function(){
  const byId=id=>document.getElementById(id);
  const form=byId('reservationForm');
  if(!form)return;

  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const TOUR_KEY='jeri-rota-manager-passeios-v1';
  const SERVICE_KEY='jeri-rota-manager-servicos-v1';
  const ROUTE_KEY='jeri-rota-manager-rotas-v1';
  const LOCATION_KEY='jeri-rota-manager-locais-v1';
  const primaryPhone=form.querySelector('[name="phone"]');
  const passengerInput=form.querySelector('[name="client"]');
  const peopleInput=form.querySelector('[name="people"]');
  const amountInput=form.querySelector('[name="amount"]');
  const paidInput=form.querySelector('[name="paidAmount"]');
  const cloud=window.jeriSupabase;
  let primaryIti=null;
  const extraPhones=[];

  function read(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}}
  function money(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0)}
  function countPassengers(value){return String(value||'').split('/').map(x=>x.trim()).filter(Boolean).length||1}
  function syncPeople(){if(!passengerInput||!peopleInput)return;peopleInput.value=countPassengers(passengerInput.value);peopleInput.readOnly=true}

  function relabel(){
    const passengerLabel=passengerInput?.closest('label');
    if(passengerLabel){
      const text=[...passengerLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
      if(text)text.textContent='Passageiro(s)';
      passengerInput.placeholder='Ex.: João Silva / Maria Silva';
      if(!passengerLabel.querySelector('.people-auto-badge'))passengerLabel.insertAdjacentHTML('beforeend','<small class="people-auto-badge">Quantidade calculada automaticamente pelo “/”.</small>');
    }
    const peopleLabel=peopleInput?.closest('label');
    if(peopleLabel){
      const text=[...peopleLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
      if(text)text.textContent='Quantidade de pessoas';
      if(!peopleLabel.querySelector('.reservation-form-help'))peopleLabel.insertAdjacentHTML('beforeend','<small class="reservation-form-help">Ex.: João / Maria = 2 pessoas.</small>');
    }
    const phoneLabel=primaryPhone?.closest('label');
    if(phoneLabel){
      const text=[...phoneLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
      if(text)text.textContent='Telefone principal';
      primaryPhone.placeholder='(85) 99999-9999';
      if(!phoneLabel.querySelector('.reservation-form-help'))phoneLabel.insertAdjacentHTML('beforeend','<small class="reservation-form-help">Brasil por padrão. Para estrangeiro, selecione o país pela bandeira.</small>');
    }
  }

  function ensureIntlAssets(){
    if(!document.querySelector('link[data-reservation-phone-css]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href='https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.0/dist/css/intlTelInput.css';link.dataset.reservationPhoneCss='1';document.head.appendChild(link);
    }
    if(window.intlTelInput)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src.includes('intl-tel-input@29.2.0'));
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.0/dist/js/intlTelInput.min.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
    });
  }
  function itiOptions(){return{initialCountry:'br',countryOrder:['br','us','ar','pt','gb','fr','es','it','de'],countryNameLocale:'pt-BR',numberDisplayFormat:'NATIONAL',formatAsYouType:true,strictMode:true,loadUtils:()=>import('https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.0/dist/js/utils.js')}}
  function phoneInfo(input,iti){
    const raw=input?.value.trim()||'';if(!raw)return null;
    const country=iti?.getSelectedCountryData?.()||{iso2:'br'};let phone=raw,phoneE164='';
    try{phoneE164=iti?.getNumber?.('E164')||'';const formatted=iti?.getNumber?.(country.iso2==='br'?'NATIONAL':'INTERNATIONAL');if(formatted)phone=formatted}catch{}
    return{phone,phoneE164,phoneCountry:country.iso2||'br'};
  }
  function setPhone(input,iti,data={}){
    if(!input)return;
    try{
      if(iti){
        if(data.phoneE164)iti.setNumber(data.phoneE164);
        else{iti.setCountry(data.phoneCountry||'br');iti.setNumber(data.phone||'')}
      }else input.value=data.phone||'';
    }catch{input.value=data.phone||''}
  }
  function collectPhones(){return[phoneInfo(primaryPhone,primaryIti),...extraPhones.map(x=>phoneInfo(x.input,x.iti))].filter(Boolean)}
  function clearExtraPhones(){while(extraPhones.length){const x=extraPhones.pop();try{x.iti?.destroy?.()}catch{}x.row.remove()}}
  function addExtraPhone(data={}){
    const list=byId('reservationExtraPhoneList');if(!list)return;
    const row=document.createElement('div');row.className='reservation-extra-phone';
    row.innerHTML='<label>Telefone adicional<input type="tel" inputmode="tel" autocomplete="tel" placeholder="(85) 99999-9999"><small class="reservation-form-help">Selecione o país quando necessário.</small></label><button class="reservation-remove-phone" type="button">Remover</button>';
    list.appendChild(row);const input=row.querySelector('input');const iti=window.intlTelInput?window.intlTelInput(input,itiOptions()):null;const entry={row,input,iti};extraPhones.push(entry);setPhone(input,iti,data);
    row.querySelector('button').addEventListener('click',()=>{const i=extraPhones.indexOf(entry);if(i>=0)extraPhones.splice(i,1);try{iti?.destroy?.()}catch{}row.remove()});
  }
  async function setupPhoneEditor(){
    if(!primaryPhone||byId('reservationPhoneTools'))return;
    try{await ensureIntlAssets()}catch(e){console.warn('Intl phone indisponível:',e)}
    primaryIti=window.intlTelInput?window.intlTelInput(primaryPhone,itiOptions()):null;
    const tools=document.createElement('div');tools.id='reservationPhoneTools';tools.className='reservation-phone-tools';tools.innerHTML='<div class="reservation-phone-head"><span>Adicione quantos contatos precisar. Cada telefone mantém país e formatação próprios.</span><button type="button" class="outline-button" id="addReservationPhone">+ Adicionar telefone</button></div><div class="reservation-phone-list" id="reservationExtraPhoneList"></div>';
    primaryPhone.closest('label')?.insertAdjacentElement('afterend',tools);
    byId('addReservationPhone')?.addEventListener('click',()=>addExtraPhone());
  }

  function loadPhoneState(reservation){
    clearExtraPhones();
    const phones=Array.isArray(reservation?.phones)&&reservation.phones.length?reservation.phones:[reservation?.phone?{phone:reservation.phone,phoneCountry:'br'}:null].filter(Boolean);
    setPhone(primaryPhone,primaryIti,phones[0]||{});phones.slice(1).forEach(addExtraPhone);
  }

  function ensureCatalogDatalists(){
    const defs=[
      ['reservationTourOptions',read(TOUR_KEY).map(String)],
      ['reservationServiceOptions',read(SERVICE_KEY).map(String)],
      ['reservationRouteOptions',read(ROUTE_KEY).map(x=>x?.code||x).filter(Boolean)],
      ['reservationLocationOptions',read(LOCATION_KEY).map(x=>x?.name||x).filter(Boolean)]
    ];
    defs.forEach(([id,items])=>{let dl=byId(id);if(!dl){dl=document.createElement('datalist');dl.id=id;document.body.appendChild(dl)}dl.innerHTML=[...new Set(items)].map(x=>`<option value="${String(x).replace(/"/g,'&quot;')}"></option>`).join('')});
  }
  function enhanceServiceFields(){
    ensureCatalogDatalists();
    document.querySelectorAll('#reservationServiceDrafts [data-field="tour"]').forEach(x=>x.setAttribute('list','reservationTourOptions'));
    document.querySelectorAll('#reservationServiceDrafts [data-field="service"]').forEach(x=>x.setAttribute('list','reservationServiceOptions'));
    document.querySelectorAll('#reservationServiceDrafts [data-field="route"]').forEach(x=>x.setAttribute('list','reservationRouteOptions'));
    document.querySelectorAll('#reservationServiceDrafts [data-field="boarding"],#reservationServiceDrafts [data-field="dropoff"]').forEach(x=>x.setAttribute('list','reservationLocationOptions'));
    updateFinanceSummary();
  }

  function injectFinanceSummary(){
    if(byId('reservationFinanceSummary'))return;
    const services=byId('reservationServicesEditor');if(!services)return;
    const box=document.createElement('fieldset');box.id='reservationFinanceSummary';box.className='reservation-finance-summary';box.innerHTML='<legend>Resumo financeiro da reserva</legend><div class="reservation-finance-grid"><div class="reservation-finance-item"><span>Valor vendido</span><strong id="resFinSale">R$ 0,00</strong></div><div class="reservation-finance-item"><span>Recebido</span><strong id="resFinPaid">R$ 0,00</strong></div><div class="reservation-finance-item"><span>Saldo do cliente</span><strong id="resFinBalance">R$ 0,00</strong></div><div class="reservation-finance-item"><span>Custos / repasses</span><strong id="resFinCosts">R$ 0,00</strong></div><div class="reservation-finance-item" id="resFinMarginCard"><span>Margem bruta estimada</span><strong id="resFinMargin">R$ 0,00</strong></div></div><small class="reservation-form-help">Margem bruta estimada = valor vendido − soma dos valores de repasse/custo dos serviços. Não inclui despesas gerais da empresa.</small>';
    services.insertAdjacentElement('afterend',box);
  }
  function serviceCosts(){return[...document.querySelectorAll('#reservationServiceDrafts [data-field="repasseAmount"]')].reduce((sum,input)=>sum+(Number(String(input.value||'').replace(',','.'))||0),0)}
  function updateFinanceSummary(){
    if(!byId('reservationFinanceSummary'))injectFinanceSummary();
    const sale=Number(amountInput?.value)||0,paid=Math.min(Number(paidInput?.value)||0,sale||Infinity),balance=Math.max(0,sale-paid),costs=serviceCosts(),margin=sale-costs;
    if(byId('resFinSale'))byId('resFinSale').textContent=money(sale);if(byId('resFinPaid'))byId('resFinPaid').textContent=money(paid);if(byId('resFinBalance'))byId('resFinBalance').textContent=money(balance);if(byId('resFinCosts'))byId('resFinCosts').textContent=money(costs);if(byId('resFinMargin'))byId('resFinMargin').textContent=money(margin);
    const card=byId('resFinMarginCard');if(card){card.classList.toggle('margin-positive',margin>=0);card.classList.toggle('margin-negative',margin<0)}
  }

  async function syncPhonesCloud(reservation){
    if(!cloud||!reservation?.reservationCode)return;
    try{
      const {data:{user}}=await cloud.auth.getUser();if(!user)return;
      const {data:r}=await cloud.from('reservations').select('id').eq('code',reservation.reservationCode).maybeSingle();if(!r)return;
      await cloud.from('reservation_phones').delete().eq('reservation_id',r.id);
      const phones=reservation.phones||[];if(phones.length){await cloud.from('reservation_phones').insert(phones.map((p,i)=>({reservation_id:r.id,phone:p.phone||null,phone_e164:p.phoneE164||null,phone_country:p.phoneCountry||null,sort_order:i})))}
    }catch(e){console.error('Falha ao sincronizar telefones da reserva:',e)}
  }

  relabel();syncPeople();passengerInput?.addEventListener('input',syncPeople);
  setupPhoneEditor().then(()=>loadPhoneState(null));

  const serviceHostObserver=new MutationObserver(()=>enhanceServiceFields());
  const waitForServiceHost=setInterval(()=>{const host=byId('reservationServiceDrafts');if(host){clearInterval(waitForServiceHost);serviceHostObserver.observe(host,{childList:true,subtree:true});enhanceServiceFields();injectFinanceSummary()}},80);
  form.addEventListener('input',e=>{if(e.target===amountInput||e.target===paidInput||e.target.matches?.('[data-field="repasseAmount"]'))updateFinanceSummary()});

  const baseOpen=window.openModal;
  if(typeof baseOpen==='function'){
    window.openModal=function(id=null){baseOpen(id);setTimeout(()=>{const r=id?reservations.find(x=>String(x.id)===String(id)):null;loadPhoneState(r);syncPeople();enhanceServiceFields();injectFinanceSummary();updateFinanceSummary()},120)};
    try{openModal=window.openModal}catch{}
  }

  form.addEventListener('submit',()=>{
    const capturedPhones=collectPhones();
    setTimeout(()=>{
      const target=editingReservationId?reservations.find(r=>String(r.id)===String(editingReservationId)):reservations[reservations.length-1];
      if(!target)return;target.phones=capturedPhones;target.phone=capturedPhones[0]?.phone||target.phone||'';target.people=countPassengers(target.client);saveReservations();renderAll();setTimeout(()=>syncPhonesCloud(target),500);
    },40);
  });

  document.addEventListener('click',e=>{
    const button=e.target.closest?.('[data-repass-service]');if(!button)return;
    const services=read(SERVICES_KEY);const svc=services.find(s=>String(s.id)===String(button.dataset.repassService));if(!svc)return;
    const r=reservations.find(x=>String(x.id)===String(svc.reservationId));if(!r)return;
    e.preventDefault();e.stopImmediatePropagation();
    const payload={reservationId:r.id,reservationCode:r.reservationCode,serviceId:svc.id,client:r.client,phone:r.phone,phones:Array.isArray(r.phones)?r.phones:[],people:r.people,date:svc.date||r.date||'',returnDate:svc.returnDate||'',tour:svc.tour||'',service:svc.service||svc.title||'',route:svc.route||'',boarding:svc.boarding||'',dropoff:svc.dropoff||'',apartment:svc.apartment||'',amount:svc.repasseAmount??'',responsible:svc.responsible||r.responsible||''};
    sessionStorage.setItem('jeri-rota-repasse-from-reservation',JSON.stringify(payload));location.href='repasses.html?fromReservation=1';
  },true);
})();