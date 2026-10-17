const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const KEY='jeri-rota-manager-reservas-v1';
const script=fs.readFileSync(path.join(__dirname,'..','clients-section.js'),'utf8');

function load(reservations,ready=true){
  const nodes={};
  ['clientes','clientSearch','clientsList','clientsTotal','clientsCount'].forEach(id=>{
    nodes[id]={id,value:'',innerHTML:'',textContent:'',listeners:{},
      addEventListener(event,callback){this.listeners[event]=callback}};
  });
  const saved=new Map([[KEY,JSON.stringify(reservations)]]);
  const events={};
  const context={
    console:{warn(){}},
    navigator:{},
    localStorage:{getItem:key=>saved.get(key)||null},
    window:{JERI_CLOUD_READY:ready,setTimeout(){},
      addEventListener(event,callback){events[event]=callback}},
    document:{getElementById:id=>nodes[id]||null}
  };
  vm.runInNewContext(script,context,{filename:'clients-section.js'});
  return{nodes,events,context,clients:context.window.JeriClients};
}

test('inclui finalizados e confirmados com sinal; exclui pendentes e cancelados',()=>{
  const app=load([
    {id:1,client:'Ana',phone:'85999990000',status:'Confirmada',paidAmount:50},
    {id:2,client:'Beto',phone:'85999990001',status:'Finalizada',paidAmount:0},
    {id:3,client:'Cris',phone:'85999990002',status:'Pendente',paidAmount:50},
    {id:4,client:'Dani',phone:'85999990003',status:'Cancelada',paidAmount:100},
    {id:5,client:'Eva',phone:'85999990004',status:'Confirmada',paidAmount:0}
  ]);
  assert.equal(app.nodes.clientsTotal.textContent,'2');
  const names=Array.from(app.clients.buildClients(JSON.parse(app.context.localStorage.getItem(KEY))),x=>x.name);
  assert.deepEqual(names.sort(),['Ana','Beto']);
});

test('agrupa reservas repetidas do mesmo cliente e normaliza telefone com DDI',()=>{
  const app=load([
    {id:1,client:'Ana Oliveira',phone:'(85) 99999-1234',email:'ANA@EXAMPLE.COM',status:'Confirmada',paidAmount:100},
    {id:2,client:'Ana Oliveira',phone:'+55 85 99999-1234',email:'ana@example.com',status:'Finalizada',paidAmount:100}
  ]);
  const clients=app.clients.buildClients(JSON.parse(app.context.localStorage.getItem(KEY)));
  assert.equal(clients.length,1);
  assert.equal(clients[0].count,2);
  assert.equal(clients[0].finished,true);
  assert.match(app.nodes.clientsList.innerHTML,/Já viajou/);
});

test('busca pelo e-mail, telefone e nome; escapa conteúdo mostrado no HTML',()=>{
  const app=load([
    {id:1,client:'Ana <script>alert(1)</script>',phone:'85999991234',email:'ana@example.com',status:'Finalizada'},
    {id:2,client:'Bruno',phone:'1133331111',email:'bruno@example.com',status:'Finalizada'}
  ]);
  assert.doesNotMatch(app.nodes.clientsList.innerHTML,/<script>/);
  assert.match(app.nodes.clientsList.innerHTML,/&lt;script&gt;/);
  app.nodes.clientSearch.value='ana@example.com';
  app.nodes.clientSearch.listeners.input();
  assert.match(app.nodes.clientsCount.textContent,/1 de 2/);
  app.nodes.clientSearch.value='33331111';
  app.nodes.clientSearch.listeners.input();
  assert.match(app.nodes.clientsList.innerHTML,/Bruno/);
  assert.doesNotMatch(app.nodes.clientsList.innerHTML,/ana@example.com/);
});

test('não apresenta dados locais antes da sincronização oficial',()=>{
  const app=load([{id:1,client:'Cliente',phone:'85999991234',status:'Finalizada'}],false);
  assert.match(app.nodes.clientsList.innerHTML,/Carregando/);
  app.context.window.JERI_CLOUD_READY=true;
  app.events['jeri:cloud-ready']();
  assert.equal(app.nodes.clientsTotal.textContent,'1');
});
