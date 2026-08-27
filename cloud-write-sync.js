(function(){
  const client=window.jeriSupabase;
  const form=document.getElementById('reservationForm');
  if(!client||!form)return;

  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const normalizeRepasseStatus=value=>{
    const status=String(value||'').trim().toLowerCase();
    if(['pago','quitado','realizado'].includes(status))return'Realizado';
    if(status==='repassado')return'Repassado';
    if(status==='cancelado')return'Cancelado';
    return'Aguardando repasse';
  };

  const rowReservation=r=>({
    code:r.reservationCode||null,
    legacy_id:Number.isSafeInteger(Number(r.id))?Number(r.id):null,
    client:r.client||null,
    phone:r.phone||null,
    people:Number(r.people)||1,
    amount:Number(r.amount)||0,
    paid_amount:Number(r.paidAmount)||0,
    collected_by:r.collectedBy||null,
    status:r.status||'Pendente',
    notes:r.notes||null,
    partner_operation:r.partnerOperation||'propria',
    partner:r.partner||null,
    net_amount:Number(r.netAmount)||0,
    settled_amount:Number(r.settledAmount)||0,
    settlement_date:r.settlementDate||null,
    updated_at:new Date().toISOString()
  });

  const rowService=(s,reservationId,index)=>({
    reservation_id:reservationId,
    source_key:String(s.sourceKey||s.id||`service-${index}`),
    sort_order:index,
    title:s.title||null,
    service_date:s.date||null,
    return_date:s.returnDate||null,
    tour:s.tour||null,
    service:s.service||null,
    route:s.route||null,
    boarding:s.boarding||null,
    dropoff:s.dropoff||null,
    apartment:s.apartment||null,
    responsible:s.responsible||null,
    repasse_amount:s.repasseAmount??null,
    repasse_status:normalizeRepasseStatus(s.repasseStatus),
    service_catalog_id:s.serviceCatalogId||null,
    pricing_basis:s.pricingBasis||null,
    net_unit:s.netUnit??null,
    quantity:s.quantity??null,
    net_total:s.netTotal??null,
    sale_total:s.saleTotal??null,
    commission_total:s.commissionTotal??null,
    seller:s.seller||null,
    received_amount:s.receivedAmount??null,
    commission_available:s.commissionAvailable??null,
    commission_status:s.commissionStatus||null,
    receipt_rule:s.receiptRule||'net_first',
    round_trip_same_mode:Boolean(s.roundTripSameMode),
    return_service_catalog_id:s.returnServiceCatalogId||null,
    return_service:s.returnService||null,
    return_route:s.returnRoute||null,
    return_repasse_amount:s.returnRepasseAmount??null,
    return_repasse_status:normalizeRepasseStatus(s.returnRepasseStatus),
    execution_mode:s.executionMode||'undecided',
    execution_partner_name:s.executionPartnerName||null,
    execution_partner_phone:s.executionPartnerPhone||null,
    execution_decided_at:s.executionDecidedAt||null,
    return_execution_mode:s.returnExecutionMode||'undecided',
    return_execution_partner_name:s.returnExecutionPartnerName||null,
    return_execution_partner_phone:s.returnExecutionPartnerPhone||null,
    return_execution_decided_at:s.returnExecutionDecidedAt||null,
    updated_at:new Date().toISOString()
  });

  async function syncReservation(r){
    if(!r)return;
    const row=rowReservation(r);
    let result;
    if(r.cloudId){
      result=await client.from('reservations').update(row).eq('id',r.cloudId).select('id,code').single();
    }else if(row.code){
      const existing=await client.from('reservations').select('id,code').eq('code',row.code).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(existing.error)throw existing.error;
      result=existing.data
        ?await client.from('reservations').update(row).eq('id',existing.data.id).select('id,code').single()
        :await client.from('reservations').insert(row).select('id,code').single();
    }else{
      delete row.code;result=await client.from('reservations').insert(row).select('id,code').single();
    }
    if(result.error)throw result.error;

    r.cloudId=result.data.id;
    if(result.data.code)r.reservationCode=result.data.code;

    const allServices=read(SERVICES_KEY);const seenServices=new Set();
    const localServices=allServices.filter(s=>String(s.reservationId)===String(r.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).filter(service=>{const key=[service.title,service.date,service.returnDate,service.tour,service.service,service.route,service.boarding,service.dropoff,service.apartment,service.responsible,Number(service.saleTotal)||0].map(value=>String(value??'').trim().toLowerCase()).join('|');if(seenServices.has(key))return false;seenServices.add(key);return true});
    if(localServices.length){r.amount=localServices.reduce((sum,service)=>sum+(Number(service.saleTotal)||0),0);r.paidAmount=Math.min(Number(r.paidAmount)||0,r.amount);row.amount=r.amount;row.paid_amount=r.paidAmount}
    const sourceKeys=[];
    for(let i=0;i<localServices.length;i++){
      const payload=rowService(localServices[i],result.data.id,i);
      sourceKeys.push(payload.source_key);
      const saved=await client.from('reservation_services').upsert(payload,{onConflict:'reservation_id,source_key'}).select('id,source_key').single();
      if(saved.error)throw saved.error;
      localServices[i].cloudId=saved.data.id;
      localServices[i].sourceKey=saved.data.source_key;
      localServices[i].repasseStatus=payload.repasse_status;
      if(localServices[i].returnRepasseStatus!==undefined)localServices[i].returnRepasseStatus=payload.return_repasse_status;
    }

    const {data:cloudServices,error:cloudServicesError}=await client.from('reservation_services').select('id,source_key').eq('reservation_id',result.data.id);
    if(cloudServicesError)throw cloudServicesError;
    for(const old of cloudServices||[]){
      if(!old.source_key||!sourceKeys.includes(old.source_key)){
        const del=await client.from('reservation_services').delete().eq('id',old.id);
        if(del.error)throw del.error;
      }
    }

    const phoneDelete=await client.from('reservation_phones').delete().eq('reservation_id',result.data.id);
    if(phoneDelete.error)throw phoneDelete.error;
    const phones=Array.isArray(r.phones)&&r.phones.length?r.phones:(r.phone?[{phone:r.phone,phoneE164:'',phoneCountry:'br'}]:[]);
    if(phones.length){
      const phoneInsert=await client.from('reservation_phones').insert(phones.map((p,i)=>({reservation_id:result.data.id,phone:p.phone||null,phone_e164:p.phoneE164||null,phone_country:p.phoneCountry||null,sort_order:i})));
      if(phoneInsert.error)throw phoneInsert.error;
    }

    const currentReservations=read(RESERVATIONS_KEY);
    const ri=currentReservations.findIndex(x=>String(x.id)===String(r.id));
    if(ri>=0){currentReservations[ri]={...currentReservations[ri],cloudId:r.cloudId,reservationCode:r.reservationCode};localStorage.setItem(RESERVATIONS_KEY,JSON.stringify(currentReservations))}
    const currentServices=read(SERVICES_KEY);
    localServices.forEach(local=>{const i=currentServices.findIndex(x=>String(x.id)===String(local.id));if(i>=0)currentServices[i]={...currentServices[i],cloudId:local.cloudId,sourceKey:local.sourceKey,repasseStatus:local.repasseStatus,returnRepasseStatus:local.returnRepasseStatus}});
    localStorage.setItem(SERVICES_KEY,JSON.stringify(currentServices));
  }

  function findJustSaved(){
    const list=read(RESERVATIONS_KEY);
    let editing=null;
    try{editing=typeof editingReservationId!=='undefined'?editingReservationId:null}catch{}
    if(editing!==null&&editing!==undefined){const found=list.find(r=>String(r.id)===String(editing));if(found)return found}
    return list[list.length-1]||null;
  }

  async function reconcileAll(){
    const list=read(RESERVATIONS_KEY);
    for(const reservation of list)await syncReservation(reservation);
    if(window.JeriCloudData?.fetchAndCache)await window.JeriCloudData.fetchAndCache();
  }

  form.addEventListener('submit',()=>{
    setTimeout(async()=>{
      const reservation=findJustSaved();if(!reservation)return;
      try{await syncReservation(reservation);if(window.JeriCloudData?.fetchAndCache)await window.JeriCloudData.fetchAndCache()}
      catch(error){console.error('Falha ao salvar reserva no Supabase:',error);alert('A reserva ficou salva neste navegador, mas não foi possível sincronizar com o banco. Verifique a conexão antes de fechar o sistema.')}
    },900);
  });

  setTimeout(()=>reconcileAll().catch(error=>console.error('Falha na reconciliação inicial com o Supabase:',error)),2500);
  window.JeriCloudWrite={syncReservation,reconcileAll};
})();
