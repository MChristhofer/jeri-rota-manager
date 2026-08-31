(function(){
  const byId=id=>document.getElementById(id);
  const STYLE_ID='reservationLocationToolsStyle';
  const MEMORY_KEY='jeri-rota-manager-location-memory-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const DATALIST_ID='reservationLocationMemorySuggestions';

  const normalize=value=>String(value||'').trim().replace(/\s+/g,' ');
  const memoryKey=value=>normalize(value).toLocaleLowerCase('pt-BR');
  const readJson=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch{return fallback}};

  function readMemory(){
    const raw=readJson(MEMORY_KEY,[]);
    return Array.isArray(raw)?raw:[];
  }

  function writeMemory(items){
    const unique=new Map();
    items.forEach(item=>{
      const name=normalize(typeof item==='string'?item:item?.name);
      if(!name)return;
      const key=memoryKey(name);
      const previous=unique.get(key)||{};
      unique.set(key,{
        name,
        uses:Math.max(Number(previous.uses)||0,Number(item?.uses)||0,1),
        lastUsed:Math.max(Number(previous.lastUsed)||0,Number(item?.lastUsed)||0,Date.now())
      });
    });
    const list=[...unique.values()]
      .sort((a,b)=>(b.uses-a.uses)||(b.lastUsed-a.lastUsed)||a.name.localeCompare(b.name,'pt-BR'))
      .slice(0,150);
    localStorage.setItem(MEMORY_KEY,JSON.stringify(list));
    refreshDatalist(list);
    return list;
  }

  function seedFromExistingReservations(){
    const memory=readMemory();
    const known=new Map(memory.map(item=>[memoryKey(item.name),{...item}]));
    const services=readJson(SERVICES_KEY,[]);
    if(Array.isArray(services)){
      services.forEach(service=>{
        const candidates=[];
        if(service?.boarding)candidates.push(service.boarding);
        if(service?.dropoff)candidates.push(service.dropoff);
        if(Array.isArray(service?.boardingPoints))service.boardingPoints.forEach(point=>candidates.push(point?.location||point?.name||point));
        if(Array.isArray(service?.dropoffPoints))service.dropoffPoints.forEach(point=>candidates.push(point?.location||point?.name||point));
        candidates.forEach(value=>{
          const name=normalize(value);
          if(!name)return;
          const key=memoryKey(name);
          if(!known.has(key))known.set(key,{name,uses:1,lastUsed:Date.now()-1});
        });
      });
    }
    writeMemory([...known.values()]);
  }

  function rememberLocation(value){
    const name=normalize(value);
    if(!name)return;
    const memory=readMemory();
    const key=memoryKey(name);
    const found=memory.find(item=>memoryKey(item.name)===key);
    if(found){
      found.name=name;
      found.uses=(Number(found.uses)||0)+1;
      found.lastUsed=Date.now();
    }else{
      memory.push({name,uses:1,lastUsed:Date.now()});
    }
    writeMemory(memory);
  }

  function ensureDatalist(){
    let datalist=byId(DATALIST_ID);
    if(!datalist){
      datalist=document.createElement('datalist');
      datalist.id=DATALIST_ID;
      document.body.appendChild(datalist);
    }
    return datalist;
  }

  function refreshDatalist(memory=readMemory()){
    const datalist=ensureDatalist();
    const ordered=[...memory].sort((a,b)=>(b.uses-a.uses)||(b.lastUsed-a.lastUsed));
    datalist.innerHTML=ordered.map(item=>`<option value="${String(item.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"></option>`).join('');
  }

  function ensureStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .reservation-location-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px}
      .reservation-map-button{display:inline-flex;align-items:center;gap:6px;width:max-content;min-height:30px;padding:6px 9px;border:1px solid #d8c08c;border-radius:8px;background:#fffaf0;color:#74551b;font:700 10px 'DM Sans',sans-serif;cursor:pointer}
      .reservation-map-button:hover:not(:disabled){border-color:#c99a3b;background:#fff6df}
      .reservation-map-button:disabled{opacity:.45;cursor:not-allowed}
      .reservation-location-help{color:#7a8388;font-size:9px;font-weight:500;line-height:1.35}
    `;
    document.head.appendChild(style);
  }

  function mapsUrl(value){
    const query=String(value||'').trim();
    return query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:'';
  }

  function removeGlobalLocationManager(){
    const form=byId('managerLocationForm');
    const panel=form?.closest('.manager-services-panel');
    if(panel)panel.remove();
  }

  function removeLegacySuggestions(){
    const old=byId('reservationLocationSuggestions');
    if(old)old.remove();
  }

  function enhanceInput(input,kind){
    if(!input)return;
    input.setAttribute('list',DATALIST_ID);
    input.setAttribute('autocomplete','off');
    input.placeholder=kind==='boarding'?'Digite ou escolha um embarque já usado':'Digite ou escolha um desembarque já usado';

    const label=input.closest('label');
    if(!label)return;

    let tools=label.querySelector('.reservation-location-tools');
    if(!tools){
      tools=document.createElement('div');
      tools.className='reservation-location-tools';
      label.appendChild(tools);
    }

    let button=tools.querySelector('.reservation-map-button');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='reservation-map-button';
      button.innerHTML='<span aria-hidden="true">⌖</span> Ver no Google Maps';
      tools.appendChild(button);
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        const url=mapsUrl(input.value);
        if(url)window.open(url,'_blank','noopener,noreferrer');
      });
    }

    let help=tools.querySelector('.reservation-location-help');
    if(!help){
      help=document.createElement('small');
      help.className='reservation-location-help';
      help.textContent='Locais usados ficam memorizados para próximas reservas.';
      tools.appendChild(help);
    }

    const updateState=()=>{
      const hasLocation=Boolean(normalize(input.value));
      button.disabled=!hasLocation;
      button.setAttribute('aria-disabled',String(!hasLocation));
      button.title=hasLocation?'Abrir este local em uma nova aba do Google Maps':'Preencha o local primeiro';
    };

    if(input.dataset.locationMemoryListener!=='true'){
      input.dataset.locationMemoryListener='true';
      input.addEventListener('input',updateState);
      input.addEventListener('change',()=>{
        updateState();
        if(normalize(input.value))rememberLocation(input.value);
      });
      input.addEventListener('blur',()=>{
        if(normalize(input.value))rememberLocation(input.value);
      });
    }
    updateState();
  }

  function rememberCurrentFormLocations(){
    document.querySelectorAll('#reservationServiceDrafts [data-point-field="location"]').forEach(input=>{
      if(normalize(input.value))rememberLocation(input.value);
    });
  }

  function enhanceAll(){
    ensureStyles();
    ensureDatalist();
    removeGlobalLocationManager();
    removeLegacySuggestions();
    document.querySelectorAll('#reservationServiceDrafts [data-point-kind="boarding"] [data-point-field="location"]').forEach(input=>enhanceInput(input,'boarding'));
    document.querySelectorAll('#reservationServiceDrafts [data-point-kind="dropoff"] [data-point-field="location"]').forEach(input=>enhanceInput(input,'dropoff'));
  }

  const reservationForm=byId('reservationForm');
  if(reservationForm&&reservationForm.dataset.locationMemorySubmit!=='true'){
    reservationForm.dataset.locationMemorySubmit='true';
    reservationForm.addEventListener('submit',rememberCurrentFormLocations,true);
  }

  window.addEventListener('storage',event=>{
    if(event.key===MEMORY_KEY||event.key===SERVICES_KEY){
      if(event.key===SERVICES_KEY)seedFromExistingReservations();
      refreshDatalist();
    }
  });

  let scheduled=false;
  const scheduleEnhance=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      enhanceAll();
    });
  };

  const observer=new MutationObserver(mutations=>{
    const relevant=mutations.some(mutation=>[...mutation.addedNodes].some(node=>{
      if(node.nodeType!==Node.ELEMENT_NODE)return false;
      const el=node;
      return el.matches?.('#reservationServiceDrafts,.reservation-service-draft,[data-point-kind],[data-point-field="location"],#managerLocationForm')||
        el.querySelector?.('#reservationServiceDrafts,.reservation-service-draft,[data-point-kind],[data-point-field="location"],#managerLocationForm');
    }));
    if(relevant)scheduleEnhance();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  seedFromExistingReservations();
  refreshDatalist();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceAll,{once:true});
  else enhanceAll();
})();
