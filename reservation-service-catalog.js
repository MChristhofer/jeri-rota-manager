(function(){
  const client=window.jeriSupabase;
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const form=document.getElementById('reservationForm');
  if(!form||!client)return;
  const byId=id=>document.getElementById(id);
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  let catalog=[];

  function readServices(){try{return JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]')}catch{return[]}}
  function writeServices(v){localStorage.setItem(SERVICES_KEY,JSON.stringify(v))}
  function display(item){return [item.name,item.modality].filter(Boolean).join(' · ')}
  function basisLabel(v){return v==='per_person'?'por pessoa':v==='per_vehicle'?'por veículo':'fixo'}
  function ruleLabel(v){return v==='commission_first'?'comissão primeiro':'NET primeiro'}
  function currentPeople(){return Math.max(1,Number(form.querySelector('[name="people"]')?.value)||1)}
  function savedForIndex(index){
    let id=null;try{id=editingReservationId}catch{}
    if(!id)return null;
    return readServices().filter(x=>String(x.reservationId)===String(id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))[index]||null;
  }
  function findCatalog(service,route){return catalog.find(x=>display(x)===service)||(catalog.find(x=>x.name===service&&(!route||x.route_code===route)))||null}
  function calculate(item,quantity,sale,received){
    const qty=item?.pricing_basis==='fixed'?1:Math.max(0,Number(quantity)||0);
    const netUnit=Number(item?.net_value)||0;
    const netTotal=item?.pricing_basis==='fixed'?netUnit:netUnit*qty;
    const sold=Math.max(0,Number(sale)||0);
    const got=Math.min(Math.max(0,Number(received)||0),sold||Infinity);
    const commission=Math.max(0,sold-netTotal);
    let commissionReceived=0,netCovered=0;
    if((item?.receipt_rule||'net_first')==='commission_first'){
      commissionReceived=Math.min(got,commission);
      netCovered=Math.min(netTotal,Math.max(0,got-commission));
    }else{
      netCovered=Math.min(got,netTotal);
      commissionReceived=Math.min(commission,Math.max(0,got-netTotal));
    }
    return{qty,netUnit,netTotal,sold,got,commission,commissionReceived,commissionPending:Math.max(0,commission-commissionReceived),netCovered,netPending:Math.max(0,netTotal-netCovered)};
  }

  function cardState(card){
    const select=card.querySelector('[data-service-catalog-select]');
    const item=catalog.find(x=>x.id===select?.value)||null;
    const quantity=card.querySelector('[data-net-quantity]')?.value||1;
    const sale=card.querySelector('[data-service-sale]')?.value||0;
    const received=card.querySelector('[data-service-received]')?.value||0;
    const calc=calculate(item,quantity,sale,received);
    return{item,calc,card};
  }
  function setExisting(card,field,value){
    const input=card.querySelector(`[data-field="${field}"]`);if(!input)return;
    input.value=value??'';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function updateCard(card,{syncDefaults=false}={}){
    const state=cardState(card),{item,calc}=state;
    const meta=card.querySelector('[data-catalog-meta]');
    if(meta)meta.innerHTML=item?`<span>${basisLabel(item.pricing_basis)}</span><span>NET ${money(item.net_value)}</span><span>${ruleLabel(item.receipt_rule)}</span>${item.route_code?`<span>${item.route_code}</span>`:''}`:'<span>Selecione um serviço cadastrado ou preencha manualmente.</span>';
    if(item&&syncDefaults){
      const q=card.querySelector('[data-net-quantity]');if(q)q.value=item.pricing_basis==='per_person'?currentPeople():1;
      const newCalc=calculate(item,q?.value||1,card.querySelector('[data-service-sale]')?.value||0,card.querySelector('[data-service-received]')?.value||0);
      if(item.default_sale_value!==null&&item.default_sale_value!==undefined&&card.querySelector('[data-service-sale]')?.value===''){
        const saleDefault=item.pricing_basis==='fixed'?Number(item.default_sale_value):Number(item.default_sale_value)*(newCalc.qty||1);
        card.querySelector('[data-service-sale]').value=saleDefault||'';
      }
      setExisting(card,'service',display(item));
      if(item.route_code)setExisting(card,'route',item.route_code);
      return updateCard(card);
    }
    const values={netTotal:calc.netTotal,commission:calc.commission,commissionReceived:calc.commissionReceived,netPending:calc.netPending,commissionPending:calc.commissionPending};
    Object.entries(values).forEach(([key,value])=>{const el=card.querySelector(`[data-kpi="${key}"]`);if(el)el.textContent=money(value)});
    const note=card.querySelector('[data-net-note]');
    if(note)note.textContent=item?`${display(item)}: NET ${money(calc.netTotal)} · ${calc.qty} ${item.pricing_basis==='per_person'?'pessoa(s)':item.pricing_basis==='per_vehicle'?'veículo(s)':'unidade'} · regra ${ruleLabel(item.receipt_rule)}.`:'Sem catálogo: o custo pode continuar sendo informado manualmente no campo de repasse.';
    if(item)setExisting(card,'repasseAmount',calc.netTotal.toFixed(2));
  }

  function updateReservationTotals(){
    const states=[...document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft')].map(cardState).filter(x=>x.item);
    if(!states.length)return;
    const sale=states.reduce((s,x)=>s+x.calc.sold,0),received=states.reduce((s,x)=>s+x.calc.got,0);
    const amount=form.querySelector('[name="amount"]'),paid=form.querySelector('[name="paidAmount"]');
    if(amount){amount.value=sale.toFixed(2);amount.dispatchEvent(new Event('input',{bubbles:true}))}
    if(paid){paid.value=Math.min(received,sale).toFixed(2);paid.dispatchEvent(new Event('input',{bubbles:true}))}
    let summary=byId('reservationCatalogNetSummary');
    if(!summary){summary=document.createElement('div');summary.id='reservationCatalogNetSummary';summary.className='reservation-net-summary';byId('reservationFinanceSummary')?.insertAdjacentElement('afterend',summary)}
    if(summary){const net=states.reduce((s,x)=>s+x.calc.netTotal,0),commission=states.reduce((s,x)=>s+x.calc.commission,0),commissionReceived=states.reduce((s,x)=>s+x.calc.commissionReceived,0),netPending=states.reduce((s,x)=>s+x.calc.netPending,0);summary.innerHTML=`<strong>NET dos serviços:</strong> ${money(net)} · <strong>Comissão prevista:</strong> ${money(commission)} · <strong>Comissão já recebida:</strong> ${money(commissionReceived)} · <strong>NET ainda pendente:</strong> ${money(netPending)}`}
  }
  function recalcAll(){document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft[data-net-ready="1"]').forEach(card=>updateCard(card));updateReservationTotals()}

  function decorateCard(card,index){
    if(card.dataset.netReady==='1')return;
    card.dataset.netReady='1';
    const grid=card.querySelector('.service-draft-grid');if(!grid)return;
    const saved=savedForIndex(index);
    const currentService=card.querySelector('[data-field="service"]')?.value||'';
    const currentRoute=card.querySelector('[data-field="route"]')?.value||'';
    const matched=(saved?.serviceCatalogId&&catalog.find(x=>x.id===saved.serviceCatalogId))||findCatalog(currentService,currentRoute);
    const block=document.createElement('label');block.className='reservation-catalog-field';
    block.innerHTML=`Serviço do catálogo<select data-service-catalog-select><option value="">Preenchimento manual</option>${catalog.filter(x=>x.active).map(x=>`<option value="${x.id}">${display(x)} — NET ${money(x.net_value)} ${basisLabel(x.pricing_basis)}</option>`).join('')}</select><div class="reservation-catalog-meta" data-catalog-meta></div>`;
    grid.prepend(block);
    const finance=document.createElement('div');finance.className='reservation-service-finance';
    finance.innerHTML=`<label>Quantidade NET<input data-net-quantity type="number" min="0" step="1" value="${saved?.quantity??(matched?.pricing_basis==='per_person'?currentPeople():1)}"></label><label>Valor vendido (R$)<input data-service-sale type="number" min="0" step="0.01" value="${saved?.saleTotal??''}" placeholder="0,00"></label><label>Recebido (R$)<input data-service-received type="number" min="0" step="0.01" value="${saved?.receivedAmount??''}" placeholder="0,00"></label><div class="reservation-service-kpi"><span>NET total</span><strong data-kpi="netTotal">R$ 0,00</strong></div><div class="reservation-service-kpi commission"><span>Comissão prevista</span><strong data-kpi="commission">R$ 0,00</strong></div><div class="reservation-service-kpi commission"><span>Comissão recebida</span><strong data-kpi="commissionReceived">R$ 0,00</strong></div><div class="reservation-service-kpi pending"><span>NET pendente</span><strong data-kpi="netPending">R$ 0,00</strong></div><div class="reservation-service-kpi pending"><span>Comissão pendente</span><strong data-kpi="commissionPending">R$ 0,00</strong></div><div class="reservation-net-note" data-net-note></div>`;
    grid.appendChild(finance);
    const select=block.querySelector('select');if(matched)select.value=matched.id;
    select.addEventListener('change',()=>{const item=catalog.find(x=>x.id===select.value);if(item){const q=card.querySelector('[data-net-quantity]');if(q)q.value=item.pricing_basis==='per_person'?currentPeople():1}updateCard(card,{syncDefaults:true});updateReservationTotals()});
    finance.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{updateCard(card);updateReservationTotals()}));
    updateCard(card,{syncDefaults:Boolean(matched&&!saved?.netTotal)});
  }
  function decorate(){document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach((card,index)=>decorateCard(card,index));recalcAll()}

  async function loadCatalog(){
    const {data,error}=await client.from('service_catalog').select('*').eq('active',true).order('name').order('modality');
    if(error){console.error('Falha ao carregar catálogo NET:',error);return}
    catalog=data||[];window.jeriServiceCatalog=catalog;decorate();
  }

  async function syncCloud(target,states){
    if(!target?.reservationCode)return;
    try{
      const {data:reservation}=await client.from('reservations').select('id').eq('code',target.reservationCode).maybeSingle();if(!reservation)return;
      const {data:rows}=await client.from('reservation_services').select('id,sort_order').eq('reservation_id',reservation.id).order('sort_order');
      for(let i=0;i<states.length;i++){
        const row=rows?.[i],state=states[i];if(!row||!state.item)continue;
        const c=state.calc,item=state.item;
        await client.from('reservation_services').update({service_catalog_id:item.id,pricing_basis:item.pricing_basis,receipt_rule:item.receipt_rule,net_unit:Number(item.net_value)||0,quantity:c.qty,net_total:c.netTotal,sale_total:c.sold,received_amount:c.got,commission_total:c.commission,commission_available:c.commissionReceived,commission_status:c.commission<=0?'Sem comissão':c.commissionReceived>=c.commission?'Liberada':c.commissionReceived>0?'Parcial':'Aguardando recebimento',updated_at:new Date().toISOString()}).eq('id',row.id);
      }
      await client.from('reservations').update({amount:Number(target.amount)||0,paid_amount:Number(target.paidAmount)||0,updated_at:new Date().toISOString()}).eq('id',reservation.id);
    }catch(e){console.error('Falha ao sincronizar NET da reserva:',e)}
  }

  form.addEventListener('submit',()=>{
    let previousId=null;try{previousId=editingReservationId}catch{}
    const states=[...document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft')].map(cardState);
    setTimeout(()=>{
      const target=previousId?reservations.find(x=>String(x.id)===String(previousId)):reservations[reservations.length-1];if(!target)return;
      const items=readServices();const own=items.filter(x=>String(x.reservationId)===String(target.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      own.forEach((svc,i)=>{const state=states[i];if(!state?.item)return;const c=state.calc,item=state.item;Object.assign(svc,{serviceCatalogId:item.id,pricingBasis:item.pricing_basis,receiptRule:item.receipt_rule,netUnit:Number(item.net_value)||0,quantity:c.qty,netTotal:c.netTotal,saleTotal:c.sold,receivedAmount:c.got,commissionTotal:c.commission,commissionAvailable:c.commissionReceived,commissionStatus:c.commission<=0?'Sem comissão':c.commissionReceived>=c.commission?'Liberada':c.commissionReceived>0?'Parcial':'Aguardando recebimento',repasseAmount:c.netTotal})});
      writeServices(items);
      const selected=states.filter(x=>x.item);if(selected.length){target.amount=selected.reduce((s,x)=>s+x.calc.sold,0);target.paidAmount=Math.min(target.amount,selected.reduce((s,x)=>s+x.calc.got,0));saveReservations();renderAll()}
      syncCloud(target,states);
    },180);
  });

  const people=form.querySelector('[name="people"]');people?.addEventListener('input',()=>{document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach(card=>{const state=cardState(card);if(state.item?.pricing_basis==='per_person'){const q=card.querySelector('[data-net-quantity]');if(q)q.value=currentPeople()}});recalcAll()});
  const wait=setInterval(()=>{const host=byId('reservationServiceDrafts');if(!host)return;clearInterval(wait);new MutationObserver(()=>decorate()).observe(host,{childList:true,subtree:false});loadCatalog()},80);
})();