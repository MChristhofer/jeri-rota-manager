(function(){
  const client=window.jeriSupabase;
  const LOCATION_KEY='jeri-rota-manager-locais-v1';
  const byId=id=>document.getElementById(id);
  let cloudLocations=[];

  function localLocations(){
    try{
      const items=JSON.parse(localStorage.getItem(LOCATION_KEY)||'[]');
      return Array.isArray(items)?items:[];
    }catch{return[]}
  }

  function normalize(item){
    if(!item)return null;
    if(typeof item==='string')return{name:item,type:'',address:''};
    const name=String(item.name||'').trim();
    if(!name)return null;
    return{name,type:String(item.type||'').trim(),address:String(item.address||'').trim()};
  }

  function allLocations(){
    const map=new Map();
    [...localLocations(),...cloudLocations].map(normalize).filter(Boolean).forEach(item=>{
      const key=item.name.toLocaleLowerCase('pt-BR');
      const current=map.get(key);
      if(!current||(!current.address&&item.address))map.set(key,item);
    });
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  }

  function renderDatalist(){
    let list=byId('reservationLocationSuggestions');
    if(!list){
      list=document.createElement('datalist');
      list.id='reservationLocationSuggestions';
      document.body.appendChild(list);
    }
    list.innerHTML='';
    allLocations().forEach(item=>{
      const option=document.createElement('option');
      option.value=item.name;
      option.textContent=[item.type,item.address].filter(Boolean).join(' · ');
      list.appendChild(option);
    });
  }

  function enhanceInput(input,kind){
    if(!input)return;
    input.setAttribute('list','reservationLocationSuggestions');
    input.setAttribute('autocomplete','off');
    input.placeholder=kind==='boarding'?'Digite hotel, aeroporto ou ponto de embarque':'Digite hotel, aeroporto ou ponto de desembarque';
    const label=input.closest('label');
    if(label&&!label.querySelector(`.reservation-location-help[data-kind="${kind}"]`)){
      const help=document.createElement('small');
      help.className='reservation-form-help reservation-location-help';
      help.dataset.kind=kind;
      help.textContent='Digite livremente. Os locais cadastrados aparecem apenas como sugestões.';
      label.appendChild(help);
    }
  }

  function enhanceAll(){
    renderDatalist();
    document.querySelectorAll('#reservationServiceDrafts [data-field="boarding"]').forEach(input=>enhanceInput(input,'boarding'));
    document.querySelectorAll('#reservationServiceDrafts [data-field="dropoff"]').forEach(input=>enhanceInput(input,'dropoff'));
  }

  async function loadCloudLocations(){
    if(!client){enhanceAll();return}
    try{
      const {data,error}=await client.from('locations').select('name,type,address').order('name');
      if(error)throw error;
      cloudLocations=data||[];
    }catch(error){
      console.warn('Não foi possível carregar sugestões de locais do Supabase:',error);
    }
    enhanceAll();
  }

  const wait=setInterval(()=>{
    const host=byId('reservationServiceDrafts');
    if(!host)return;
    clearInterval(wait);
    new MutationObserver(enhanceAll).observe(host,{childList:true,subtree:true});
    loadCloudLocations();
  },80);

  window.addEventListener('storage',event=>{
    if(event.key===LOCATION_KEY)enhanceAll();
  });
})();
