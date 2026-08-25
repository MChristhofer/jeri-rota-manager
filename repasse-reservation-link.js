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

  async function linkCloud(){
    try{
      if(!window.supabase||!payload.reservationCode)return;
      const cloud=window.supabase.createClient('https://euqixdlpkjajhigqwhvi.supabase.co','sb_publishable_D9hnQLDMekew4_jZWXa2BA_G3UF9TIP',{auth:{persistSession:true,autoRefreshToken:true}});
      const {data:{user}}=await cloud.auth.getUser();if(!user)return;
      const {data:reservation}=await cloud.from('reservations').select('id,code').eq('code',payload.reservationCode).maybeSingle();
      if(!reservation)return;
      let serviceQuery=cloud.from('reservation_services').select('id,title,service,service_date').eq('reservation_id',reservation.id);
      if(payload.date)serviceQuery=serviceQuery.eq('service_date',payload.date);
      const {data:services}=await serviceQuery;
      const service=(services||[]).find(s=>s.service===payload.service||s.title===payload.service)||(services||[])[0]||null;
      const reps=typeof getRepasses==='function'?getRepasses():[];
      const local=[...reps].reverse().find(x=>x.reservationCode===payload.reservationCode||x.reservationServiceId===payload.serviceId);
      if(local?.code){
        await cloud.from('repasses').update({reservation_id:reservation.id,reservation_service_id:service?.id||null,reservation_code:payload.reservationCode}).eq('code',local.code);
      }
      if(service?.id)await cloud.from('reservation_services').update({repasse_status:'Repassado',updated_at:new Date().toISOString()}).eq('id',service.id);
    }catch(err){console.error('Não foi possível vincular o repasse à reserva no banco:',err)}
  }

  function afterSave(){markServiceRepassed();setTimeout(linkCloud,900)}
  document.getElementById('repasseForm')?.addEventListener('submit',()=>setTimeout(afterSave,0));
  document.getElementById('saveWhatsappButton')?.addEventListener('click',()=>setTimeout(afterSave,0));

  setTimeout(apply,160);
  window.addEventListener('load',()=>setTimeout(apply,220),{once:true});
})();