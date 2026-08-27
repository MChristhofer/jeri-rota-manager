(function(){
  const client=window.jeriSupabase;
  if(!client)return;

  const KEYS={
    reservations:'jeri-rota-manager-reservas-v1',
    services:'jeri-rota-manager-reservation-services-v1',
    repasses:'jeri-rota-manager-repasses-v1',
    reservationCode:'jeri-rota-manager-reservation-code-v1',
    migration:'jeri-rota-cloud-migration-v1'
  };
  const DEMO_CLIENTS=new Set(['Marina Carvalho','João Mendes','Camila Andrade','Ricardo Oliveira','Helena Torres']);
  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const num=value=>value===null||value===undefined||value===''?null:Number(value);
  const isoDate=value=>value?String(value).slice(0,10):'';
  const reservationKey=row=>{const code=String(row?.code||row?.reservationCode||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code)return code;if(row?.legacy_id!==null&&row?.legacy_id!==undefined&&row?.legacy_id!=='')return `legacy:${row.legacy_id}`;return `id:${row?.id||''}`};
  const serviceSignature=row=>[row.title,row.service_date,row.return_date,row.tour,row.service,row.route,row.boarding,row.dropoff,row.apartment,row.responsible,Number(row.sale_total)||0].map(value=>String(value??'').trim().toLowerCase()).join('|');

  function isDemoReservation(r){
    const legacy=Number(r?.legacy_id??r?.id);
    const code=String(r?.code??r?.reservationCode??'');
    return DEMO_CLIENTS.has(String(r?.client||''))&&legacy>=1&&legacy<=5&&/^JR-0000[1-5]$/.test(code||`JR-0000${legacy}`);
  }
  function stableId(uuid,legacy){
    const n=Number(legacy);if(Number.isSafeInteger(n)&&n>0&&!([1,2,3,4,5].includes(n)))return n;
    let hash=2166136261;for(const ch of String(uuid||'')){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619)}
    return 1000000000+(Math.abs(hash>>>0)%800000000);
  }
  function normalizeLeg(value){return['single','outbound','return'].includes(value)?value:'single'}

  function localReservation(row,phones,firstService){
    const id=stableId(row.id,row.legacy_id);
    const phoneList=phones.map(p=>({phone:p.phone||'',phoneE164:p.phone_e164||'',phoneCountry:p.phone_country||'br'})).filter(p=>p.phone||p.phoneE164);
    if(!phoneList.length&&row.phone)phoneList.push({phone:row.phone,phoneE164:'',phoneCountry:'br'});
    return{
      id,
      cloudId:row.id,
      reservationCode:row.code||'',
      client:row.client||'',
      phone:phoneList[0]?.phone||row.phone||'',
      phones:phoneList,
      service:firstService?.title||firstService?.service||firstService?.tour||'',
      date:isoDate(firstService?.service_date),
      people:Number(row.people)||1,
      amount:Number(row.amount)||0,
      paidAmount:Number(row.paid_amount)||0,
      payments:Number(row.paid_amount)>0?[{id:`cloud-legacy-${row.id}`,amount:Number(row.paid_amount),receivedAt:row.updated_at||row.created_at||null,kind:'payment',source:'supabase_paid_amount'}]:[],
      collectedBy:row.collected_by||'Jeri Rota',
      status:row.status||'Pendente',
      responsible:firstService?.responsible||'Responsável a definir',
      notes:row.notes||'',
      partnerOperation:row.partner_operation||'propria',
      partner:row.partner||'',
      netAmount:Number(row.net_amount)||0,
      settledAmount:Number(row.settled_amount)||0,
      settlementDate:isoDate(row.settlement_date),
      createdAt:row.created_at||null,
      updatedAt:row.updated_at||null
    };
  }
  function localService(row,reservationLocalId){
    return{
      id:row.source_key||`cloud-${row.id}`,
      cloudId:row.id,
      sourceKey:row.source_key||null,
      reservationId:reservationLocalId,
      sortOrder:Number(row.sort_order)||0,
      title:row.title||'',
      date:isoDate(row.service_date),
      returnDate:isoDate(row.return_date),
      tour:row.tour||'',
      service:row.service||'',
      route:row.route||'',
      boarding:row.boarding||'',
      dropoff:row.dropoff||'',
      apartment:row.apartment||'',
      responsible:row.responsible||'',
      repasseAmount:num(row.repasse_amount),
      repasseStatus:row.repasse_status||'Aguardando repasse',
      serviceCatalogId:row.service_catalog_id||null,
      pricingBasis:row.pricing_basis||null,
      netUnit:num(row.net_unit),
      quantity:num(row.quantity),
      netTotal:num(row.net_total),
      saleTotal:num(row.sale_total),
      commissionTotal:num(row.commission_total),
      seller:row.seller||'',
      receivedAmount:num(row.received_amount),
      commissionAvailable:num(row.commission_available),
      commissionStatus:row.commission_status||null,
      receiptRule:row.receipt_rule||'net_first',
      roundTripSameMode:Boolean(row.round_trip_same_mode),
      returnServiceCatalogId:row.return_service_catalog_id||null,
      returnService:row.return_service||'',
      returnRoute:row.return_route||'',
      returnRepasseAmount:num(row.return_repasse_amount),
      returnRepasseStatus:row.return_repasse_status||'Aguardando repasse',
      executionMode:row.execution_mode||'undecided',
      executionPartnerName:row.execution_partner_name||'',
      executionPartnerPhone:row.execution_partner_phone||'',
      executionDecidedAt:row.execution_decided_at||null,
      returnExecutionMode:row.return_execution_mode||'undecided',
      returnExecutionPartnerName:row.return_execution_partner_name||'',
      returnExecutionPartnerPhone:row.return_execution_partner_phone||'',
      returnExecutionDecidedAt:row.return_execution_decided_at||null,
      updatedAt:row.updated_at||null
    };
  }
  function localRepasse(row,reservationMap,serviceMap){
    return{
      id:row.id,
      cloudId:row.id,
      number:Number(row.number)||0,
      code:row.code||'',
      date:isoDate(row.service_date),
      returnDate:isoDate(row.return_date),
      tour:row.tour||'',
      service:row.service||'',
      route:row.route||'',
      routeOrigin:row.route_origin||'',
      routeDestination:row.route_destination||'',
      boarding:row.boarding||'',
      dropoff:row.dropoff||'',
      apartment:row.apartment||'',
      names:row.names||'',
      people:num(row.people),
      amount:num(row.amount),
      status:row.status||'Pendente',
      reservationId:reservationMap.get(row.reservation_id)?.id||null,
      reservationCode:row.reservation_code||reservationMap.get(row.reservation_id)?.reservationCode||'',
      reservationServiceId:serviceMap.get(row.reservation_service_id)?.id||null,
      reservationLeg:normalizeLeg(row.reservation_leg),
      recipientName:row.recipient_name||'',
      recipientPhone:row.recipient_phone||'',
      createdAt:row.created_at||null,
      updatedAt:row.updated_at||null
    };
  }

  function reservationRow(r){
    return{
      ...(r.reservationCode?{code:r.reservationCode}:{}),
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
    };
  }
  function serviceRow(s,reservationId,index){
    const sourceKey=String(s.sourceKey||s.id||`service-${index}`);
    return{
      reservation_id:reservationId,source_key:sourceKey,sort_order:index,
      title:s.title||null,service_date:s.date||null,return_date:s.returnDate||null,tour:s.tour||null,service:s.service||null,route:s.route||null,
      boarding:s.boarding||null,dropoff:s.dropoff||null,apartment:s.apartment||null,responsible:s.responsible||null,repasse_amount:s.repasseAmount??null,
      repasse_status:s.repasseStatus||'Aguardando repasse',service_catalog_id:s.serviceCatalogId||null,pricing_basis:s.pricingBasis||null,net_unit:s.netUnit??null,
      quantity:s.quantity??null,net_total:s.netTotal??null,sale_total:s.saleTotal??null,commission_total:s.commissionTotal??null,seller:s.seller||null,
      received_amount:s.receivedAmount??null,commission_available:s.commissionAvailable??null,commission_status:s.commissionStatus||null,receipt_rule:s.receiptRule||'net_first',
      round_trip_same_mode:Boolean(s.roundTripSameMode),return_service_catalog_id:s.returnServiceCatalogId||null,return_service:s.returnService||null,return_route:s.returnRoute||null,
      return_repasse_amount:s.returnRepasseAmount??null,return_repasse_status:s.returnRepasseStatus||'Aguardando repasse',execution_mode:s.executionMode||'undecided',
      execution_partner_name:s.executionPartnerName||null,execution_partner_phone:s.executionPartnerPhone||null,execution_decided_at:s.executionDecidedAt||null,
      return_execution_mode:s.returnExecutionMode||'undecided',return_execution_partner_name:s.returnExecutionPartnerName||null,
      return_execution_partner_phone:s.returnExecutionPartnerPhone||null,return_execution_decided_at:s.returnExecutionDecidedAt||null,updated_at:new Date().toISOString()
    };
  }

  async function uploadLocalReservation(r,localServices){
    let result;
    const row=reservationRow(r);
    if(r.cloudId){result=await client.from('reservations').update(row).eq('id',r.cloudId).select('id,code').single()}
    else if(r.reservationCode){
      const existing=await client.from('reservations').select('id,code').eq('code',r.reservationCode).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(existing.error)throw existing.error;
      result=existing.data
        ?await client.from('reservations').update(row).eq('id',existing.data.id).select('id,code').single()
        :await client.from('reservations').insert(row).select('id,code').single();
    }else{delete row.code;result=await client.from('reservations').insert(row).select('id,code').single()}
    if(result.error)throw result.error;
    r.cloudId=result.data.id;r.reservationCode=result.data.code||r.reservationCode||'';
    const svcs=localServices.filter(s=>String(s.reservationId)===String(r.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
    if(svcs.length){
      for(let i=0;i<svcs.length;i++){
        const row=serviceRow(svcs[i],result.data.id,i);
        const up=await client.from('reservation_services').upsert(row,{onConflict:'reservation_id,source_key'}).select('id,source_key').single();
        if(up.error)throw up.error;svcs[i].cloudId=up.data.id;svcs[i].sourceKey=up.data.source_key;
      }
    }
    await client.from('reservation_phones').delete().eq('reservation_id',result.data.id);
    const phones=Array.isArray(r.phones)?r.phones:[];
    if(phones.length){
      const ins=await client.from('reservation_phones').insert(phones.map((p,i)=>({reservation_id:result.data.id,phone:p.phone||null,phone_e164:p.phoneE164||null,phone_country:p.phoneCountry||null,sort_order:i})));
      if(ins.error)throw ins.error;
    }
    return result.data;
  }

  async function migrateUnsyncedLocal(){
    const localReservations=read(KEYS.reservations).filter(r=>!isDemoReservation(r));
    if(!localReservations.length)return;
    const localServices=read(KEYS.services);
    const {data:cloudRows,error}=await client.from('reservations').select('id,code,client,legacy_id');if(error)throw error;
    const realCloud=(cloudRows||[]).filter(r=>!isDemoReservation(r));
    const codes=new Set(realCloud.map(r=>r.code).filter(Boolean));
    const missing=localReservations.filter(r=>!r.reservationCode||!codes.has(r.reservationCode));
    if(!missing.length)return;
    for(const reservation of missing)await uploadLocalReservation(reservation,localServices);
    write(KEYS.reservations,localReservations);
    write(KEYS.services,localServices.filter(s=>localReservations.some(r=>String(r.id)===String(s.reservationId))));
  }

  async function fetchAndCache(){
    const [rRes,sRes,pRes,repRes]=await Promise.all([
      client.from('reservations').select('*').order('created_at',{ascending:true}),
      client.from('reservation_services').select('*').order('reservation_id').order('sort_order'),
      client.from('reservation_phones').select('*').order('reservation_id').order('sort_order'),
      client.from('repasses').select('*').order('created_at',{ascending:true})
    ]);
    for(const result of [rRes,sRes,pRes,repRes])if(result.error)throw result.error;
    const uniqueRows=new Map();
    (rRes.data||[]).filter(r=>!isDemoReservation(r)).forEach(row=>{
      const key=reservationKey(row);const current=uniqueRows.get(key);
      if(!current||String(row.updated_at||row.created_at||'')>String(current.updated_at||current.created_at||''))uniqueRows.set(key,row);
    });
    const reservationRows=[...uniqueRows.values()];
    const validIds=new Set(reservationRows.map(r=>r.id));
    const uniqueServices=new Map();
    (sRes.data||[]).filter(s=>validIds.has(s.reservation_id)).forEach(row=>{
      const key=`${row.reservation_id}|${serviceSignature(row)}`;const current=uniqueServices.get(key);
      if(!current||String(row.updated_at||'')>String(current.updated_at||''))uniqueServices.set(key,row);
    });
    const serviceRows=[...uniqueServices.values()];
    const phoneRows=(pRes.data||[]).filter(p=>validIds.has(p.reservation_id));
    const servicesByReservation=new Map();serviceRows.forEach(s=>{if(!servicesByReservation.has(s.reservation_id))servicesByReservation.set(s.reservation_id,[]);servicesByReservation.get(s.reservation_id).push(s)});
    const phonesByReservation=new Map();phoneRows.forEach(p=>{if(!phonesByReservation.has(p.reservation_id))phonesByReservation.set(p.reservation_id,[]);phonesByReservation.get(p.reservation_id).push(p)});
    const reservationMap=new Map();
    const localReservations=reservationRows.map(row=>{const linkedServices=servicesByReservation.get(row.id)||[];const r=localReservation(row,phonesByReservation.get(row.id)||[],linkedServices[0]);if(linkedServices.length)r.amount=linkedServices.reduce((sum,service)=>sum+(Number(service.sale_total)||0),0);r.paidAmount=Math.min(r.paidAmount,r.amount);reservationMap.set(row.id,r);return r});
    const cachedReservations=read(KEYS.reservations);const cachedByCode=new Map(cachedReservations.filter(r=>r.reservationCode).map(r=>[r.reservationCode,r]));const cachedByCloudId=new Map(cachedReservations.filter(r=>r.cloudId).map(r=>[r.cloudId,r]));
    localReservations.forEach(reservation=>{const cached=cachedByCloudId.get(reservation.cloudId)||cachedByCode.get(reservation.reservationCode);if(!Array.isArray(cached?.payments)||!cached.payments.length)return;const cachedTotal=cached.payments.reduce((sum,payment)=>sum+(Number(payment.amount)||0),0);if(Math.abs(cachedTotal-reservation.paidAmount)<0.01)reservation.payments=cached.payments});
    const serviceMap=new Map();const localServices=[];
    serviceRows.forEach(row=>{const r=reservationMap.get(row.reservation_id);if(!r)return;const s=localService(row,r.id);serviceMap.set(row.id,s);localServices.push(s)});
    const localRepasses=(repRes.data||[]).filter(x=>!x.reservation_id||validIds.has(x.reservation_id)).map(row=>localRepasse(row,reservationMap,serviceMap));
    write(KEYS.reservations,localReservations);write(KEYS.services,localServices);write(KEYS.repasses,localRepasses);
    const maxCode=localReservations.reduce((m,r)=>Math.max(m,Number(String(r.reservationCode||'').replace(/\D/g,''))||0),0);localStorage.setItem(KEYS.reservationCode,String(maxCode));
    try{reservations=localReservations}catch{}
    if(typeof window.renderAll==='function')window.renderAll();else try{if(typeof renderAll==='function')renderAll()}catch{}
    window.JERI_CLOUD_READY=true;window.dispatchEvent(new CustomEvent('jeri:cloud-ready',{detail:{reservations:localReservations.length,services:localServices.length,repasses:localRepasses.length}}));
    return{reservations:localReservations,services:localServices,repasses:localRepasses};
  }

  async function refresh(){
    await migrateUnsyncedLocal();
    const data=await fetchAndCache();
    localStorage.setItem(KEYS.migration,'1');
    return data;
  }

  async function deleteReservation(snapshot){
    if(!snapshot)return;
    if(snapshot.cloudId){const {error}=await client.from('reservations').delete().eq('id',snapshot.cloudId);if(error)throw error;return}
    if(snapshot.reservationCode){const {error}=await client.from('reservations').delete().eq('code',snapshot.reservationCode);if(error)throw error}
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-delete]');if(!button)return;
    const id=Number(button.dataset.delete);let snapshot=null;try{snapshot=reservations.find(r=>Number(r.id)===id)}catch{snapshot=read(KEYS.reservations).find(r=>Number(r.id)===id)}
    if(!snapshot)return;
    setTimeout(()=>{
      let exists=false;try{exists=reservations.some(r=>Number(r.id)===id)}catch{exists=read(KEYS.reservations).some(r=>Number(r.id)===id)}
      if(!exists)deleteReservation(snapshot).catch(error=>console.error('Falha ao excluir reserva no Supabase:',error));
    },250);
  },true);

  window.JeriCloudData={refresh,fetchAndCache,deleteReservation};
})();
