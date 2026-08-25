(function(){
  const KEY='jeri-rota-repasse-from-reservation';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const payloadRaw=sessionStorage.getItem(KEY);
  if(!payloadRaw)return;
  let payload;try{payload=JSON.parse(payloadRaw)}catch{return}
  const byId=id=>document.getElementById(id);
  const leg=payload.reservationLeg||'single';
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
      const badge=document.createElement('span');badge.id='linkedReservationBadge';badge.className='repasse-code';badge.textContent=`Reserva ${payload.reservationCode||''}${leg==='return'?' · VOLTA':leg==='outbound'?' · IDA':''}`;badge.title='Repasse vinculado a uma reserva';card.appendChild(badge);
    }
  }

  const baseFormData=typeof formData==='function'?formData:null;
  if(baseFormData){formData=function(){return{...baseFormData(),reservationId:payload.reservationId||null,reservationCode:payload.reservationCode||'',reservationServiceId:payload.serviceId||null,reservationLeg:leg}}}
  const baseMessage=typeof message==='function'?message:null;
  if(baseMessage){message=function(data,code){const text=baseMessage(data,code);if(!data?.reservationCode)return text;const suffix=data.reservationLeg==='return'?' · Volta':data.reservationLeg==='outbound'?' · Ida':'';return text.replace(`Código: ${code}`,`Código: ${code}\nReserva: ${data.reservationCode}${suffix}`)}}

  function markServiceRepassed(){
    try{
      const items=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');
      const idx=items.findIndex(x=>String(x.id)===String(payload.serviceId));
      if(idx>=0){
        if(leg==='return'){items[idx].returnRepasseStatus='Repassado';items[idx].lastReturnRepasseAt=new Date().toISOString()}
        else{items[idx].repasseStatus='Repassado';items[idx].lastRepasseAt=new Date().toISOString()}
        localStorage.setItem(SERVICES_KEY,JSON.stringify(items));
      }
    }catch{}
  }

  async function linkCloud(){
    try{
      if(!window.supabase||!payload.reservationCode)return;
      const cloud=window.supabase.createClient('https://euqixdlpkjajhigqwhvi.supabase.co','sb_publishable_D9hnQLDMekew4_jZWXa2BA_G3UF9TIP',{auth:{persistSession:true,autoRefreshToken:true}});
      const {data:{user}}=await cloud.auth.getUser();if(!user)return;
      const {data:reservation}=await cloud.from('reservations').select('id,code').eq('code',payload.reservationCode).maybeSingle();
      if(!reservation)return;
      let serviceQuery=cloud.from('reservation_services').select('id,title,service,service_date,return_date').eq('reservation_id',reservation.id);
      if(leg==='return'&&payload.date)serviceQuery=serviceQuery.eq('return_date',payload.date);
      else if(payload.date)serviceQuery=serviceQuery.eq('service_date',payload.date);
      const {data:services}=await serviceQuery;
      const service=(services||[]).find(s=>s.service===payload.service||s.title===payload.service)||(services||[])[0]||null;
      const reps=typeof getRepasses==='function'?getRepasses():[];
      const local=[...reps].reverse().find(x=>x.reservationCode===payload.reservationCode&&((x.reservationLeg||'single')===leg||!x.reservationLeg))||[...reps].reverse().find(x=>x.reservationServiceId===payload.serviceId);
      if(local?.code){
        await cloud.from('repasses').update({reservation_id:reservation.id,reservation_service_id:service?.id||null,reservation_code:payload.reservationCode,reservation_leg:leg}).eq('code',local.code);
      }
      if(service?.id){
        const update=leg==='return'?{return_repasse_status:'Repassado',updated_at:new Date().toISOString()}:{repasse_status:'Repassado',updated_at:new Date().toISOString()};
        await cloud.from('reservation_services').update(update).eq('id',service.id);
      }
    }catch(err){console.error('Não foi possível vincular o repasse à reserva no banco:',err)}
  }

  function tagLatestLocalRepasse(){
    try{
      const items=typeof getRepasses==='function'?getRepasses():JSON.parse(localStorage.getItem('jeri-rota-manager-repasses-v1')||'[]');
      const matches=items.filter(x=>x.reservationCode===payload.reservationCode||String(x.reservationServiceId||'')===String(payload.serviceId));
      const latest=matches.sort((a,b)=>Number(b.number||0)-Number(a.number||0))[0];if(!latest)return;
      latest.reservationLeg=leg;latest.reservationServiceId=payload.serviceId||latest.reservationServiceId||null;latest.reservationCode=payload.reservationCode||latest.reservationCode||'';
      localStorage.setItem('jeri-rota-manager-repasses-v1',JSON.stringify(items));
    }catch{}
  }

  function afterSave(){setTimeout(()=>{tagLatestLocalRepasse();markServiceRepassed();setTimeout(linkCloud,900)},40)}
  document.getElementById('repasseForm')?.addEventListener('submit',afterSave);
  document.getElementById('saveWhatsappButton')?.addEventListener('click',afterSave);

  setTimeout(apply,160);
  window.addEventListener('load',()=>setTimeout(apply,220),{once:true});
})();