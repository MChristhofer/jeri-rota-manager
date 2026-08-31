(function(){
  const HOST_ID='reservationServiceDrafts';
  const FORM_ID='reservationForm';
  let snapshot=null;
  let restoring=false;

  const moneyNumber=value=>{
    const raw=String(value??'').trim().replace(/\s|R\$/g,'');
    if(!raw)return 0;
    return Math.max(0,Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw)||0);
  };

  function currentEditingId(){
    try{return editingReservationId??window.editingReservationId??null}catch{return window.editingReservationId??null}
  }

  function syncEditingId(){
    const form=document.getElementById(FORM_ID);
    if(!form)return;
    const id=currentEditingId();
    if(id!==null&&id!==undefined&&String(id)!=='')form.dataset.editingReservationId=String(id);
    else delete form.dataset.editingReservationId;
  }

  function readFields(card,selector,keyAttr){
    const values={};
    card.querySelectorAll(selector).forEach(input=>{
      const key=input.getAttribute(keyAttr);
      if(key)values[key]=input.value;
    });
    return values;
  }

  function readPoints(card,kind){
    return [...card.querySelectorAll(`[data-point-kind="${kind}"] [data-point-index]`)].map(row=>({
      location:row.querySelector('[data-point-field="location"]')?.value||'',
      apartment:row.querySelector('[data-point-field="apartment"]')?.value||'',
      passengers:row.querySelector('[data-point-field="passengers"]')?.value||''
    }));
  }

  function capture(){
    const host=document.getElementById(HOST_ID);
    if(!host)return null;
    syncEditingId();
    snapshot={
      total:document.getElementById('reservationTotalAmount')?.value||'',
      received:document.getElementById('reservationReceivedAmount')?.value||'',
      cards:[...host.querySelectorAll('.reservation-service-draft')].map(card=>({
        fields:readFields(card,'[data-field]','data-field'),
        boarding:readPoints(card,'boarding'),
        dropoff:readPoints(card,'dropoff'),
        legMode:card.querySelector('[data-leg-mode]')?.value||card.dataset.legMode||'',
        catalogBase:card.querySelector('[data-catalog-base]')?.value||'',
        catalogVehicle:card.querySelector('[data-catalog-vehicle]')?.value||'',
        catalogModality:card.querySelector('[data-catalog-modality]')?.value||'',
        savedCatalogId:card.dataset.savedCatalogId||'',
        net:card.querySelector('[data-basic-net-input]')?.value||''
      }))
    };
    return snapshot;
  }

  function dispatch(input,type='input'){
    if(!input)return;
    input.dispatchEvent(new Event(type,{bubbles:true}));
  }

  function setValue(input,value,{change=false}={}){
    if(!input||value===undefined||value===null)return false;
    const next=String(value);
    if(input.value===next)return false;
    input.value=next;
    dispatch(input,'input');
    if(change)dispatch(input,'change');
    return true;
  }

  function restoreCatalog(card,state){
    const base=card.querySelector('[data-catalog-base]');
    if(state.savedCatalogId)card.dataset.savedCatalogId=state.savedCatalogId;
    if(base&&state.catalogBase&&[...base.options].some(option=>option.value===state.catalogBase)){
      if(base.value!==state.catalogBase){
        base.value=state.catalogBase;
        dispatch(base,'change');
      }
    }
    const vehicle=card.querySelector('[data-catalog-vehicle]');
    if(vehicle&&state.catalogVehicle&&[...vehicle.options].some(option=>option.value===state.catalogVehicle)){
      if(vehicle.value!==state.catalogVehicle){vehicle.value=state.catalogVehicle;dispatch(vehicle,'change')}
    }
    const modality=card.querySelector('[data-catalog-modality]');
    if(modality&&state.catalogModality&&[...modality.options].some(option=>option.value===state.catalogModality)){
      if(modality.value!==state.catalogModality){modality.value=state.catalogModality;dispatch(modality,'change')}
    }
  }

  function restoreFields(card,state){
    Object.entries(state.fields||{}).forEach(([key,value])=>{
      const input=card.querySelector(`[data-field="${CSS.escape(key)}"]`);
      setValue(input,value,{change:input?.tagName==='SELECT'});
    });
  }

  function restorePoints(card,state,kind){
    const saved=state[kind]||[];
    const rows=[...card.querySelectorAll(`[data-point-kind="${kind}"] [data-point-index]`)];
    saved.forEach((point,index)=>{
      const row=rows[index];if(!row)return;
      ['location','apartment','passengers'].forEach(field=>setValue(row.querySelector(`[data-point-field="${field}"]`),point[field]||''));
    });
  }

  function restoreNet(card,state){
    const input=card.querySelector('[data-basic-net-input]');
    if(!input||state.net==='')return;
    const current=moneyNumber(input.value),wanted=moneyNumber(state.net);
    if(Math.abs(current-wanted)<0.005)return;
    input.value=state.net;
    input.dataset.netUserChanged='true';
    dispatch(input,'input');
  }

  function restore(){
    if(restoring||!snapshot)return;
    const host=document.getElementById(HOST_ID);if(!host)return;
    restoring=true;
    try{
      const cards=[...host.querySelectorAll('.reservation-service-draft')];
      snapshot.cards.forEach((state,index)=>{
        const card=cards[index];if(!card)return;
        restoreCatalog(card,state);
        restoreFields(card,state);
        restorePoints(card,state,'boarding');
        restorePoints(card,state,'dropoff');
        if(state.legMode){
          card.dataset.legMode=state.legMode;
          const select=card.querySelector('[data-leg-mode]');
          if(select&&[...select.options].some(option=>option.value===state.legMode))select.value=state.legMode;
        }
        restoreNet(card,state);
      });
      setValue(document.getElementById('reservationTotalAmount'),snapshot.total);
      setValue(document.getElementById('reservationReceivedAmount'),snapshot.received);
      syncEditingId();
      window.dispatchEvent(new Event('reservation-finance-refresh'));
    }finally{restoring=false}
  }

  function scheduleRestore(){
    [0,25,80,180,360].forEach(delay=>setTimeout(restore,delay));
  }

  document.addEventListener('click',event=>{
    const structural=event.target.closest?.('#addReservationService,.add-location-point,.remove-location-point,.duplicate-service-draft,.remove-service-draft');
    if(!structural)return;
    capture();
    scheduleRestore();
  },true);

  document.addEventListener('click',event=>{
    const edit=event.target.closest?.('[data-edit],[data-settlement-edit]');
    if(!edit)return;
    const id=edit.dataset.edit||edit.dataset.settlementEdit;
    const form=document.getElementById(FORM_ID);
    if(form&&id)form.dataset.editingReservationId=String(id);
  },true);

  const formTimer=setInterval(()=>{
    const form=document.getElementById(FORM_ID);
    if(!form)return;
    clearInterval(formTimer);
    form.addEventListener('submit',()=>{
      syncEditingId();
      capture();
    },true);
  },60);

  const modalTimer=setInterval(()=>{
    if(typeof window.openModal!=='function')return;
    clearInterval(modalTimer);
    const base=window.openModal;
    if(base.__draftPreserverWrapped)return;
    const wrapped=function(id=null){
      const form=document.getElementById(FORM_ID);
      if(form){
        if(id!==null&&id!==undefined)form.dataset.editingReservationId=String(id);
        else delete form.dataset.editingReservationId;
      }
      snapshot=null;
      const result=base.apply(this,arguments);
      setTimeout(syncEditingId,30);
      return result;
    };
    wrapped.__draftPreserverWrapped=true;
    window.openModal=wrapped;
    try{openModal=wrapped}catch{}
  },80);
})();
