(function(){
  const STORAGE='jeri-rota-manager-reservation-services-v1';
  const form=document.getElementById('reservationForm');
  const client=window.jeriSupabase;
  if(!form)return;
  const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'[]')}catch{return[]}};
  const write=v=>localStorage.setItem(STORAGE,JSON.stringify(v));
  const display=item=>[item?.name,item?.modality].filter(Boolean).join(' · ');
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);

  function currentReservationId(){try{return editingReservationId||null}catch{return null}}
  function savedForCard(index){const id=currentReservationId();if(!id)return null;return read().filter(x=>String(x.reservationId)===String(id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))[index]||null}
  function catalog(){return Array.isArray(window.jeriServiceCatalog)?window.jeriServiceCatalog:[]}
  function selectedItem(card){const id=card.querySelector('[data-service-catalog-select]')?.value;return catalog().find(x=>x.id===id)||null}
  function reverseItem(item){if(!item)return null;return catalog().find(x=>x.active!==false&&x.id!==item.id&&x.modality===item.modality&&x.origin&&x.destination&&item.origin&&item.destination&&x.origin.trim().toLowerCase()===item.destination.trim().toLowerCase()&&x.destination.trim().toLowerCase()===item.origin.trim().toLowerCase())||null}
  function setField(card,name,value){const input=card.querySelector(`[data-field="${name}"]`);if(!input)return;input.value=value??'';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}

  function hideLegacyFields(card,hasCatalog){
    ['tour','service','route'].forEach(field=>{const label=card.querySelector(`[data-field="${field}"]`)?.closest('label');if(label)label.classList.toggle('catalog-redundant-field',hasCatalog)});
    const repasse=card.querySelector('[data-field="repasseAmount"]')?.closest('label');if(repasse)repasse.classList.toggle('catalog-redundant-field',hasCatalog);
  }

  function roundTripCalc(item,card){
    if(!item)return 0;
    const qty=Math.max(1,Number(card.querySelector('[data-net-quantity]')?.value)||1);
    return item.pricing_basis==='fixed'?Number(item.net_value)||0:(Number(item.net_value)||0)*qty;
  }

  function refreshRoundTrip(card,index){
    const select=card.querySelector('[data-service-catalog-select]');
    const item=selectedItem(card);
    const hasCatalog=Boolean(item);
    hideLegacyFields(card,hasCatalog);
    card.classList.toggle('catalog-selected-service',hasCatalog);

    const date=card.querySelector('[data-field="date"]');
    const dateLabel=date?.closest('label');if(dateLabel&&dateLabel.dataset.roundtripRelabeled!=='1'){dateLabel.dataset.roundtripRelabeled='1';const node=[...dateLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(node)node.textContent='Data do serviço'}
    const originalReturn=card.querySelector('[data-field="returnDate"]');
    const originalReturnLabel=originalReturn?.closest('label');if(originalReturnLabel)originalReturnLabel.classList.add('roundtrip-hidden-native');

    let controls=card.querySelector('.roundtrip-controls');
    if(!controls){
      const saved=savedForCard(index);
      controls=document.createElement('div');controls.className='roundtrip-controls';
      controls.innerHTML=`<label class="roundtrip-check"><input type="checkbox" data-roundtrip-toggle> <span>Ida e volta na mesma modalidade</span></label><label class="roundtrip-date"><span>Data da volta</span><input type="date" data-roundtrip-date></label><small class="roundtrip-help">Use somente quando ida e volta forem na mesma modalidade. Se a volta for diferente, adicione outro serviço.</small><div class="roundtrip-preview" data-roundtrip-preview></div>`;
      const anchor=dateLabel||card.querySelector('.service-draft-grid')?.firstElementChild;
      anchor?.insertAdjacentElement('afterend',controls);
      const toggle=controls.querySelector('[data-roundtrip-toggle]');const rtDate=controls.querySelector('[data-roundtrip-date]');
      toggle.checked=Boolean(saved?.roundTripSameMode&&saved?.returnDate)||Boolean(originalReturn?.value);
      rtDate.value=saved?.returnDate||originalReturn?.value||'';
      toggle.addEventListener('change',()=>{if(!toggle.checked){rtDate.value='';setField(card,'returnDate','')}else setField(card,'returnDate',rtDate.value);refreshRoundTrip(card,index)});
      rtDate.addEventListener('input',()=>{setField(card,'returnDate',toggle.checked?rtDate.value:'');refreshRoundTrip(card,index)});
    }
    const toggle=controls.querySelector('[data-roundtrip-toggle]');const rtDate=controls.querySelector('[data-roundtrip-date]');
    controls.classList.toggle('available',hasCatalog);
    if(!hasCatalog){toggle.checked=false;rtDate.value='';setField(card,'returnDate','')}
    controls.classList.toggle('enabled',hasCatalog&&toggle.checked);
    const preview=controls.querySelector('[data-roundtrip-preview]');
    if(preview){
      if(hasCatalog&&toggle.checked){const reverse=reverseItem(item);const net=reverse?roundTripCalc(reverse,card):roundTripCalc(item,card);preview.innerHTML=`<strong>Volta:</strong> ${reverse?display(reverse):`mesma modalidade · ${item.destination||'destino'} → ${item.origin||'origem'}`} · NET estimado ${money(net)}`}
      else preview.textContent='';
    }
    if(select&&!select.dataset.roundtripBound){select.dataset.roundtripBound='1';select.addEventListener('change',()=>setTimeout(()=>refreshRoundTrip(card,index),0))}
  }

  function decorate(){document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft').forEach((card,index)=>refreshRoundTrip(card,index))}

  async function syncCloud(target,own){
    if(!client||!target?.reservationCode)return;
    try{
      const {data:r}=await client.from('reservations').select('id').eq('code',target.reservationCode).maybeSingle();if(!r)return;
      const {data:rows}=await client.from('reservation_services').select('id,sort_order').eq('reservation_id',r.id).order('sort_order');
      for(let i=0;i<own.length;i++){const row=rows?.[i],svc=own[i];if(!row)continue;await client.from('reservation_services').update({round_trip_same_mode:Boolean(svc.roundTripSameMode),return_date:svc.returnDate||null,return_service_catalog_id:svc.returnServiceCatalogId||null,return_service:svc.returnService||null,return_route:svc.returnRoute||null,return_repasse_amount:svc.returnRepasseAmount??null,return_repasse_status:svc.returnRepasseStatus||'Aguardando repasse',updated_at:new Date().toISOString()}).eq('id',row.id)}
    }catch(e){console.error('Falha ao sincronizar ida/volta:',e)}
  }

  form.addEventListener('submit',()=>{
    const reservationId=currentReservationId();
    const cards=[...document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft')];
    const states=cards.map((card,index)=>{const item=selectedItem(card);const toggle=card.querySelector('[data-roundtrip-toggle]');const date=card.querySelector('[data-roundtrip-date]');const reverse=reverseItem(item);return{index,item,enabled:Boolean(item&&toggle?.checked&&date?.value),returnDate:date?.value||'',reverse,returnNet:reverse?roundTripCalc(reverse,card):roundTripCalc(item,card)}});
    setTimeout(()=>{
      let target=null;try{target=reservationId?reservations.find(x=>String(x.id)===String(reservationId)):reservations[reservations.length-1]}catch{}if(!target)return;
      const all=read();const own=all.filter(x=>String(x.reservationId)===String(target.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      own.forEach((svc,i)=>{const st=states[i];if(!st)return;svc.roundTripSameMode=st.enabled;svc.returnDate=st.enabled?st.returnDate:'';svc.returnServiceCatalogId=st.enabled?(st.reverse?.id||st.item?.id||null):null;svc.returnService=st.enabled?(st.reverse?display(st.reverse):display(st.item)):'';svc.returnRoute=st.enabled?(st.reverse?.route_code||[st.item?.destination,st.item?.origin].filter(Boolean).join('-')):'';svc.returnRepasseAmount=st.enabled?st.returnNet:null;svc.returnRepasseStatus=st.enabled?(svc.returnRepasseStatus||'Aguardando repasse'):'Aguardando repasse'});
      write(all);syncCloud(target,own);
    },260);
  },true);

  const wait=setInterval(()=>{const host=document.getElementById('reservationServiceDrafts');if(!host)return;clearInterval(wait);new MutationObserver(()=>setTimeout(decorate,0)).observe(host,{childList:true});decorate();let tries=0;const retry=setInterval(()=>{tries+=1;decorate();if(tries>=30||document.querySelector('#reservationServiceDrafts [data-service-catalog-select]'))clearInterval(retry)},200)},80);
})();