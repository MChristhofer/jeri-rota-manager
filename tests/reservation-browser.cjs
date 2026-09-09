// Run with JERI_PLAYWRIGHT set to the installed Playwright package if needed.
const {chromium}=require(process.env.JERI_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const R='jeri-rota-manager-reservas-v1',S='jeri-rota-manager-reservation-services-v1';
const fixture={id:1,reservationCode:'JR-00001',client:'Ana / Bia',phone:'85999999999',people:2,amount:1000,paidAmount:800,status:'Confirmada',service:'Transfer',date:'2026-09-10',boarding:'Hotel A',partnerOperation:'propria'};
const services=[{id:'a',reservationId:1,sortOrder:0,serviceCatalogId:'shared',serviceType:'transfer',service:'Transfer A → B',origin:'A',destination:'B',modality:'Compartilhado',vehicle:'Hilux',repasseAmount:160,netTotal:160,netUnit:80,quantity:2,date:'2026-09-10',returnDate:'2026-09-11',startTime:'09:15',endTime:'17:30',boarding:'Hotel A',dropoff:'Hotel B',boardingPoints:[{location:'Hotel A',apartment:'12',passengers:'Ana'}],dropoffPoints:[{location:'Hotel B',apartment:'',passengers:''}],saleTotal:1000},
{id:'b',reservationId:1,sortOrder:1,serviceCatalogId:'private',serviceType:'transfer',service:'Transfer A → B',origin:'A',destination:'B',modality:'Privativo',vehicle:'Hilux',repasseAmount:400,netTotal:400,netUnit:400,quantity:1,date:'2026-09-15',startTime:'10:00',boarding:'Aeroporto',dropoff:'Hotel C',saleTotal:0}];
const catalog=[{id:'shared',name:'A → B',category:'Transfer',vehicle_type:'Hilux',modality:'Compartilhado',origin:'A',destination:'B',net_value:80,pricing_basis:'fixed',active:true},{id:'private',name:'A → B',category:'Transfer',vehicle_type:'Hilux',modality:'Privativo',origin:'A',destination:'B',net_value:400,pricing_basis:'per_person',active:true}];
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='jeri.test')return route.fulfill({body:'',contentType:'text/javascript'});
      const name=url.pathname.slice(1)||'index.html';
      if(name==='supabase-config.js')return route.fulfill({contentType:'text/javascript',body:`window.jeriSupabase={auth:{getUser:async()=>({data:{user:{email:'test@example.com'}}})},from(table){const q={update(row){window.catalogUpdate=row;return q},eq(){return q},select(){return q},order(){return q},then(resolve){return Promise.resolve({data:table==='service_catalog'?${JSON.stringify(catalog)}:[],error:null}).then(resolve)}};return q}};`});
      if(name==='cloud-data-sync.js')return route.fulfill({contentType:'text/javascript',body:'window.JeriCloudData={fetchAndCache:async()=>{}};'});
      // Exercise the real writer separately against a recording mock. No live data.
      if(['cloud-write-sync.js','cloud-delete-sync.js'].includes(name))return route.fulfill({contentType:'text/javascript',body:''});
      const file=path.join(root,name);if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript'});
    });
    await page.addInitScript(({R,S,fixture,services})=>{localStorage.setItem(R,JSON.stringify([fixture,{...fixture,id:2,reservationCode:'JR-00002',client:'Outra reserva'}]));localStorage.setItem(S,JSON.stringify(services));},{R,S,fixture,services});
    await page.goto('http://jeri.test/index.html');
    await page.waitForFunction(()=>window.JeriReservationDrafts&&window.jeriServiceCatalog?.length&&document.querySelector('#commitmentMonthCards'));
    const open=async()=>{await page.evaluate(()=>window.openModal(1));await page.waitForFunction(()=>document.querySelectorAll('[data-basic-net-input]').length===2);await page.waitForTimeout(200)};
    const net=()=>page.locator('[data-basic-net-input]');
    const total=()=>page.locator('#reservationServicesNetTotal').innerText();
    const values=()=>net().evaluateAll(xs=>xs.map(x=>window.JeriFinance.number(x.value)));
    const input=async(selector,value)=>{await page.locator(selector).fill(value);await page.locator(selector).dispatchEvent('input')};
    await open();
    assert.deepEqual(await values(),[160,400]);assert.match(await total(),/560,00/);
    assert.equal(await page.locator('[name="people"]').inputValue(),'2');
    await page.evaluate(()=>document.querySelector('#reservationForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await page.waitForTimeout(1500);
    const unchanged=await page.evaluate(S=>JSON.parse(localStorage.getItem(S)).filter(s=>s.reservationId===1),S);
    for(let i=0;i<services.length;i++)for(const key of ['service','modality','vehicle','repasseAmount','netTotal','date','returnDate','startTime','endTime','boarding','dropoff'])assert.equal(unchanged[i][key]||'',services[i][key]||'',`Sem edição: ${key}`);
    await open();
    const snapshot=()=>page.locator('[data-service-id="a"]').evaluate(card=>({fields:[...card.querySelectorAll('[data-field]')].map(x=>[x.dataset.field,x.value]),points:[...card.querySelectorAll('[data-point-field]')].map(x=>x.value)}));
    const original=await snapshot();
    await page.locator('#addReservationService').click();assert.deepEqual(await snapshot(),original);
    await page.locator('.remove-service-draft').last().click();assert.deepEqual(await snapshot(),original);
    await input('[name="people"]','4');assert.deepEqual(await values(),[320,400]);assert.match(await total(),/720,00/);
    await input('[data-service-id="a"] [data-basic-net-input]','123,45');assert.match(await total(),/523,45/);
    await input('#reservationReceivedAmount','100');assert.match(await total(),/523,45/);
    await page.locator('[data-service-id="a"] .duplicate-service-draft').click();assert.deepEqual(await values(),[123.45,123.45,400]);assert.match(await total(),/646,90/);
    await page.locator('[data-service-id="a"] .remove-service-draft').click();assert.deepEqual(await values(),[123.45,400]);
    await page.locator('[data-catalog-modality]').first().selectOption('Privativo');assert.deepEqual(await values(),[400,400]);
    await input('[name="people"]','1');assert.deepEqual(await values(),[400,400]);
    await page.locator('[data-catalog-modality]').first().selectOption('Compartilhado');assert.deepEqual(await values(),[80,400]);
    await input('[data-basic-net-input] >> nth=0','0');assert.match(await total(),/400,00/);
    await page.locator('#addReservationService').click();assert.deepEqual(await values(),[0,400,0]);
    await page.locator('[data-catalog-base]').last().selectOption({label:'Transfer · A → B'});
    await page.locator('[data-catalog-modality]').last().selectOption('Compartilhado');
    assert.deepEqual(await values(),[0,400,80]);assert.match(await total(),/480,00/);
    await page.locator('.remove-service-draft').last().click();
    // Save an existing reservation that is not the last record, then reopen.
    await page.evaluate(()=>document.querySelector('#reservationForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await page.waitForTimeout(1500);
    const saved=await page.evaluate(({R,S})=>({reservations:JSON.parse(localStorage.getItem(R)),services:JSON.parse(localStorage.getItem(S))}),{R,S});
    assert.deepEqual(saved.services.filter(s=>s.reservationId===1).map(s=>s.repasseAmount),[0,400]);
    assert.equal(saved.reservations.find(r=>r.id===2).paidAmount,800);
    const own=saved.services.filter(s=>s.reservationId===1);
    assert.equal(own[0].boarding,'Hotel A');assert.equal(own[0].dropoff,'Hotel B');assert.equal(own[0].startTime,'09:15');assert.equal(own[0].returnDate,'2026-09-11');
    await open();assert.deepEqual(await values(),[0,400]);assert.match(await total(),/400,00/);
    const labels=await page.locator('.reservation-sale-total > .reservation-payment-item > span:first-child').allTextContents();assert.deepEqual(labels,['NET total','Valor recebido','Saldo a receber']);
    assert.equal(await page.locator('#reservationCompanyCoverLive').count(),0);
    if(process.env.JERI_SCREENSHOT){await page.locator('.reservation-sale-total').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.JERI_SCREENSHOT})}
    console.log('Verificando bate e volta');
    // Bate e volta survives saving, recreation of cards and cloud-style metadata hydration.
    await page.locator('.reservation-service-draft select[data-leg-mode]').first().selectOption('daytrip');
    assert.equal(await page.locator('.reservation-service-draft [data-field="returnDate"]').first().inputValue(),'');
    await page.locator('#addReservationService').click();
    assert.equal(await page.locator('.reservation-service-draft select[data-leg-mode]').first().inputValue(),'daytrip');
    await page.locator('.remove-service-draft').last().click();
    await page.evaluate(()=>document.querySelector('#reservationForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await page.waitForTimeout(1500);
    await page.evaluate(S=>{const rows=JSON.parse(localStorage.getItem(S));for(const row of rows)delete row.legMode;localStorage.setItem(S,JSON.stringify(rows))},S);
    await open();
    assert.equal(await page.locator('.reservation-service-draft select[data-leg-mode]').first().inputValue(),'daytrip');
    assert.deepEqual(await values(),[0,400]);
    await page.locator('.reservation-service-draft select[data-leg-mode]').first().selectOption('roundtrip');
    assert.equal(await page.locator('.reservation-service-draft [data-field="returnDate"]').first().isVisible(),true);
    await page.evaluate(()=>window.closeModal());
    await page.evaluate(()=>document.querySelector('.nav-item[data-section="servicos"]').click());
    console.log('Verificando categoria');
    await page.locator('[data-service-edit="shared"]').click();
    assert.equal(await page.locator('#managerServiceCategory').isVisible(),true);
    await page.locator('#managerServiceCategory').selectOption('Passeio');
    await page.locator('#managerServiceSave').click();
    await page.waitForFunction(()=>window.catalogUpdate?.category==='Passeio');
    // Run the mandatory cases through the actual monthly renderer.
    for(const [i,[amount,paidAmount,expected]] of [[400,100,100],[400,400,400],[1000,100,0],[1000,800,200],[1000,1000,400]].entries()){
      await page.evaluate(({R,S,amount,paidAmount})=>{localStorage.setItem(R,JSON.stringify([{id:1,amount,paidAmount}]));localStorage.setItem(S,JSON.stringify([{id:'a',reservationId:1,repasseAmount:400,date:'2026-09-10',repasseStatus:'Pago'}]));window.dispatchEvent(new Event('reservation-finance-refresh'));},{R,S,amount,paidAmount});
      const text=await page.locator('.commitment-month-card > strong').innerText();assert.ok(text.includes(expected.toLocaleString('pt-BR',{minimumFractionDigits:2})),text);
      assert.match(await page.locator('.commitment-month-count').innerText(),/400,00/);
      console.log(`Browser Financeiro caso ${i+1}: empresa cobre R$ ${expected} OK`);
    }
    assert.deepEqual(errors,[]);
    console.log('Browser: edição, NET zero, seleção, passageiros, modalidade, manual, adição, duplicação, exclusão, persistência e resumo OK');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
