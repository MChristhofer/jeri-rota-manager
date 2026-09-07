const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../finance-rules.js');
const cases=[[400,400,100,300,100],[400,400,400,0,400],[1000,400,100,900,0],[1000,400,800,200,200],[1000,400,1000,0,400]];
cases.forEach(([sale,net,received,balance,cover],i)=>test(`Caso ${i+1}: saldo ${balance}; empresa cobre ${cover}`,()=>{
  assert.deepEqual(F.reservation(sale,received,[net]),{netTotal:net,balance,companyCover:cover});
  const rows=F.commitments([{id:1,amount:sale,paidAmount:received}],[{reservationId:1,repasseAmount:net,date:'2026-09-07'}]);
  assert.equal(F.total(rows.map(r=>r.companyCover)),cover);
  assert.equal(F.total(rows.map(r=>r.net)),net);
}));
test('Modalidade determina NET para qualquer veículo e quantidade',()=>{
  for(const vehicle of ['Ônibus','Micro-ônibus','Hilux'])for(const people of [1,2,4]){
    assert.equal(F.serviceNet(80,'Compartilhado',people),80*people,vehicle);
    for(const mode of ['Privativo','Carro fechado','Fechado'])assert.equal(F.serviceNet(400,mode,people),400,vehicle);
  }
});
test('Soma 160 + 200 + 400 = 760; decimais em centavos',()=>{
  assert.equal(F.total([160,200,400]),760);
  assert.equal(F.total(['0,10','0,20']),0.3);
});
test('Zero explícito preservado; fallback somente se ausente; privativo legado',()=>{
  assert.equal(F.storedNet({repasseAmount:0,netTotal:400,netUnit:400}),0);
  assert.equal(F.storedNet({netTotal:400}),400);
  assert.equal(F.storedNet({netUnit:400,quantity:4,modality:'Privativo'}),400);
  assert.equal(F.storedNet({netUnit:80,quantity:4,responsible:'JR_OP_V1:'+encodeURIComponent(JSON.stringify({modality:'Compartilhado'}))}),320);
});
test('Saldo usado uma vez; meses conservam soma da reserva e NET já pago',()=>{
  const rows=F.commitments([{id:1,amount:1000,paidAmount:800}],[
    {id:'b',reservationId:1,repasseAmount:300,date:'2026-10-01'},
    {id:'a',reservationId:1,repasseAmount:100,date:'2026-09-01',repasseStatus:'Pago'}
  ]);
  assert.deepEqual(rows.map(r=>[r.operationalDate,r.net,r.companyCover]),[['2026-09-01',100,0],['2026-10-01',300,200]]);
  assert.equal(F.total(rows.map(r=>r.companyCover)),F.reservation(1000,800,[100,300]).companyCover);
});
test('Reservas não compartilham saldo; excesso recebido não gera saldo negativo',()=>{
  const rows=F.commitments([{id:1,amount:1000,paidAmount:0},{id:2,amount:400,paidAmount:500}],[{reservationId:1,netTotal:400},{reservationId:2,netTotal:400}]);
  assert.deepEqual(rows.map(r=>r.companyCover),[0,400]);
});
