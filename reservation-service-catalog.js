(function(){
  const client=window.jeriSupabase;
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const form=document.getElementById('reservationForm');
  if(!form||!client)return;
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  let catalog=[];

  const readServices=()=>{try{const v=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const writeServices=v=>localStorage.setItem(SERVICES_KEY,JSON.stringify(v));
  const display=item=>[item?.name,item?.modality].filter(Boolean).join(' · ');
  const basisLabel=v=>v==='per_person'?'por pessoa':v==='per_vehicle'?'por veículo':'fixo';
  const currentPeople=()=>Math.max(1,Number(form.querySelector('[name="people"]')?.value)||1);
  function currentReservationId(){try{return editingReservationId||null}catch{return null}}
  function savedForIndex(index){const id=currentReservationId();if(!id)return null;return readServices().filter(x=>String(x.reservationId)===String(id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))[index]||null}
  function findCatalog(service,route){return catalog.find(x=>display(x)===service)||catalog.find(x=>x.name===service&&(!route||x.route_code===route))||null}
  function calculateNet(item,quantity){if(!item)return 0;const qty=item.pricing_basis==='fixed'?1:Math.max(1,Number(quantity)||1);return (Number(item.net_value)||0)*qty}
  function setExisting(card,field,value){const input=card.querySelector(`[data-field="${field}"]`);if(!input)return;input.value=value??'';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}
  function state(card){const select=card.querySelector('[data-service-catalog-select]');const item=catalog.find(x=>String(x.id)===String(select?.value))||null;const quantity=card.querySelector('[data-net-quantity]')?.value||1;return{item,quantity,net:calculateNet(item,quantity)}}

  function updateCard(card,{syncDefaults=false}={}){
    const {item,net}=state(card);const meta=card.querySelector('[data-catalog-meta]');
    if(meta)meta.innerHTML=item?`<span>${basisLabel(item.pricing_basis)}</span><span>NET unitário ${money(item.net_value)}</span>${item.route_code?`<span>${item.route_code}</span>`:''}`:'<span>Selecione um serviço cadastrado.</span>';
    if(item&&syncDefaults){const q=card.querySelector('[data-net-quantity]');if(q)q.value=item.pricing_basis==='per_person'?currentPeople():1;setExisting(card,'service',display(item));if(item.route_code)setExisting(card,'route',item.route_code);return updateCard(card)}
    const kpi=card.querySelector('[data-kpi="netTotal"]');if(kpi)kpi.textContent=money(net);
    const note=card.querySelector('[data-net-note]');if(note)note.textContent=item?`${display(item)} · NET calculado ${money(net)}.`:'O NET manual continua disponível quando nenhum serviço do catálogo é selecionado.';
    if(item)setExisting(card,'repasseAmount',net.toFixed(2));
  }

  function decorateCard(card,index){
    if(card.dataset.netReady==='1')return;card.dataset.netReady='1';const grid=card.querySelector('.service-draft-grid');if(!grid)return;
    const saved=savedForIndex(index);const currentService=card.querySelector('[data-field="service"]')?.value||'';const currentRoute=card.querySelector('[data-field="route"]')?.value||'';const matched=(saved?.serviceCatalogId&&catalog.find(x=>x.id===saved.serviceCatalogId))||findCatalog(currentService,currentRoute);
    const field=document.createElement('label');field.className='reservation-catalog-field';field.innerHTML=`Serviço do catálogo<select data-service-catalog-select><option value="">Preenchimento manual</option>${catalog.filter(x=>x.active!==false).map(x=>`<option value="${x.id}">${display(x)} — NET ${money(x.net_value)} ${basisLabel(x.pricing_basis)}</option>`).join('')}</select><div class="reservation-catalog-meta" data-catalog-meta></div>`;grid.prepend(field);
    const finance=document.createElement('div');finance.className='reservation-service-finance simplified';finance.innerHTML=`<label>Quantidade para NET<input data-net-quantity type="number" min="1" step="1" value="${saved?.quantity??(matched?.pricing_basis==='per_person'?currentPeople():1)}"></label><div class="reservation-service-kpi"><span>NET do serviço</span><strong data-kpi="netTotal">R$ 0,00</strong></div><div class="reservation-net-note" data-net-note></div>`;grid.appendChild(finance);
    const select=field.querySelector('select');if(matched)select.value=matched.id;
    select.addEventListener('change',()=>{updateCard(card,{syncDefaults:true});window.dispatchEvent(new Event('reservation-finance-refresh'))});
    finance.querySelector('input')?.addEventListener('input',()=>{updateCard(card);window.dispatchEvent(new Event('reservation-finance-refresh'))});
    updateCard(card,{syncDefaults:Boolean(matched&&!saved?.netTotal)});
  }
  function decorate(){document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach((card,index)=>decorateCard(card,index));window.dispatchEvent(new Event('reservation-finance-refresh'))}

  async function loadCatalog(){const {data,error}=await client.from('service_catalog').select('*').eq('active',true).order('name').order('modality');if(error){console.error('Falha ao carregar catálogo NET:',error);return}catalog=data||[];window.jeriServiceCatalog=catalog;window.dispatchEvent(new Event('jeri-service-catalog-ready'));decorate()}

  async function syncCloud(target,states){
    if(!target?.reservationCode)return;
    try{const {data:reservation}=await client.from('reservations').select('id').eq('code',target.reservationCode).maybeSingle();if(!reservation)return;const {data:rows}=await client.from('reservation_services').select('id,sort_order').eq('reservation_id',reservation.id).order('sort_order');for(let i=0;i<states.length;i++){const row=rows?.[i],st=states[i];if(!row||!st.item)continue;await client.from('reservation_services').update({service_catalog_id:st.item.id,pricing_basis:st.item.pricing_basis,receipt_rule:st.item.receipt_rule||'net_first',net_unit:Number(st.item.net_value)||0,quantity:st.quantity,net_total:st.net,repasse_amount:st.net,updated_at:new Date().toISOString()}).eq('id',row.id)}}catch(e){console.error('Falha ao sincronizar NET da reserva:',e)}
  }

  form.addEventListener('submit',()=>{
    const previousId=currentReservationId();const states=[...document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft')].map(card=>state(card));
    setTimeout(()=>{const target=previousId?reservations.find(x=>String(x.id)===String(previousId)):reservations[reservations.length-1];if(!target)return;const items=readServices();const own=items.filter(x=>String(x.reservationId)===String(target.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));own.forEach((svc,i)=>{const st=states[i];if(!st?.item)return;Object.assign(svc,{serviceCatalogId:st.item.id,pricingBasis:st.item.pricing_basis,receiptRule:st.item.receipt_rule||'net_first',netUnit:Number(st.item.net_value)||0,quantity:Number(st.quantity)||1,netTotal:st.net,repasseAmount:st.net})});writeServices(items);syncCloud(target,states)},180)
  });

  form.querySelector('[name="people"]')?.addEventListener('input',()=>{document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach(card=>{const st=state(card);if(st.item?.pricing_basis==='per_person'){const q=card.querySelector('[data-net-quantity]');if(q)q.value=currentPeople()}updateCard(card)});window.dispatchEvent(new Event('reservation-finance-refresh'))});
  const wait=setInterval(()=>{const host=document.getElementById('reservationServiceDrafts');if(!host)return;clearInterval(wait);new MutationObserver(()=>setTimeout(decorate,0)).observe(host,{childList:true,subtree:false});loadCatalog()},80);
})();