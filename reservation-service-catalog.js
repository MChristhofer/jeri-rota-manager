(function(){
  const client=window.jeriSupabase;
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const form=document.getElementById('reservationForm');
  if(!form||!client)return;

  let catalog=[];

  const readServices=()=>{try{const v=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const readReservations=()=>{try{const v=JSON.parse(localStorage.getItem(RESERVATIONS_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const normalize=v=>String(v||'').trim().toLowerCase();
  const moneyNumber=value=>{const raw=String(value??'').trim().replace(/\s|R\$/g,'');if(!raw)return 0;return Math.max(0,Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw)||0)};
  const currentPeople=()=>Math.max(1,Number(form.querySelector('[name="people"]')?.value)||1);
  const inferCategory=item=>item?.category||(/transfer/i.test(item?.name||'')?'Transfer':'Passeio');
  const vehicleLabel=item=>item?.vehicle_type||'';
  const baseKey=item=>[inferCategory(item),item.route_code||'',item.name||''].join('|');
  const groupLabel=item=>item.name||'Serviço';
  const calculateNet=(item,quantity)=>window.JeriFinance.serviceNet(item?.net_value,item?.modality,quantity);
  const unique=values=>[...new Set(values.filter(Boolean))];
  const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function setExisting(card,field,value){
    window.JeriReservationDrafts?.update(card,{[field]:value??''});
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

  function setNetFromVariant(card,variant){
    if(!variant)return 0;
    const quantity=window.JeriFinance.shared(variant.modality)?currentPeople():1;
    const net=calculateNet(variant,quantity);
    const netInput=card.querySelector('[data-basic-net-input]');
    if(netInput){
      netInput.value=Number(net||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
      netInput.dispatchEvent(new Event('input',{bubbles:true}));
    }

    return net;
  }

  function applyVariant(card,variant,{syncDefaults=false}={}){
    const managed=Boolean(activeGroup(card));
    setManualVisibility(card,managed);
    const meta=card.querySelector('[data-catalog-meta]');
    if(meta)meta.textContent=variant?'NET padrão carregado do catálogo. Você pode editar o Valor NET abaixo.':managed?'Escolha veículo e modalidade para localizar a tarifa NET.':'Selecione um serviço cadastrado.';
    if(syncDefaults)window.JeriReservationDrafts?.update(card,{
      catalogBase:card.querySelector('[data-catalog-base]')?.value||'',
      catalogVehicle:card.querySelector('[data-catalog-vehicle]')?.value||'',
      catalogModality:card.querySelector('[data-catalog-modality]')?.value||''
    });
    if(!variant){
      if(syncDefaults){
        window.JeriReservationDrafts?.update(card,{serviceCatalogId:null,netUnit:null});
        setExisting(card,'repasseAmount','0,00');
      }
      return;
    }
    if(syncDefaults)window.JeriReservationDrafts?.update(card,{serviceCatalogId:variant.id,pricingBasis:window.JeriFinance.basis(variant.modality),netUnit:moneyNumber(variant.net_value),quantity:window.JeriFinance.shared(variant.modality)?currentPeople():1});

    const type=inferCategory(variant)==='Transfer'?'transfer':'passeio';

    if(syncDefaults){
      window.JeriReservationDrafts?.update(card,{title:variant.name||'',service:variant.name||'',modality:variant.modality||'',vehicle:vehicleLabel(variant)});
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
      setNetFromVariant(card,variant);
    }
  }

  function decorateCard(card,index){
    const saved=window.JeriReservationDrafts?.get(card);
    if(card.dataset.catalogDecorated==='true')return;
    card.dataset.catalogDecorated='true';
    card.dataset.savedCatalogId=saved?.serviceCatalogId||'';
    let chooser=card.querySelector('.reservation-catalog-chooser');
    const matchedKey=saved?.catalogBase??findMatchingGroup(saved,card);
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
    base.required=!saved?.service&&!saved?.title||Boolean(saved?.serviceCatalogId);
    const previousBase=base.value;
    base.innerHTML=`<option value="">Selecione um serviço cadastrado</option>${allGroups.map(group=>`<option value="${escapeHtml(group.key)}">${escapeHtml(group.category)} · ${escapeHtml(group.label)}</option>`).join('')}`;
    if(allGroups.some(g=>g.key===previousBase))base.value=previousBase;else if(matchedKey)base.value=matchedKey;

    populateVariantControls(card,true);
    if(saved?.serviceCatalogId){
      const item=catalog.find(x=>String(x.id)===String(saved.serviceCatalogId));
      const vehicle=saved.vehicle||vehicleLabel(item)||'';
      const modality=saved.modality||item?.modality||'';
      const vehicleSelect=card.querySelector('[data-catalog-vehicle]');
      const modalitySelect=card.querySelector('[data-catalog-modality]');
      if([...vehicleSelect.options].some(o=>o.value===vehicle))vehicleSelect.value=vehicle;
      populateModalityControls(card,false);
      if([...modalitySelect.options].some(o=>o.value===modality))modalitySelect.value=modality;
    }
    if(saved?.catalogVehicle!==undefined){
      chooser.querySelector('[data-catalog-vehicle]').value=saved.catalogVehicle;
      populateModalityControls(card,false);
      chooser.querySelector('[data-catalog-modality]').value=saved.catalogModality||'';
    }

    const variant=resolveVariant(card);
    applyVariant(card,variant,{syncDefaults:false});
  }

  function decorate(){
    document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach((card,index)=>decorateCard(card,index));
    window.dispatchEvent(new Event('reservation-finance-refresh'));
  }

  function pendingServiceNetTotal(){
    const activeReservations=new Map(readReservations().filter(r=>r.status!=='Cancelada').map(r=>[String(r.id),r]));
    return readServices().reduce((sum,service)=>{
      if(!activeReservations.has(String(service.reservationId)))return sum;
      const status=normalize(service.repasseStatus);
      if(/^(pago|quitado|realizado|cancelado)$/i.test(status))return sum;
      return sum+window.JeriFinance.storedNet(service);
    },0);
  }

  function patchDashboardFinance(){
    const payable=pendingServiceNetTotal();
    const payableNode=document.getElementById('dashboardPayable');
    if(payableNode)payableNode.textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(payable);

    const active=readReservations().filter(r=>r.status!=='Cancelada');
    const received=active.reduce((sum,r)=>sum+(r.collectedBy==='Jeri Rota'?moneyNumber(r.paidAmount):0),0);
    const free=received-payable;
    const freeNode=document.getElementById('dashboardFreeBalance');
    if(freeNode){
      freeNode.textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(free);
      freeNode.classList.toggle('negative-value',free<0);
    }
  }

  function installDashboardPatch(){
    const base=window.renderDashboard;
    if(typeof base!=='function'||base.__serviceNetPatched){patchDashboardFinance();return;}
    const wrapped=function(){const result=base.apply(this,arguments);patchDashboardFinance();return result};
    wrapped.__serviceNetPatched=true;
    window.renderDashboard=wrapped;
    try{renderDashboard=wrapped}catch{}
    patchDashboardFinance();
  }

  async function loadCatalog(){
    const {data,error}=await client.from('service_catalog').select('*').order('category').order('name').order('vehicle_type').order('modality');
    if(error){console.error('Falha ao carregar catálogo NET:',error);return;}
    catalog=data||[];
    document.querySelectorAll('[data-catalog-decorated]').forEach(card=>delete card.dataset.catalogDecorated);
    window.jeriServiceCatalog=catalog;
    decorate();
    patchDashboardFinance();
  }

  let previousPeople=currentPeople();
  function peopleChanged(){
    const people=currentPeople();if(people===previousPeople)return;
    previousPeople=people;
    document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach(card=>{
      const variant=resolveVariant(card),draft=window.JeriReservationDrafts?.get(card);
      if(!window.JeriFinance.shared(variant?.modality||draft?.modality))return;
      if(variant)setNetFromVariant(card,variant);
      else if(draft?.netUnit!=null){
        const input=card.querySelector('[data-basic-net-input]');
        input.value=window.JeriFinance.serviceNet(draft.netUnit,draft.modality,people).toFixed(2);
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      window.JeriReservationDrafts?.update(card,{quantity:people});
    });
  }
  form.querySelector('[name="people"]')?.addEventListener('input',peopleChanged);
  window.addEventListener('reservation-drafts-rendered',()=>{previousPeople=currentPeople();decorate()});

  window.addEventListener('jeri-service-catalog-changed',event=>{
    if(Array.isArray(event.detail?.services))catalog=event.detail.services;
    else loadCatalog();
    decorate();
  });
  window.addEventListener('storage',event=>{if(event.key===SERVICES_KEY||event.key===RESERVATIONS_KEY)patchDashboardFinance()});
  window.addEventListener('reservation-finance-refresh',patchDashboardFinance);

  installDashboardPatch();
  const wait=setInterval(()=>{
    const host=document.getElementById('reservationServiceDrafts');if(!host)return;
    clearInterval(wait);
    new MutationObserver(()=>setTimeout(decorate,0)).observe(host,{childList:true,subtree:false});
    loadCatalog();
  },80);
})();
