(function(){
  const KEY='jeri-rota-repasse-from-reservation';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const payloadRaw=sessionStorage.getItem(KEY);
  if(!payloadRaw)return;
  let payload;try{payload=JSON.parse(payloadRaw)}catch{return}
  const byId=id=>document.getElementById(id);
  const set=(id,value)=>{const el=byId(id);if(!el||value===undefined||value===null)return;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};

  function apply(){
    set('serviceDate',payload.date||'');
    set('returnDate',payload.returnDate||'');
    set('tourSelect',payload.tour||'');
    set('serviceSelect',payload.service||'');
    set('routeSelect',payload.route||'');
    set('boardingInput',payload.boarding||'');
    set('dropoffInput',payload.dropoff||'');
    set('roomInput',payload.apartment||'');
    set('namesInput',payload.client||'');
    set('phoneInput',payload.phone||'');
    set('peopleInput',payload.people??'');
    set('amountInput',payload.amount??'');
    if(typeof updatePreview==='function')updatePreview();
    const card=document.querySelector('.repasse-card .panel-head');
    if(card&&!document.getElementById('linkedReservationBadge')){
      const badge=document.createElement('span');badge.id='linkedReservationBadge';badge.className='repasse-code';badge.textContent=`Reserva ${payload.reservationCode||''}`;badge.title='Repasse vinculado a uma reserva';card.appendChild(badge);
    }
  }

  const baseFormData=typeof formData==='function'?formData:null;
  if(baseFormData){formData=function(){return{...baseFormData(),reservationId:payload.reservationId||null,reservationCode:payload.reservationCode||'',reservationServiceId:payload.serviceId||null}}}
  const baseMessage=typeof message==='function'?message:null;
  if(baseMessage){message=function(data,code){const text=baseMessage(data,code);return data?.reservationCode?text.replace(`Código: ${code}`,`Código: ${code}\nReserva: ${data.reservationCode}`):text}}

  function markServiceRepassed(){
    try{
      const items=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');
      const idx=items.findIndex(x=>String(x.id)===String(payload.serviceId));
      if(idx>=0){items[idx].repasseStatus='Repassado';items[idx].lastRepasseAt=new Date().toISOString();localStorage.setItem(SERVICES_KEY,JSON.stringify(items))}
    }catch{}
  }
  document.getElementById('repasseForm')?.addEventListener('submit',()=>setTimeout(markServiceRepassed,0));
  document.getElementById('saveWhatsappButton')?.addEventListener('click',()=>setTimeout(markServiceRepassed,0));

  setTimeout(apply,120);
  window.addEventListener('load',()=>setTimeout(apply,180),{once:true});
})();