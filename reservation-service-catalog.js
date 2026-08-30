(function(){
  const client=window.jeriSupabase;
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const form=document.getElementById('reservationForm');
  if(!form||!client)return;

  let catalog=[];

  const readServices=()=>{try{const v=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const writeServices=v=>localStorage.setItem(SERVICES_KEY,JSON.stringify(v));
  const normalize=v=>String(v||'').trim().toLowerCase();
  const currentPeople=()=>Math.max(1,Number(form.querySelector('[name="people"]')?.value)||1);
  function currentReservationId(){try{return editingReservationId||null}catch{return null}}
  function savedForIndex(index){const id=currentReservationId();if(!id)return null;return readServices().filter(x=>String(x.reservationId)===String(id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))[index]||null}
  const inferCategory=item=>item?.category||(/transfer/i.test(item?.name||'')?'Transfer':'Passeio');
  const vehicleLabel=item=>item?.vehicle_type||'';
  const baseKey=item=>[inferCategory(item),item.route_code||'',item.name||''].join('|');
  const groupLabel=item=>item.name||'Serviço';
  const calculateNet=(item,quantity)=>{if(!item)return 0;const qty=item.pricing_basis==='fixed'?1:Math.max(1,Number(quantity)||1);return (Number(item.net_value)||0)*qty};
  const unique=values=>[...new Set(values.filter(Boolean))];
  const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function setExisting(card,field,value){
    const input=card.querySelector(`[data-field="${field}"]`);if(!input)return;
    input.value=value??'';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function groups(includeIds=[]){
    const map=new Map();
    catalog.filter(x=>x.active!==false||includeIds.some(id=>String(id)===String(x.id))).forEach(item=>{
      const key=baseKey(item);
      if(!map.has(key))map.set(key,{key,label:groupLabel(item),category:inferCategory(item),items:[]});
      map.get(key).items.push(item);
    });
    return [...map.values()].sort((a,b)=>a.category.localeCompare(b.category,'pt-BR')||a.label.localeCompare(b.label,'pt-BR'));
  }

  function findMatchingGroup(saved,card){
    if(saved?.serviceCatalogId){const item=catalog.find(x=>String(x.id)===String(saved.serviceCatalogId));if(item)return baseKey(item)}
    const currentService=normalize(card.querySelector('[data-field="service"]')?.value||saved?.service||saved?.title||'');
    const found=catalog.find(item=>currentService&&normalize(item.name)&&currentService.includes(normalize(item.name)));
    return found?baseKey(found):'';
  }

  function activeGroup(card){const key=card.querySelector('[data-catalog-base]')?.value||'';return groups([card.dataset.savedCatalogId]).find(g=>g.key===key)||null}
  function variants(card){return activeGroup(card)?.items||[]}
  function resolveVariant(card){
    const list=variants(card);if(!list.length)return null;
    const vehicle=card.querySelector('[data-catalog-vehicle]')?.value||'';
    const modality=card.querySelector('[data-catalog-modality]')?.value||'';
    const hasVehicles=list.some(x=>vehicleLabel(x));
    const matching=list.filter(x=>!hasVehicles||vehicleLabel(x)===vehicle);
    if(hasVehicles&&!vehicle)return null;
    if(matching.some(x=>x.modality)&&!modality)return null;
    return matching.find(x=>String(x.modality||'')===modality)||matching.find(x=>!x.modality)||null;
  }

  function setManualVisibility(card,managed){
    ['origin','destination','modality','vehicle','tour'].forEach(field=>{
      const label=card.querySelector(`[data-field="${field}"]`)?.closest('label');
      if(label)label.classList.toggle('catalog-native-hidden',managed);
    });
  }

  function populateVariantControls(card,preserve=true){
    const list=variants(card);
    const vehicleSelect=card.querySelector('[data-catalog-vehicle]');
    const modalitySelect=card.querySelector('[data-catalog-modality]');
    if(!vehicleSelect||!modalitySelect)return;
    const oldVehicle=preserve?vehicleSelect.value:'';
    const vehicles=unique(list.map(vehicleLabel));
    vehicleSelect.innerHTML=`<option value="">${vehicles.length?'Escolha o veículo':'Não definido'}</option>${vehicles.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}`;
    vehicleSelect.required=vehicles.length>0;
    if(vehicles.includes(oldVehicle))vehicleSelect.value=oldVehicle;else if(vehicles.length===1)vehicleSelect.value=vehicles[0];
    populateModalityControls(card,preserve);
  }

  function populateModalityControls(card,preserve=true){
    const modalitySelect=card.querySelector('[data-catalog-modality]');if(!modalitySelect)return;
    const oldModality=preserve?modalitySelect.value:'';
    const list=variants(card);
    const vehicle=card.querySelector('[data-catalog-vehicle]')?.value||'';
    const hasVehicles=list.some(x=>vehicleLabel(x));
    const available=list.filter(x=>!hasVehicles||vehicleLabel(x)===vehicle);
    const modalities=unique(available.map(x=>x.modality));
    modalitySelect.innerHTML=`<option value="">${modalities.length?'Escolha a modalidade':'Não definida'}</option>${modalities.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}`;
    modalitySelect.required=modalities.length>0;
    if(modalities.includes(oldModality))modalitySelect.value=oldModality;else if(modalities.length===1)modalitySelect.value=modalities[0];
  }

  function applyVariant(card,variant,{syncDefaults=false}={}){
    const managed=Boolean(activeGroup(card));
    setManualVisibility(card,managed);
    const meta=card.querySelector('[data-catalog-meta]');
    if(meta)meta.textContent=variant?'NET padrão carregado do catálogo. Você pode editar o Valor NET abaixo.':managed?'Escolha veículo e modalidade para localizar a tarifa NET.':'Selecione um serviço cadastrado.';
    if(!variant)return;

    const quantity=variant.pricing_basis==='per_person'?currentPeople():1;
    const net=calculateNet(variant,quantity);
    const type=inferCategory(variant)==='Transfer'?'transfer':'passeio';

    if(syncDefaults){
      setExisting(card,'serviceType',type);
      setExisting(card,'modality',variant.modality||'');
      setExisting(card,'vehicle',vehicleLabel(variant));
      if(type==='transfer'){
        const routeParts=String(variant.name||'').split(/\s*(?:→|->)\s*/);
        const origin=variant.origin||routeParts[0]||'';
        const destination=variant.destination||routeParts[1]||'';
        setExisting(card,'origin',origin);
        setExisting(card,'destination',destination);
        setExisting(card,'route',[origin,destination].filter(Boolean).join(' → '));
        setExisting(card,'service',variant.name||['Transfer',origin&&destination?`${origin} → ${destination}`:''].filter(Boolean).join(' · '));
      }else{
        setExisting(card,'tour',variant.name||'');
        setExisting(card,'service',variant.name||'');
      }

      const netInput=card.querySelector('[data-basic-net-input]');
      if(netInput){
        netInput.value=Number(net||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
        netInput.dispatchEvent(new Event('input',{bubbles:true}));
      }
      setExisting(card,'repasseAmount',net.toFixed(2));
    }
  }

  function decorateCard(card,index){
    const saved=savedForIndex(index);
    card.dataset.savedCatalogId=saved?.serviceCatalogId||'';
    let chooser=card.querySelector('.reservation-catalog-chooser');
    const matchedKey=findMatchingGroup(saved,card);
    const allGroups=groups([saved?.serviceCatalogId]);

    if(!chooser){
      chooser=document.createElement('section');
      chooser.className='reservation-catalog-chooser';
      chooser.innerHTML=`
        <div class="reservation-catalog-title"><div><strong>Serviço cadastrado</strong><small>Selecione serviço/rota, veículo e modalidade. O NET padrão será carregado automaticamente.</small></div><span>CATÁLOGO</span></div>
        <div class="reservation-catalog-grid">
          <label>Serviço / rota *<select data-catalog-base required></select></label>
          <label>Veículo<select data-catalog-vehicle></select></label>
          <label>Modalidade<select data-catalog-modality></select></label>
        </div>
        <div class="reservation-catalog-meta" data-catalog-meta></div>`;
      card.querySelector('.service-draft-grid')?.prepend(chooser);

      chooser.querySelector('[data-catalog-base]')?.addEventListener('change',()=>{
        populateVariantControls(card,false);
        applyVariant(card,resolveVariant(card),{syncDefaults:true});
        window.dispatchEvent(new Event('reservation-finance-refresh'));
      });
      chooser.querySelector('[data-catalog-vehicle]')?.addEventListener('change',()=>{
        populateModalityControls(card,false);
        applyVariant(card,resolveVariant(card),{syncDefaults:true});
      });
      chooser.querySelector('[data-catalog-modality]')?.addEventListener('change',()=>applyVariant(card,resolveVariant(card),{syncDefaults:true}));
    }

    const base=chooser.querySelector('[data-catalog-base]');
    const previousBase=base.value;
    base.innerHTML=`<option value="">Selecione um serviço cadastrado</option>${allGroups.map(group=>`<option value="${escapeHtml(group.key)}">${escapeHtml(group.category)} · ${escapeHtml(group.label)}</option>`).join('')}`;
    if(allGroups.some(g=>g.key===previousBase))base.value=previousBase;else if(matchedKey)base.value=matchedKey;

    populateVariantControls(card,true);
    if(saved?.serviceCatalogId){
      const item=catalog.find(x=>String(x.id)===String(saved.serviceCatalogId));
      const vehicle=vehicleLabel(item)||saved.vehicle||'';
      const modality=item?.modality||saved.modality||'';
      const vehicleSelect=card.querySelector('[data-catalog-vehicle]');
      const modalitySelect=card.querySelector('[data-catalog-modality]');
      if([...vehicleSelect.options].some(o=>o.value===vehicle))vehicleSelect.value=vehicle;
      populateModalityControls(card,false);
      if([...modalitySelect.options].some(o=>o.value===modality))modalitySelect.value=modality;
    }
    applyVariant(card,resolveVariant(card),{syncDefaults:false});
  }

  function decorate(){
    document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach((card,index)=>decorateCard(card,index));
    window.dispatchEvent(new Event('reservation-finance-refresh'));
  }

  function state(card){
    const item=resolveVariant(card);
    const quantity=item?.pricing_basis==='per_person'?currentPeople():1;
    const raw=String(card.querySelector('[data-basic-net-input]')?.value||card.querySelector('[data-field="repasseAmount"]')?.value||0);
    const manual=Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw)||0;
    return{item,quantity,net:manual};
  }

  async function loadCatalog(){
    const {data,error}=await client.from('service_catalog').select('*').order('category').order('name').order('vehicle_type').order('modality');
    if(error){console.error('Falha ao carregar catálogo NET:',error);return;}
    catalog=data||[];
    window.jeriServiceCatalog=catalog;
    decorate();
  }

  async function syncCloud(target,states){
    if(!target?.reservationCode)return;
    try{
      const {data:reservation,error:reservationError}=await client.from('reservations').select('id').eq('code',target.reservationCode).maybeSingle();
      if(reservationError||!reservation)return;
      const {data:rows,error:rowsError}=await client.from('reservation_services').select('id,sort_order').eq('reservation_id',reservation.id).order('sort_order');
      if(rowsError)return;
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
      const items=readServices();
      const own=items.filter(x=>String(x.reservationId)===String(target.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      own.forEach((svc,i)=>{
        const st=states[i];if(!st?.item)return;
        Object.assign(svc,{serviceCatalogId:st.item.id,pricingBasis:st.item.pricing_basis,receiptRule:st.item.receipt_rule||'net_first',netUnit:Number(st.item.net_value)||0,quantity:Number(st.quantity)||1,netTotal:st.net,repasseAmount:st.net,vehicle:vehicleLabel(st.item)||svc.vehicle,modality:st.item.modality||svc.modality});
      });
      writeServices(items);
      syncCloud(target,states);
    },220);
  });

  form.querySelector('[name="people"]')?.addEventListener('input',()=>document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach(card=>applyVariant(card,resolveVariant(card),{syncDefaults:true})));

  window.addEventListener('jeri-service-catalog-changed',event=>{
    if(Array.isArray(event.detail?.services))catalog=event.detail.services;
    else loadCatalog();
    decorate();
  });

  const wait=setInterval(()=>{
    const host=document.getElementById('reservationServiceDrafts');if(!host)return;
    clearInterval(wait);
    new MutationObserver(()=>setTimeout(decorate,0)).observe(host,{childList:true,subtree:false});
    loadCatalog();
  },80);
})();
