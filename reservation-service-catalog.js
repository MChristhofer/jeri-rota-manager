(function(){
  const client=window.jeriSupabase;
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const form=document.getElementById('reservationForm');
  if(!form||!client)return;

  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  let catalog=[];

  const readServices=()=>{try{const v=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const writeServices=v=>localStorage.setItem(SERVICES_KEY,JSON.stringify(v));
  const normalize=v=>String(v||'').trim().toLowerCase();
  const currentPeople=()=>Math.max(1,Number(form.querySelector('[name="people"]')?.value)||1);
  function currentReservationId(){try{return editingReservationId||null}catch{return null}}
  function savedForIndex(index){const id=currentReservationId();if(!id)return null;return readServices().filter(x=>String(x.reservationId)===String(id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))[index]||null}
  const inferCategory=item=>item?.category||(/transfer/i.test(item?.name||'')?'Transfer':'Bate Volta');
  const vehicleLabel=item=>item?.vehicle_type||'';
  const basisLabel=v=>v==='per_person'?'por pessoa':v==='per_vehicle'?'por veículo':'fixo';
  const baseKey=item=>[inferCategory(item),item.route_code||'',item.name||''].join('|');
  const groupLabel=item=>item.name||'Serviço';
  const calculateNet=(item,quantity)=>{if(!item)return 0;const qty=item.pricing_basis==='fixed'?1:Math.max(1,Number(quantity)||1);return (Number(item.net_value)||0)*qty};
  function setExisting(card,field,value){const input=card.querySelector(`[data-field="${field}"]`);if(!input)return;input.value=value??'';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}
  function unique(values){return [...new Set(values.filter(Boolean))]}

  function groups(){
    const map=new Map();
    catalog.filter(x=>x.active!==false).forEach(item=>{const key=baseKey(item);if(!map.has(key))map.set(key,{key,label:groupLabel(item),category:inferCategory(item),items:[]});map.get(key).items.push(item)});
    return [...map.values()].sort((a,b)=>a.category.localeCompare(b.category,'pt-BR')||a.label.localeCompare(b.label,'pt-BR'));
  }

  function findMatchingGroup(saved,card){
    if(saved?.serviceCatalogId){const item=catalog.find(x=>String(x.id)===String(saved.serviceCatalogId));if(item)return baseKey(item)}
    const currentService=normalize(card.querySelector('[data-field="service"]')?.value||saved?.service||saved?.title||'');
    const currentOrigin=normalize(card.querySelector('[data-field="origin"]')?.value||saved?.origin||'');
    const currentDestination=normalize(card.querySelector('[data-field="destination"]')?.value||saved?.destination||'');
    const found=catalog.find(item=>{
      const hay=normalize(item.name);
      if(currentService&&hay&&currentService.includes(hay))return true;
      const a=normalize(item.origin),b=normalize(item.destination);
      return a&&b&&((a===currentOrigin&&b===currentDestination)||(item.bidirectional&&a===currentDestination&&b===currentOrigin));
    });
    return found?baseKey(found):'';
  }

  function activeGroup(card){const key=card.querySelector('[data-catalog-base]')?.value||'';return groups().find(g=>g.key===key)||null}
  function variants(card){return activeGroup(card)?.items||[]}
  function resolveVariant(card){
    const list=variants(card);if(!list.length)return null;
    const vehicle=card.querySelector('[data-catalog-vehicle]')?.value||'';
    const modality=card.querySelector('[data-catalog-modality]')?.value||'';
    return list.find(x=>(!vehicle||vehicleLabel(x)===vehicle)&&(!modality||String(x.modality||'')===modality))||list.find(x=>!vehicle||vehicleLabel(x)===vehicle)||list.find(x=>!modality||String(x.modality||'')===modality)||list[0];
  }
  function direction(card,item){
    const value=card.querySelector('[data-catalog-direction]')?.value||'forward';
    if(value==='reverse'&&item?.bidirectional)return{origin:item.destination||'',destination:item.origin||''};
    return{origin:item?.origin||'',destination:item?.destination||''};
  }

  function setManualVisibility(card,managed){
    ['origin','destination','modality','vehicle','tour'].forEach(field=>{
      const label=card.querySelector(`[data-field="${field}"]`)?.closest('label');
      if(!label)return;
      label.classList.toggle('catalog-native-hidden',managed);
    });
  }

  function populateVariantControls(card,preserve=true){
    const list=variants(card);
    const vehicleSelect=card.querySelector('[data-catalog-vehicle]');
    const modalitySelect=card.querySelector('[data-catalog-modality]');
    const directionSelect=card.querySelector('[data-catalog-direction]');
    if(!vehicleSelect||!modalitySelect||!directionSelect)return;
    const oldVehicle=preserve?vehicleSelect.value:'';
    const oldModality=preserve?modalitySelect.value:'';
    const vehicles=unique(list.map(vehicleLabel));
    const modalities=unique(list.map(x=>x.modality));
    vehicleSelect.innerHTML=`<option value="">${vehicles.length?'Escolha o veículo':'Não definido'}</option>${vehicles.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}`;
    modalitySelect.innerHTML=`<option value="">${modalities.length?'Escolha a modalidade':'Não definida'}</option>${modalities.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}`;
    if(vehicles.includes(oldVehicle))vehicleSelect.value=oldVehicle;else if(vehicles.length===1)vehicleSelect.value=vehicles[0];
    if(modalities.includes(oldModality))modalitySelect.value=oldModality;else if(modalities.length===1)modalitySelect.value=modalities[0];
    const item=list[0];
    const hasDirection=Boolean(item?.origin&&item?.destination);
    directionSelect.closest('label').hidden=!hasDirection;
    if(hasDirection){
      directionSelect.innerHTML=`<option value="forward">${escapeHtml(item.origin)} → ${escapeHtml(item.destination)}</option>${item.bidirectional?`<option value="reverse">${escapeHtml(item.destination)} → ${escapeHtml(item.origin)}</option>`:''}`;
      const currentOrigin=normalize(card.querySelector('[data-field="origin"]')?.value);
      const currentDestination=normalize(card.querySelector('[data-field="destination"]')?.value);
      if(item.bidirectional&&normalize(item.destination)===currentOrigin&&normalize(item.origin)===currentDestination)directionSelect.value='reverse';
    }
  }

  function updateCard(card,{syncDefaults=false}={}){
    const group=activeGroup(card);
    const managed=Boolean(group);
    setManualVisibility(card,managed);
    const variant=resolveVariant(card);
    const quantity=variant?.pricing_basis==='per_person'?currentPeople():1;
    const net=calculateNet(variant,quantity);
    const meta=card.querySelector('[data-catalog-meta]');
    if(meta){
      if(!variant)meta.textContent=managed?'Escolha veículo e modalidade para localizar a tarifa NET.':'Selecione um serviço cadastrado ou use o preenchimento manual.';
      else meta.innerHTML=`<span>${escapeHtml(inferCategory(variant))}</span>${vehicleLabel(variant)?`<span>${escapeHtml(vehicleLabel(variant))}</span>`:''}${variant.modality?`<span>${escapeHtml(variant.modality)}</span>`:''}<span>${escapeHtml(basisLabel(variant.pricing_basis))}</span>`;
    }
    if(!variant)return;

    const dir=direction(card,variant);
    if(syncDefaults){
      const type=inferCategory(variant)==='Transfer'?'transfer':'passeio';
      setExisting(card,'serviceType',type);
      setExisting(card,'modality',variant.modality||'');
      setExisting(card,'vehicle',vehicleLabel(variant));
      if(type==='transfer'){
        setExisting(card,'origin',dir.origin);
        setExisting(card,'destination',dir.destination);
        setExisting(card,'route',[dir.origin,dir.destination].filter(Boolean).join(' → '));
        setExisting(card,'service',['Transfer',dir.origin&&dir.destination?`${dir.origin} → ${dir.destination}`:'',variant.modality,vehicleLabel(variant)].filter(Boolean).join(' · '));
      }else{
        setExisting(card,'tour',variant.name||'');
        setExisting(card,'service',variant.name||'');
      }
    }
    if(Number(variant.net_value)>0){
      const netInput=card.querySelector('[data-basic-net-input]');
      if(netInput&&syncDefaults){netInput.value=net.toFixed(2);netInput.dispatchEvent(new Event('input',{bubbles:true}))}
      setExisting(card,'repasseAmount',net.toFixed(2));
    }
  }

  function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}

  function decorateCard(card,index){
    if(card.dataset.catalogV2Ready==='1')return;
    card.dataset.catalogV2Ready='1';
    const grid=card.querySelector('.service-draft-grid');if(!grid)return;
    const saved=savedForIndex(index);
    const allGroups=groups();
    const matchedKey=findMatchingGroup(saved,card);
    const chooser=document.createElement('section');
    chooser.className='reservation-catalog-chooser';
    chooser.innerHTML=`
      <div class="reservation-catalog-title"><div><strong>Serviço cadastrado</strong><small>Selecione rota/passeio, veículo e modalidade. O NET padrão será carregado automaticamente.</small></div><span>CATÁLOGO</span></div>
      <div class="reservation-catalog-grid">
        <label>Serviço / rota *<select data-catalog-base required><option value="">Selecione um serviço cadastrado</option>${allGroups.map(group=>`<option value="${escapeHtml(group.key)}">${escapeHtml(group.category)} · ${escapeHtml(group.label)}</option>`).join('')}</select></label>
        <label data-direction-label>Trecho<select data-catalog-direction></select></label>
        <label>Veículo<select data-catalog-vehicle></select></label>
        <label>Modalidade<select data-catalog-modality></select></label>
      </div>
      <div class="reservation-catalog-meta" data-catalog-meta></div>`;
    grid.prepend(chooser);

    const base=chooser.querySelector('[data-catalog-base]');if(matchedKey)base.value=matchedKey;
    populateVariantControls(card,false);
    if(saved){
      const item=catalog.find(x=>String(x.id)===String(saved.serviceCatalogId));
      const vehicle=vehicleLabel(item)||saved.vehicle||'';
      const modality=item?.modality||saved.modality||'';
      const vehicleSelect=card.querySelector('[data-catalog-vehicle]');const modalitySelect=card.querySelector('[data-catalog-modality]');
      if([...vehicleSelect.options].some(o=>o.value===vehicle))vehicleSelect.value=vehicle;
      if([...modalitySelect.options].some(o=>o.value===modality))modalitySelect.value=modality;
    }
    base.addEventListener('change',()=>{populateVariantControls(card,false);updateCard(card,{syncDefaults:true});window.dispatchEvent(new Event('reservation-finance-refresh'))});
    chooser.querySelector('[data-catalog-direction]')?.addEventListener('change',()=>updateCard(card,{syncDefaults:true}));
    chooser.querySelector('[data-catalog-vehicle]')?.addEventListener('change',()=>updateCard(card,{syncDefaults:true}));
    chooser.querySelector('[data-catalog-modality]')?.addEventListener('change',()=>updateCard(card,{syncDefaults:true}));
    updateCard(card,{syncDefaults:Boolean(matchedKey&&!saved?.serviceCatalogId)});
  }

  function decorate(){document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach((card,index)=>decorateCard(card,index));window.dispatchEvent(new Event('reservation-finance-refresh'))}

  function state(card){
    const item=resolveVariant(card);const quantity=item?.pricing_basis==='per_person'?currentPeople():1;const dir=direction(card,item);const raw=String(card.querySelector('[data-basic-net-input]')?.value||card.querySelector('[data-field="repasseAmount"]')?.value||0);const manual=Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw)||0;
    return{item,quantity,net:manual,direction:card.querySelector('[data-catalog-direction]')?.value||'forward',origin:dir.origin,destination:dir.destination};
  }

  async function loadCatalog(){
    const {data,error}=await client.from('service_catalog').select('*').eq('active',true).order('category').order('name').order('vehicle_type').order('modality');
    if(error){console.error('Falha ao carregar catálogo NET:',error);return}
    catalog=data||[];window.jeriServiceCatalog=catalog;window.dispatchEvent(new Event('jeri-service-catalog-ready'));decorate();
  }

  async function syncCloud(target,states){
    if(!target?.reservationCode)return;
    try{
      const {data:reservation,error:reservationError}=await client.from('reservations').select('id').eq('code',target.reservationCode).maybeSingle();if(reservationError||!reservation)return;
      const {data:rows,error:rowsError}=await client.from('reservation_services').select('id,sort_order').eq('reservation_id',reservation.id).order('sort_order');if(rowsError)return;
      for(let i=0;i<states.length;i++){
        const row=rows?.[i],st=states[i];if(!row||!st.item)continue;
        const update={service_catalog_id:st.item.id,pricing_basis:st.item.pricing_basis,receipt_rule:st.item.receipt_rule||'net_first',net_unit:Number(st.item.net_value)||0,quantity:Number(st.quantity)||1,net_total:st.net,repasse_amount:st.net,updated_at:new Date().toISOString()};
        const {error}=await client.from('reservation_services').update(update).eq('id',row.id);if(error)throw error;
      }
    }catch(e){console.error('Falha ao sincronizar catálogo/NET da reserva:',e)}
  }

  form.addEventListener('submit',()=>{
    const previousId=currentReservationId();
    const states=[...document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft')].map(card=>state(card));
    setTimeout(()=>{
      let target=null;try{target=previousId?reservations.find(x=>String(x.id)===String(previousId)):reservations[reservations.length-1]}catch{}
      if(!target)return;
      const items=readServices();const own=items.filter(x=>String(x.reservationId)===String(target.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      own.forEach((svc,i)=>{
        const st=states[i];if(!st?.item)return;
        Object.assign(svc,{serviceCatalogId:st.item.id,pricingBasis:st.item.pricing_basis,receiptRule:st.item.receipt_rule||'net_first',netUnit:Number(st.item.net_value)||0,quantity:Number(st.quantity)||1,netTotal:st.net,repasseAmount:st.net,vehicle:vehicleLabel(st.item)||svc.vehicle,modality:st.item.modality||svc.modality,origin:st.origin||svc.origin,destination:st.destination||svc.destination});
      });
      writeServices(items);syncCloud(target,states);
    },220);
  });

  form.querySelector('[name="people"]')?.addEventListener('input',()=>{
    document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach(card=>{
      updateCard(card);
    });window.dispatchEvent(new Event('reservation-finance-refresh'));
  });

  const wait=setInterval(()=>{const host=document.getElementById('reservationServiceDrafts');if(!host)return;clearInterval(wait);new MutationObserver(()=>setTimeout(decorate,0)).observe(host,{childList:true,subtree:false});loadCatalog()},80);
})();
