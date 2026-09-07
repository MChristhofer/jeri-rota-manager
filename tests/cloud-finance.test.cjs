const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R='jeri-rota-manager-reservas-v1',S='jeri-rota-manager-reservation-services-v1';
function environment(tables){
  const calls=[],cache=new Map();
  const context={console,setTimeout,CustomEvent:class{},document:{addEventListener(){},getElementById(){return{addEventListener(){}}}},localStorage:{getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)}};
  context.window={dispatchEvent(){},jeriSupabase:{from(table){
    let op='select',payload;
    const q={select(){return q},order(){return q},eq(){return q},limit(){return q},
      update(row){op='update';payload=row;calls.push({table,op,payload});return q},
      insert(row){op='insert';payload=row;calls.push({table,op,payload});return q},
      upsert(row){op='upsert';payload=row;calls.push({table,op,payload});return q},
      delete(){op='delete';calls.push({table,op});return q},
      single(){return Promise.resolve({data:table==='reservations'?{id:'cloud-reservation',code:'JR-00001'}:{id:'cloud-'+payload.source_key,source_key:payload.source_key},error:null})},
      maybeSingle(){return q.single()},
      then(resolve){return Promise.resolve({data:op==='select'?(tables[table]||[]):[],error:null}).then(resolve)}};
    return q;
  }}};
  vm.createContext(context);
  const load=name=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),context);
  return{context,calls,cache,load};
}
test('Leitura Supabase preserva venda, recebido, NET zero e serviços idênticos distintos',async()=>{
  const e=environment({reservations:[{id:'cloud-reservation',code:'JR-00001',client:'Teste',amount:1000,paid_amount:800}],reservation_services:[
    {id:'a',source_key:'a',reservation_id:'cloud-reservation',title:'Transfer',sale_total:0,repasse_amount:0,net_total:400},
    {id:'b',source_key:'b',reservation_id:'cloud-reservation',title:'Transfer',sale_total:0,repasse_amount:400,net_total:400}
  ]});
  e.load('cloud-data-sync.js');
  const result=await e.context.window.JeriCloudData.fetchAndCache();
  assert.equal(result.reservations[0].amount,1000);assert.equal(result.reservations[0].paidAmount,800);
  assert.equal(result.services.length,2);assert.equal(result.services[0].repasseAmount,0);assert.equal(result.services[1].repasseAmount,400);
});
test('Escrita Supabase envia NET e metadados corretos, sem excluir duplicação nem recalcular venda',async()=>{
  const e=environment({reservation_services:[{id:'cloud-a',source_key:'a'},{id:'cloud-b',source_key:'b'}]});
  const reservation={id:1,cloudId:'cloud-reservation',reservationCode:'JR-00001',amount:1000,paidAmount:800};
  const service={reservationId:1,title:'Transfer',repasseAmount:400,netTotal:400,saleTotal:0,boarding:'Hotel A',dropoff:'Hotel B',date:'2026-09-10',returnDate:'2026-09-11',responsible:'JR_OP_V1:'+encodeURIComponent(JSON.stringify({modality:'Privativo',startTime:'09:15',vehicle:'Hilux'}))};
  e.cache.set(R,JSON.stringify([reservation]));e.cache.set(S,JSON.stringify([{...service,id:'a'},{...service,id:'b'}]));
  e.load('cloud-write-sync.js');await e.context.window.JeriCloudWrite.syncReservation(reservation);
  const rows=e.calls.filter(c=>c.table==='reservation_services'&&c.op==='upsert').map(c=>c.payload);
  assert.equal(rows.length,2);assert.equal(rows[0].net_total,400);assert.equal(rows[0].repasse_amount,400);
  assert.equal(rows[1].source_key,'b');assert.equal(rows[1].boarding,'Hotel A');assert.equal(rows[1].return_date,'2026-09-11');
  assert.equal(rows[1].responsible,service.responsible);
  assert.equal(e.calls.filter(c=>c.table==='reservation_services'&&c.op==='delete').length,0);
  assert.equal(reservation.amount,1000);assert.equal(reservation.paidAmount,800);
  assert.equal(e.calls.find(c=>c.table==='reservations').payload.amount,1000);
});
