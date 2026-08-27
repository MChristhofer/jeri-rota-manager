(function(){
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const dateFmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const form=document.getElementById('reservationForm');
  const financeSection=document.getElementById('financeiro');
  if(!form||!financeSection)return;

  let netDrafts=new Map();
  let sessionKey=null;
  let observer=null;

  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const number=value=>Math.max(0,Number(String(value??0).replace(',','.'))||0);
  const escape=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const monthOf=value=>String(value||'').slice(0,7);
  const currentMonth=()=>new Date().toISOString().slice(0,7);
  const formatDate=value=>{if(!value)return'—';const d=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?String(value):dateFmt.format(d)};
  const isPaid=status=>/^(pago|quitado|repassado)$/i.test(String(status||'').trim());
  const serviceName=s=>s.title||s.service||s.tour||'Serviço';
  const reservationIdFromForm=()=>form.dataset.editingReservationId||'';

  function servicesForReservation(id){
    return read(SERVICES_KEY).filter(s=>String(s.reservationId)===String(id)).sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0));
  }

  function ensureDraftSession(){
    const editingId=reservationIdFromForm();
    const key=editingId?`edit:${editingId}`:'new';
    if(key===sessionKey)return;
    sessionKey=key;
    netDrafts=new Map();
    if(editingId){
      servicesForReservation(editingId).forEach((service,index)=>netDrafts.set(index,number(service.repasseAmount??service.netTotal??0)));
    }
  }

  function updateNetSummary(){
    const output=document.getElementById('reservationServicesNetTotal');
    if(!output)return;
    const total=[...netDrafts.values()].reduce((sum,value)=>sum+number(value),0);
    output.textContent=money.format(total);
  }

  function ensureNetSummary(){
    const summary=document.querySelector('.reservation-sale-total');
    if(!summary||document.getElementById('reservationServicesNetTotal'))return;
    const item=document.createElement('div');
    item.className='reservation-payment-item net-total';
    item.innerHTML='<span>Total a pagar / NET</span><strong id="reservationServicesNetTotal">R$ 0,00</strong><small>Custos previstos dos serviços</small>';
    const feedback=document.getElementById('reservationPaymentFeedback');
    if(feedback)summary.insertBefore(item,feedback);else summary.appendChild(item);
    updateNetSummary();
  }

  function injectNetFields(){
    ensureDraftSession();
    ensureNetSummary();
    document.querySelectorAll('.operational-service-card[data-service-index]').forEach(card=>{
      if(card.querySelector('[data-basic-net]'))return;
      const index=Number(card.dataset.serviceIndex)||0;
      const saleField=card.querySelector('[data-field="saleTotal"]')?.closest('label');
      if(!saleField)return;
      const label=document.createElement('label');
      label.className='service-basic-net-field';
      label.dataset.basicNet='1';
      label.innerHTML=`Valor a pagar / NET (R$) <span class="optional-label">opcional</span><input data-basic-net-input type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" value="${escape(netDrafts.get(index)??'')}"><small>Quanto a Jeri Rota precisará desembolsar neste serviço.</small>`;
      saleField.insertAdjacentElement('afterend',label);
      const input=label.querySelector('[data-basic-net-input]');
      input.addEventListener('input',()=>{netDrafts.set(index,number(input.value));updateNetSummary()});
    });
    updateNetSummary();
  }

  function shiftDraftsAfterRemoval(removedIndex){
    const next=new Map();
    [...netDrafts.entries()].forEach(([index,value])=>{
      if(index<removedIndex)next.set(index,value);
      else if(index>removedIndex)next.set(index-1,value);
    });
    netDrafts=next;
  }

  document.addEventListener('click',event=>{
    const remove=event.target.closest?.('.remove-service-draft');
    if(remove){shiftDraftsAfterRemoval(Number(remove.dataset.index)||0);setTimeout(injectNetFields,0)}
  },true);

  function patchJustSavedReservation(){
    const reservations=read(RESERVATIONS_KEY);
    const editingId=reservationIdFromForm();
    const target=editingId?reservations.find(r=>String(r.id)===String(editingId)):reservations[reservations.length-1];
    if(!target)return;
    const allServices=read(SERVICES_KEY);
    const indexes=[];
    allServices.forEach((service,arrayIndex)=>{if(String(service.reservationId)===String(target.id))indexes.push(arrayIndex)});
    indexes.sort((a,b)=>(Number(allServices[a].sortOrder)||0)-(Number(allServices[b].sortOrder)||0));
    indexes.forEach((arrayIndex,index)=>{
      const service=allServices[arrayIndex];
      const net=number(netDrafts.get(index)??service.repasseAmount??service.netTotal??0);
      service.repasseAmount=net;
      if(net>0&&!isPaid(service.repasseStatus))service.repasseStatus='A pagar';
      if(net===0&&!isPaid(service.repasseStatus))service.repasseStatus='Sem custo';
    });
    write(SERVICES_KEY,allServices);
    if(window.JeriCloudWrite?.syncReservation){
      setTimeout(()=>window.JeriCloudWrite.syncReservation(target).catch(error=>console.error('Falha ao sincronizar NET dos serviços:',error)),180);
    }
    renderBasicFinance();
  }

  form.addEventListener('submit',()=>setTimeout(patchJustSavedReservation,80));

  function installReservationObserver(){
    const host=document.getElementById('reservationServicesEditor')||form;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>injectNetFields());
    observer.observe(host,{childList:true,subtree:true});
    injectNetFields();
  }

  function wrapOpenModal(){
    const base=window.openModal;
    if(typeof base!=='function'||base.__financeBasicWrapped)return;
    const wrapped=function(id=null){
      sessionKey=null;
      netDrafts=new Map();
      const result=base(id);
      setTimeout(()=>{ensureDraftSession();injectNetFields()},30);
      return result;
    };
    wrapped.__financeBasicWrapped=true;
    window.openModal=wrapped;
    try{openModal=wrapped}catch{}
  }

  function setupFinanceMarkup(){
    if(financeSection.dataset.basicFinanceReady==='1')return;
    financeSection.dataset.basicFinanceReady='1';
    financeSection.innerHTML=`
      <div class="basic-finance-head">
        <div><p class="eyebrow">CONTROLE DE CAIXA</p><h2>Financeiro</h2><p>Recebimentos de clientes e custos previstos dos serviços, organizados por mês.</p></div>
        <div class="basic-finance-filters">
          <label><span>Mês</span><input id="financeMonthFilter" type="month" value="${currentMonth()}"></label>
          <label class="finance-search"><span>Buscar</span><input id="financeSearchFilter" type="search" placeholder="Cliente, reserva ou serviço"></label>
          <label><span>Situação</span><select id="financeCostStatusFilter"><option value="todos">Todos</option><option value="a-pagar">A pagar</option><option value="pago">Pago</option></select></label>
        </div>
      </div>

      <div class="basic-finance-cards">
        <article><span>Vendas do mês</span><strong id="financeMonthSales">R$ 0,00</strong><small>Serviços com data no período</small></article>
        <article><span>Recebido dos clientes</span><strong id="financeMonthReceived">R$ 0,00</strong><small>Reservas iniciadas no período</small></article>
        <article><span>A receber dos clientes</span><strong id="financeMonthReceivable">R$ 0,00</strong><small>Saldo das reservas do período</small></article>
        <article class="finance-payable-card"><span>A pagar pelos serviços</span><strong id="financeMonthPayable">R$ 0,00</strong><small>NET ainda pendente no mês</small></article>
      </div>

      <article class="panel basic-finance-panel">
        <div class="panel-head"><div><p class="eyebrow">CLIENTES</p><h3>Recebimentos</h3><p>Visão simples do que foi vendido, recebido e ainda falta cobrar.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Reserva / Cliente</th><th>Total vendido</th><th>Recebido</th><th>Saldo a receber</th></tr></thead><tbody id="financeCustomerTable"></tbody></table></div>
      </article>

      <article class="panel basic-finance-panel finance-costs-panel">
        <div class="panel-head"><div><p class="eyebrow">SERVIÇOS</p><h3>Contas a pagar</h3><p>Os custos entram aqui automaticamente pela data de cada serviço.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Data</th><th>Reserva / Cliente</th><th>Serviço</th><th>Valor a pagar / NET</th><th>Status</th><th></th></tr></thead><tbody id="financeCostTable"></tbody></table></div>
        <div class="finance-cost-totals"><div><span>Previsto no mês</span><strong id="financeCostForecast">R$ 0,00</strong></div><div><span>Já pago</span><strong id="financeCostPaid">R$ 0,00</strong></div><div><span>Ainda a pagar</span><strong id="financeCostOpen">R$ 0,00</strong></div></div>
      </article>

      <div class="finance-legacy-hooks" aria-hidden="true"><strong id="financeReceived"></strong><strong id="financePending"></strong><strong id="financeTotal"></strong><table><tbody id="financeTable"></tbody></table></div>`;

    ['financeMonthFilter','financeSearchFilter','financeCostStatusFilter'].forEach(id=>{
      document.getElementById(id)?.addEventListener(id==='financeSearchFilter'?'input':'change',renderBasicFinance);
    });
    document.getElementById('financeCostTable')?.addEventListener('click',handleCostAction);
  }

  function reservationMap(){return new Map(read(RESERVATIONS_KEY).map(r=>[String(r.id),r]));}

  function monthlyServices(month,reservationsById){
    return read(SERVICES_KEY).filter(service=>{
      const reservation=reservationsById.get(String(service.reservationId));
      return reservation&&reservation.status!=='Cancelada'&&monthOf(service.date)===month;
    });
  }

  function monthlyReservations(month){
    return read(RESERVATIONS_KEY).filter(r=>r.status!=='Cancelada'&&monthOf(r.date)===month);
  }

  function renderBasicFinance(){
    if(financeSection.dataset.basicFinanceReady!=='1')return;
    const month=document.getElementById('financeMonthFilter')?.value||currentMonth();
    const query=(document.getElementById('financeSearchFilter')?.value||'').trim().toLowerCase();
    const statusFilter=document.getElementById('financeCostStatusFilter')?.value||'todos';
    const reservationsById=reservationMap();
    const monthServices=monthlyServices(month,reservationsById);
    const monthReservations=monthlyReservations(month);

    const sales=monthServices.reduce((sum,s)=>sum+number(s.saleTotal),0);
    const received=monthReservations.reduce((sum,r)=>sum+Math.min(number(r.paidAmount),number(r.amount)),0);
    const receivable=monthReservations.reduce((sum,r)=>sum+Math.max(0,number(r.amount)-number(r.paidAmount)),0);
    const payable=monthServices.filter(s=>!isPaid(s.repasseStatus)).reduce((sum,s)=>sum+number(s.repasseAmount??s.netTotal),0);

    document.getElementById('financeMonthSales').textContent=money.format(sales);
    document.getElementById('financeMonthReceived').textContent=money.format(received);
    document.getElementById('financeMonthReceivable').textContent=money.format(receivable);
    document.getElementById('financeMonthPayable').textContent=money.format(payable);

    const customerRows=monthReservations.filter(r=>!query||`${r.reservationCode||''} ${r.client||''} ${r.service||''}`.toLowerCase().includes(query));
    const customerTable=document.getElementById('financeCustomerTable');
    customerTable.innerHTML=customerRows.length?customerRows.map(r=>{
      const total=number(r.amount);const paid=Math.min(number(r.paidAmount),total);const balance=Math.max(0,total-paid);
      return `<tr><td><strong>${escape(r.reservationCode||'Reserva')}</strong><small>${escape(r.client||'Cliente')}</small></td><td>${money.format(total)}</td><td><strong>${money.format(paid)}</strong></td><td><strong class="${balance?'finance-open-value':'finance-paid-value'}">${money.format(balance)}</strong><small>${balance?'pendente':'quitado'}</small></td></tr>`;
    }).join(''):`<tr><td colspan="4"><div class="empty-state"><strong>Nenhuma reserva neste período.</strong></div></td></tr>`;

    const costRows=monthServices.map(service=>({service,reservation:reservationsById.get(String(service.reservationId)),amount:number(service.repasseAmount??service.netTotal),paid:isPaid(service.repasseStatus)})).filter(row=>{
      const text=`${row.reservation?.reservationCode||''} ${row.reservation?.client||''} ${serviceName(row.service)}`.toLowerCase();
      const matchesQuery=!query||text.includes(query);
      const matchesStatus=statusFilter==='todos'||(statusFilter==='pago'&&row.paid)||(statusFilter==='a-pagar'&&!row.paid);
      return matchesQuery&&matchesStatus&&row.amount>0;
    }).sort((a,b)=>String(a.service.date||'').localeCompare(String(b.service.date||'')));

    const costTable=document.getElementById('financeCostTable');
    costTable.innerHTML=costRows.length?costRows.map(({service,reservation,amount,paid})=>`<tr><td>${formatDate(service.date)}</td><td><strong>${escape(reservation?.reservationCode||'Reserva')}</strong><small>${escape(reservation?.client||'Cliente')}</small></td><td><strong>${escape(serviceName(service))}</strong></td><td><strong>${money.format(amount)}</strong></td><td><span class="finance-cost-status ${paid?'is-paid':'is-open'}">${paid?'Pago':'A pagar'}</span></td><td class="row-actions"><button type="button" class="${paid?'finance-reopen-button':'finance-pay-button'}" data-finance-service="${escape(service.id||service.sourceKey||'')}" data-finance-reservation="${escape(service.reservationId)}" data-finance-action="${paid?'reopen':'pay'}">${paid?'Reabrir':'Marcar como pago'}</button></td></tr>`).join(''):`<tr><td colspan="6"><div class="empty-state"><strong>Nenhum custo encontrado.</strong><p>Informe “Valor a pagar / NET” nos serviços da reserva.</p></div></td></tr>`;

    const allCosts=monthServices.map(service=>({amount:number(service.repasseAmount??service.netTotal),paid:isPaid(service.repasseStatus)})).filter(item=>item.amount>0);
    const forecast=allCosts.reduce((sum,item)=>sum+item.amount,0);
    const paidTotal=allCosts.filter(item=>item.paid).reduce((sum,item)=>sum+item.amount,0);
    document.getElementById('financeCostForecast').textContent=money.format(forecast);
    document.getElementById('financeCostPaid').textContent=money.format(paidTotal);
    document.getElementById('financeCostOpen').textContent=money.format(Math.max(0,forecast-paidTotal));
  }

  async function handleCostAction(event){
    const button=event.target.closest?.('[data-finance-service]');
    if(!button)return;
    const services=read(SERVICES_KEY);
    const service=services.find(s=>String(s.reservationId)===String(button.dataset.financeReservation)&&String(s.id||s.sourceKey||'')===String(button.dataset.financeService));
    if(!service)return;
    const makePaid=button.dataset.financeAction==='pay';
    service.repasseStatus=makePaid?'Pago':'A pagar';
    service.repassePaidAt=makePaid?new Date().toISOString():null;
    write(SERVICES_KEY,services);
    renderBasicFinance();
    const reservation=read(RESERVATIONS_KEY).find(r=>String(r.id)===String(service.reservationId));
    if(reservation&&window.JeriCloudWrite?.syncReservation){
      button.disabled=true;
      try{await window.JeriCloudWrite.syncReservation(reservation)}catch(error){console.error('Falha ao sincronizar status do custo:',error)}
    }
  }

  function wrapRenderAll(){
    const base=window.renderAll;
    if(typeof base!=='function'||base.__financeBasicWrapped)return;
    const wrapped=function(){const result=base();renderBasicFinance();return result};
    wrapped.__financeBasicWrapped=true;
    window.renderAll=wrapped;
    try{renderAll=wrapped}catch{}
  }

  setupFinanceMarkup();
  wrapOpenModal();
  wrapRenderAll();
  installReservationObserver();
  renderBasicFinance();
})();
