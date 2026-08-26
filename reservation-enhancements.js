(function(){
  const byId=id=>document.getElementById(id);
  const form=byId('reservationForm');
  if(!form)return;

  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const primaryPhone=form.querySelector('[name="phone"]');
  const passengerInput=form.querySelector('[name="client"]');
  const peopleInput=form.querySelector('[name="people"]');
  const amountInput=form.querySelector('[name="amount"]');
  const paidInput=form.querySelector('[name="paidAmount"]');
  let primaryIti=null;
  const extraPhones=[];

  const read=key=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  const countPassengers=value=>String(value||'').split('/').map(x=>x.trim()).filter(Boolean).length||1;
  const capitalizePassengerNames=value=>String(value||'').replace(/(^|[\s/,-])(\p{L})/gu,(match,boundary,letter)=>boundary+letter.toLocaleUpperCase('pt-BR'));
  function normalizePassengerNames(){if(!passengerInput)return;const normalized=capitalizePassengerNames(passengerInput.value);if(normalized!==passengerInput.value){const start=passengerInput.selectionStart,end=passengerInput.selectionEnd;passengerInput.value=normalized;try{passengerInput.setSelectionRange(start,end)}catch{}}}
  function syncPeople(){if(!passengerInput||!peopleInput)return;peopleInput.value=countPassengers(passengerInput.value);peopleInput.readOnly=true}
  function setLabelText(input,text){const label=input?.closest('label');if(!label)return;const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(node)node.textContent=text}

  function simplifyBaseForm(){
    setLabelText(passengerInput,'Passageiro(s)');
    if(passengerInput)passengerInput.placeholder='Ex.: João Silva / Maria Silva';
    setLabelText(primaryPhone,'Telefone principal');
    setLabelText(peopleInput,'Quantidade de pessoas');
    setLabelText(amountInput,'Valor total (R$)');
    setLabelText(paidInput,'Valor recebido (R$)');
    setLabelText(form.querySelector('[name="collectedBy"]'),'Quem recebeu o pagamento?');
    const balance=byId('balancePreview')?.closest('.balance-preview');
    if(balance){const span=balance.querySelector('span');if(span)span.textContent='Falta receber'}
    const paymentPreview=byId('paymentPreview');if(paymentPreview)paymentPreview.textContent='Atualizado automaticamente pelo total e pelo valor recebido.';

    const peopleLabel=peopleInput?.closest('label');
    if(peopleLabel&&!peopleLabel.querySelector('.reservation-form-help'))peopleLabel.insertAdjacentHTML('beforeend','<small class="reservation-form-help">Calculado automaticamente pelos nomes separados por “/”.</small>');
    const phoneLabel=primaryPhone?.closest('label');
    if(phoneLabel&&!phoneLabel.querySelector('.reservation-form-help'))phoneLabel.insertAdjacentHTML('beforeend','<small class="reservation-form-help">Brasil por padrão. Troque o país pela bandeira quando necessário.</small>');

    ['responsible','partnerOperation'].forEach(name=>form.querySelector(`[name="${name}"]`)?.closest('label')?.classList.add('reservation-simplified-hidden'));
    byId('partnerFields')?.classList.add('reservation-simplified-hidden');
  }

  function ensureIntlAssets(){
    if(!document.querySelector('link[data-reservation-phone-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.0/dist/css/intlTelInput.css';link.dataset.reservationPhoneCss='1';document.head.appendChild(link)}
    if(window.intlTelInput)return Promise.resolve();
    return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src.includes('intl-tel-input@29.2.0'));if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.0/dist/js/intlTelInput.min.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)})
  }
  function itiOptions(){return{initialCountry:'br',countryOrder:['br','us','ar','pt','gb','fr','es','it','de'],countryNameLocale:'pt-BR',numberDisplayFormat:'NATIONAL',formatAsYouType:true,strictMode:true,loadUtils:()=>import('https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.0/dist/js/utils.js')}}
  function phoneInfo(input,iti){const raw=input?.value.trim()||'';if(!raw)return null;const country=iti?.getSelectedCountryData?.()||{iso2:'br'};let phone=raw,phoneE164='';try{phoneE164=iti?.getNumber?.('E164')||'';const formatted=iti?.getNumber?.(country.iso2==='br'?'NATIONAL':'INTERNATIONAL');if(formatted)phone=formatted}catch{}return{phone,phoneE164,phoneCountry:country.iso2||'br'}}
  function setPhone(input,iti,data={}){if(!input)return;try{if(iti){if(data.phoneE164)iti.setNumber(data.phoneE164);else{iti.setCountry(data.phoneCountry||'br');iti.setNumber(data.phone||'')}}else input.value=data.phone||''}catch{input.value=data.phone||''}}
  function collectPhones(){return[phoneInfo(primaryPhone,primaryIti),...extraPhones.map(x=>phoneInfo(x.input,x.iti))].filter(Boolean)}
  function clearExtraPhones(){while(extraPhones.length){const x=extraPhones.pop();try{x.iti?.destroy?.()}catch{}x.row.remove()}}
  function addExtraPhone(data={}){const list=byId('reservationExtraPhoneList');if(!list)return;const row=document.createElement('div');row.className='reservation-extra-phone';row.innerHTML='<label>Telefone adicional<input type="tel" inputmode="tel" autocomplete="tel"><small class="reservation-form-help">Selecione o país quando necessário.</small></label><button class="reservation-remove-phone" type="button">Remover</button>';list.appendChild(row);const input=row.querySelector('input');const iti=window.intlTelInput?window.intlTelInput(input,itiOptions()):null;const entry={row,input,iti};extraPhones.push(entry);setPhone(input,iti,data);row.querySelector('button').addEventListener('click',()=>{const i=extraPhones.indexOf(entry);if(i>=0)extraPhones.splice(i,1);try{iti?.destroy?.()}catch{}row.remove()})}
  async function setupPhoneEditor(){if(!primaryPhone||byId('reservationPhoneTools'))return;try{await ensureIntlAssets()}catch(e){console.warn('Intl phone indisponível:',e)}primaryIti=window.intlTelInput?window.intlTelInput(primaryPhone,itiOptions()):null;const tools=document.createElement('div');tools.id='reservationPhoneTools';tools.className='reservation-phone-tools';tools.innerHTML='<div class="reservation-phone-head"><span>Adicione contatos extras somente quando necessário.</span><button type="button" class="outline-button" id="addReservationPhone">+ Adicionar telefone</button></div><div class="reservation-phone-list" id="reservationExtraPhoneList"></div>';primaryPhone.closest('label')?.insertAdjacentElement('afterend',tools);byId('addReservationPhone')?.addEventListener('click',()=>addExtraPhone())}
  function loadPhoneState(reservation){clearExtraPhones();const phones=Array.isArray(reservation?.phones)&&reservation.phones.length?reservation.phones:[reservation?.phone?{phone:reservation.phone,phoneCountry:'br'}:null].filter(Boolean);setPhone(primaryPhone,primaryIti,phones[0]||{});phones.slice(1).forEach(addExtraPhone)}

  function catalogItem(card){const id=card.querySelector('[data-service-catalog-select]')?.value;return (window.jeriServiceCatalog||[]).find(x=>String(x.id)===String(id))||null}
  function reverseItem(item){if(!item)return null;return (window.jeriServiceCatalog||[]).find(x=>x.active!==false&&x.id!==item.id&&x.modality===item.modality&&x.origin&&x.destination&&item.origin&&item.destination&&x.origin.trim().toLowerCase()===item.destination.trim().toLowerCase()&&x.destination.trim().toLowerCase()===item.origin.trim().toLowerCase())||null}
  function itemNet(item,card){if(!item)return 0;const qty=item.pricing_basis==='fixed'?1:Math.max(1,Number(card.querySelector('[data-net-quantity]')?.value)||1);return (Number(item.net_value)||0)*qty}
  function serviceCosts(){
    return [...document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft')].reduce((sum,card)=>{
      const manual=Number(String(card.querySelector('[data-field="repasseAmount"]')?.value||'').replace(',','.'))||0;
      const item=catalogItem(card);const outbound=item?itemNet(item,card):manual;
      const hasReturn=Boolean(card.querySelector('[data-roundtrip-toggle]')?.checked&&card.querySelector('[data-roundtrip-date]')?.value&&item);
      const returnNet=hasReturn?itemNet(reverseItem(item)||item,card):0;
      return sum+outbound+returnNet;
    },0)
  }

  function injectFinanceSummary(){
    let box=byId('reservationFinanceSummary');
    if(!box){const services=byId('reservationServicesEditor');if(!services)return;box=document.createElement('fieldset');box.id='reservationFinanceSummary';box.className='reservation-finance-summary';services.insertAdjacentElement('afterend',box)}
    box.innerHTML='<legend>Resumo da reserva</legend><div class="reservation-finance-grid"><div class="reservation-finance-item"><span>Total</span><strong id="resFinSale">R$ 0,00</strong></div><div class="reservation-finance-item"><span>Recebido</span><strong id="resFinPaid">R$ 0,00</strong></div><div class="reservation-finance-item"><span>Falta receber</span><strong id="resFinBalance">R$ 0,00</strong></div><div class="reservation-finance-item net"><span>NET dos serviços</span><strong id="resFinCosts">R$ 0,00</strong></div></div><small class="reservation-form-help">O detalhamento de saldos, margens, repasses e prestação de contas fica na aba Financeiro.</small>';
  }
  function updateFinanceSummary(){if(!byId('reservationFinanceSummary'))injectFinanceSummary();const sale=Math.max(0,Number(amountInput?.value)||0),paid=Math.min(Math.max(0,Number(paidInput?.value)||0),sale||Infinity),balance=Math.max(0,sale-paid),net=serviceCosts();if(byId('resFinSale'))byId('resFinSale').textContent=money(sale);if(byId('resFinPaid'))byId('resFinPaid').textContent=money(paid);if(byId('resFinBalance'))byId('resFinBalance').textContent=money(balance);if(byId('resFinCosts'))byId('resFinCosts').textContent=money(net)}

  simplifyBaseForm();normalizePassengerNames();syncPeople();passengerInput?.addEventListener('input',()=>{normalizePassengerNames();syncPeople()});passengerInput?.addEventListener('blur',normalizePassengerNames);setupPhoneEditor().then(()=>loadPhoneState(null));

  const waitForServices=setInterval(()=>{const host=byId('reservationServiceDrafts');if(!host)return;clearInterval(waitForServices);injectFinanceSummary();new MutationObserver(()=>setTimeout(updateFinanceSummary,0)).observe(host,{childList:true,subtree:true});updateFinanceSummary()},80);
  form.addEventListener('input',e=>{if(e.target===amountInput||e.target===paidInput||e.target.matches?.('[data-field="repasseAmount"],[data-net-quantity],[data-roundtrip-toggle],[data-roundtrip-date],[data-service-catalog-select]'))setTimeout(updateFinanceSummary,0)});
  form.addEventListener('change',()=>setTimeout(updateFinanceSummary,0));
  window.addEventListener('jeri-service-catalog-ready',()=>setTimeout(updateFinanceSummary,0));

  const baseOpen=window.openModal;
  if(typeof baseOpen==='function'){
    window.openModal=function(id=null){baseOpen(id);setTimeout(()=>{const r=id?reservations.find(x=>String(x.id)===String(id)):null;simplifyBaseForm();loadPhoneState(r);syncPeople();injectFinanceSummary();updateFinanceSummary()},140)};
    try{openModal=window.openModal}catch{}
  }

  form.addEventListener('submit',normalizePassengerNames,true);
  form.addEventListener('submit',()=>{const capturedPhones=collectPhones();setTimeout(()=>{const target=editingReservationId?reservations.find(r=>String(r.id)===String(editingReservationId)):reservations[reservations.length-1];if(!target)return;target.phones=capturedPhones;target.phone=capturedPhones[0]?.phone||target.phone||'';target.people=countPassengers(target.client);saveReservations();renderAll()},40)});
})();
