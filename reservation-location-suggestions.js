(function(){
  const byId=id=>document.getElementById(id);
  const STYLE_ID='reservationLocationToolsStyle';

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
    byId('reservationLocationSuggestions')?.remove();
    document.querySelectorAll('#reservationServiceDrafts [data-point-field="location"]').forEach(input=>input.removeAttribute('list'));
  }

  function enhanceInput(input,kind){
    if(!input)return;
    input.removeAttribute('list');
    input.setAttribute('autocomplete','off');
    input.placeholder=kind==='boarding'?'Digite hotel, aeroporto ou ponto de embarque':'Digite hotel, aeroporto ou ponto de desembarque';

    const label=input.closest('label');
    if(!label)return;

    label.querySelectorAll('.reservation-location-help').forEach(item=>item.remove());

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
        if(!url)return;
        window.open(url,'_blank','noopener,noreferrer');
      });
    }

    let help=tools.querySelector('.reservation-location-help');
    if(!help){
      help=document.createElement('small');
      help.className='reservation-location-help';
      help.textContent='Este local será salvo somente nesta reserva.';
      tools.appendChild(help);
    }

    const updateState=()=>{
      const hasLocation=Boolean(String(input.value||'').trim());
      button.disabled=!hasLocation;
      button.setAttribute('aria-disabled',String(!hasLocation));
      button.title=hasLocation?'Abrir este local em uma nova aba do Google Maps':'Preencha o local primeiro';
    };

    if(input.dataset.mapsListener!=='true'){
      input.dataset.mapsListener='true';
      input.addEventListener('input',updateState);
      input.addEventListener('change',updateState);
    }
    updateState();
  }

  function enhanceAll(){
    ensureStyles();
    removeGlobalLocationManager();
    removeLegacySuggestions();
    document.querySelectorAll('#reservationServiceDrafts [data-point-kind="boarding"] [data-point-field="location"]').forEach(input=>enhanceInput(input,'boarding'));
    document.querySelectorAll('#reservationServiceDrafts [data-point-kind="dropoff"] [data-point-field="location"]').forEach(input=>enhanceInput(input,'dropoff'));
  }

  const observer=new MutationObserver(()=>enhanceAll());
  observer.observe(document.body,{childList:true,subtree:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceAll,{once:true});
  else enhanceAll();
})();
