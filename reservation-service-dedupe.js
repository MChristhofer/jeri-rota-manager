(function(){
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const FORM_ID='reservationForm';

  function readServices(){
    try{
      const list=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');
      return Array.isArray(list)?list:[];
    }catch{return[]}
  }

  function writeServices(list){
    localStorage.setItem(SERVICES_KEY,JSON.stringify(list));
  }

  const norm=value=>String(value??'').trim().toLowerCase();
  const num=value=>Number(value)||0;

  function operationalSignature(service){
    return [
      service.reservationId,
      service.sortOrder??0,
      service.serviceCatalogId||'',
      service.date||'',
      service.returnDate||'',
      service.title||service.service||service.tour||'',
      service.route||'',
      service.boarding||'',
      service.dropoff||'',
      service.startTime||service.time||'',
      service.endTime||'',
      service.vehicle||'',
      service.modality||''
    ].map(norm).join('|');
  }

  function score(service){
    let value=0;
    if(service.cloudId)value+=100;
    if(service.sourceKey)value+=80;
    if(service.serviceCatalogId)value+=40;
    if(num(service.netTotal)>0||num(service.repasseAmount)>0)value+=20;
    if(num(service.saleTotal)>0)value+=10;
    if(service.updatedAt||service.updated_at)value+=5;
    return value;
  }

  function newest(a,b){
    const ta=Date.parse(a.updatedAt||a.updated_at||'')||0;
    const tb=Date.parse(b.updatedAt||b.updated_at||'')||0;
    if(ta!==tb)return tb>ta?b:a;
    return score(b)>score(a)?b:a;
  }

  function dedupeServices(){
    const services=readServices();
    if(services.length<2)return false;

    const kept=[];
    const positions=new Map();
    let changed=false;

    for(const service of services){
      const signature=operationalSignature(service);
      if(!signature){kept.push(service);continue}
      const existingIndex=positions.get(signature);
      if(existingIndex===undefined){
        positions.set(signature,kept.length);
        kept.push(service);
        continue;
      }

      kept[existingIndex]=newest(kept[existingIndex],service);
      changed=true;
    }

    if(changed){
      kept.sort((a,b)=>String(a.reservationId).localeCompare(String(b.reservationId))||(num(a.sortOrder)-num(b.sortOrder)));
      writeServices(kept);
      window.dispatchEvent(new StorageEvent('storage',{key:SERVICES_KEY,newValue:JSON.stringify(kept)}));
    }
    return changed;
  }

  function refresh(){
    const changed=dedupeServices();
    if(changed){
      try{if(typeof window.renderDashboard==='function')window.renderDashboard()}catch(error){console.warn('Falha ao atualizar dashboard após deduplicação:',error)}
    }
  }

  const form=document.getElementById(FORM_ID);
  form?.addEventListener('submit',()=>setTimeout(refresh,1400));
  window.addEventListener('jeri:cloud-ready',()=>setTimeout(refresh,80));
  window.addEventListener('storage',event=>{
    if(event.key===SERVICES_KEY)setTimeout(()=>dedupeServices(),0);
  });

  setTimeout(refresh,120);
})();
