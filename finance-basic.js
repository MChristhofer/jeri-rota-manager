(function(){
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const dateFmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const form=document.getElementById('reservationForm');
  const financeSection=document.getElementById('financeiro');
  if(!form||!financeSection)return;

  let netDrafts=new Map();
  let draftSession='';
  let pendingSubmitId='';

  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const number=value=>Math.max(0,Number(String(value??0).replace(',','.'))||0);
  const escape=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const monthOf=value=>String(value||'').slice(0,7);
  const currentMonth=()=>new Date().toISOString().slice(0,7);
  const isPaid=status=>/^(pago|quitado|repassado)$/i.test(String(status||'').trim());
  const serviceName=service=>service.title||service.service||service.tour||'Serviço';
  const formatDate=value=>{if(!value)return'—';const date=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(date.getTime())?String(value):dateFmt.format(date)};

  function reservationServices(id){
    return read(SERVICES_KEY)
      .filter(service=>String(service.reservationId)===String(id))
      .sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0));
  }

  function loadNetDrafts(id){
    const session=id?`edit:${id}`:'new';
    if(session===draftSession)return;
    draftSession=session;
    netDrafts=new Map();
    if(id){
      reservationServices(id).forEach((service,index)=>netDrafts.set(index,number(service.repasseAmount??service.netTotal)));
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
    if(!summary)return;
    let item=document.getElementById('reservationServicesNetTotal')?.closest('.reservation-payment-item');
    if(!item){
      item=document.createElement('div');
      item.className='reservation-payment-item net-total';
      item.innerHTML='<span>NET total</span><strong id="reservationServicesNetTotal">R$ 0,00</strong><small>Total previsto para pagar</small>';
      const feedback=document.getElementById('reservationPaymentFeedback');
      if(feedback)summary.insertBefore(item,feedback);else summary.appendChild(item);
    }
    updateNetSummary();
  }

  function injectNetFields(){
    ensureNetSummary();
    document.querySelectorAll('.operational-service-card[data-service-index]').forEach(card=>{
      if(card.querySelector('[data-basic-net]'))return;
      const index=Number(card.dataset.serviceIndex)||0;
      const saleLabel=card.querySelector('[data-field="saleTotal"]')?.closest('label');
      if(!saleLabel)return;
      const label=document.createElement('label');
      label.className='service-basic-net-field';
      label.dataset.basicNet='1';
      const value=netDrafts.has(index)?netDrafts.get(index):'';
      label.innerHTML=`Valor a pagar / NET (R$)<input data-basic-net-input type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" value="${escape(value)}"><small>Custo previsto deste serviço.</small>`;
      saleLabel.insertAdjacentElement('afterend',label);
      label.querySelector('[data-basic-net-input]')?.addEventListener('input',event=>{
        netDrafts.set(index,number(event.currentTarget.value));
        updateNetSummary();
      });
    });
  }

  function shiftNetDraftsAfterRemoval(index){
    const next=new Map();
    [...netDrafts.entries()].forEach(([key,value])=>{
      if(key<index)next.set(key,value);
      if(key>index)next.set(key-1,value);
    });
    netDrafts=next;
  }

  document.addEventListener('click',event=>{
    const removeService=event.target.closest?.('.remove-service-draft');
    if(removeService)shiftNetDraftsAfterRemoval(Number(removeService.dataset.index)||0);
    if(event.target.closest?.('#addReservationService,.remove-service-draft,.add-location-point,.remove-location-point')){
      setTimeout(injectNetFields,0);
    }
  },true);

  function wrapReservationModal(){
    const base=window.openModal;
    if(typeof base!=='function'||base.__commitmentsWrapped)return;
    const wrapped=function(id=null){
      draftSession='';
      netDrafts=new Map();
      const result=base(id);
      setTimeout(()=>{loadNetDrafts(id);injectNetFields()},25);
      return result;
    };
    wrapped.__commitmentsWrapped=true;
    window.openModal=wrapped;
    try{openModal=wrapped}catch{}
  }

  function patchSavedNetValues(){
    const reservations=read(RESERVATIONS_KEY);
    const target=pendingSubmitId
      ?reservations.find(reservation=>String(reservation.id)===String(pendingSubmitId))
      :reservations[reservations.length-1];
    pendingSubmitId='';
    if(!target)return;

    const services=read(SERVICES_KEY);
    const indexes=[];
    services.forEach((service,arrayIndex)=>{
      if(String(service.reservationId)===String(target.id))indexes.push(arrayIndex);
    });
    indexes.sort((a,b)=>(Number(services[a].sortOrder)||0)-(Number(services[b].sortOrder)||0));

    indexes.forEach((arrayIndex,index)=>{
      const service=services[arrayIndex];
      const net=number(netDrafts.has(index)?netDrafts.get(index):(service.repasseAmount??service.netTotal));
      service.repasseAmount=net;
      if(net<=0&&!isPaid(service.repasseStatus))service.repasseStatus='Sem custo';
      if(net>0&&!isPaid(service.repasseStatus))service.repasseStatus='A pagar';
    });
    write(SERVICES_KEY,services);
    renderCommitments();

    if(window.JeriCloudWrite?.syncReservation){
      setTimeout(()=>window.JeriCloudWrite.syncReservation(target).catch(error=>console.error('Falha ao sincronizar NET:',error)),180);
    }
  }

  form.addEventListener('submit',()=>{
    pendingSubmitId=form.dataset.editingReservationId||'';
    setTimeout(patchSavedNetValues,80);
  });

  function setupFinanceMarkup(){
    financeSection.innerHTML=`
      <div class="commitments-head">
        <div>
          <p class="eyebrow">CONTROLE MENSAL</p>
          <h2>Compromissos</h2>
          <p>Somente o que ainda falta pagar, usando o saldo dos clientes para reduzir a necessidade de caixa.</p>
        </div>
        <div class="commitments-filters">
          <label><span>Mês</span><input id="commitmentMonth" type="month" value="${currentMonth()}"></label>
          <label><span>Buscar</span><input id="commitmentSearch" type="search" placeholder="Cliente, reserva ou serviço"></label>
        </div>
      </div>

      <div class="commitment-cards">
        <article><span>NET ainda a pagar</span><strong id="commitmentNetTotal">R$ 0,00</strong><small>Compromissos pendentes do mês</small></article>
        <article><span>Clientes ainda vão pagar</span><strong id="commitmentClientTotal">R$ 0,00</strong><small>Saldo alocado para cobrir estes NETs</small></article>
        <article class="commitment-cover-card"><span>Empresa precisa cobrir</span><strong id="commitmentCompanyTotal">R$ 0,00</strong><small>NET menos saldo esperado dos clientes</small></article>
      </div>

      <article class="panel commitments-panel">
        <div class="panel-head">
          <div><p class="eyebrow">PENDÊNCIAS</p><h3>Compromissos do mês</h3><p>Ao marcar um NET como pago, ele sai desta lista e deixa de compor o total pendente.</p></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Reserva / Cliente</th><th>Serviço</th><th>NET a pagar</th><th>Cliente ainda paga</th><th>Empresa cobre</th><th></th></tr></thead>
            <tbody id="commitmentTable"></tbody>
          </table>
        </div>
        <div class="commitments-note">Cálculo: o saldo do cliente é usado uma única vez, seguindo a ordem das datas dos serviços. A empresa cobre somente o que restar do NET.</div>
      </article>

      <div class="finance-legacy-hooks" aria-hidden="true"><strong id="financeReceived"></strong><strong id="financePending"></strong><strong id="financeTotal"></strong><table><tbody id="financeTable"></tbody></table></div>`;

    document.getElementById('commitmentMonth')?.addEventListener('change',renderCommitments);
    document.getElementById('commitmentSearch')?.addEventListener('input',renderCommitments);
    document.getElementById('commitmentTable')?.addEventListener('click',handlePayAction);
  }

  function buildPendingCommitments(){
    const reservations=read(RESERVATIONS_KEY).filter(reservation=>reservation.status!=='Cancelada');
    const services=read(SERVICES_KEY);
    const reservationsById=new Map(reservations.map(reservation=>[String(reservation.id),reservation]));
    const servicesByReservation=new Map();

    services.forEach(service=>{
      const reservation=reservationsById.get(String(service.reservationId));
      const net=number(service.repasseAmount??service.netTotal);
      if(!reservation||net<=0||isPaid(service.repasseStatus))return;
      const key=String(reservation.id);
      if(!servicesByReservation.has(key))servicesByReservation.set(key,[]);
      servicesByReservation.get(key).push(service);
    });

    const rows=[];
    reservations.forEach(reservation=>{
      const linked=(servicesByReservation.get(String(reservation.id))||[])
        .sort((a,b)=>String(a.date||'9999-12-31').localeCompare(String(b.date||'9999-12-31'))||(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0));
      if(!linked.length)return;

      let customerBalance=Math.max(0,number(reservation.amount)-number(reservation.paidAmount));
      linked.forEach(service=>{
        const net=number(service.repasseAmount??service.netTotal);
        const clientContribution=Math.min(customerBalance,net);
        const companyCover=Math.max(0,net-clientContribution);
        customerBalance=Math.max(0,customerBalance-clientContribution);
        rows.push({reservation,service,net,clientContribution,companyCover});
      });
    });
    return rows;
  }

  function renderCommitments(){
    if(!document.getElementById('commitmentTable'))return;
    const month=document.getElementById('commitmentMonth')?.value||currentMonth();
    const query=(document.getElementById('commitmentSearch')?.value||'').trim().toLowerCase();
    const allRows=buildPendingCommitments();
    const monthRows=allRows.filter(row=>monthOf(row.service.date)===month);
    const visibleRows=monthRows.filter(row=>{
      if(!query)return true;
      return `${row.reservation.reservationCode||''} ${row.reservation.client||''} ${serviceName(row.service)}`.toLowerCase().includes(query);
    });

    const netTotal=monthRows.reduce((sum,row)=>sum+row.net,0);
    const clientTotal=monthRows.reduce((sum,row)=>sum+row.clientContribution,0);
    const companyTotal=monthRows.reduce((sum,row)=>sum+row.companyCover,0);
    document.getElementById('commitmentNetTotal').textContent=money.format(netTotal);
    document.getElementById('commitmentClientTotal').textContent=money.format(clientTotal);
    document.getElementById('commitmentCompanyTotal').textContent=money.format(companyTotal);

    const tbody=document.getElementById('commitmentTable');
    tbody.innerHTML=visibleRows.length?visibleRows.map(row=>{
      const serviceKey=String(row.service.id||row.service.sourceKey||'');
      return `<tr>
        <td>${formatDate(row.service.date)}</td>
        <td><strong>${escape(row.reservation.reservationCode||'Reserva')}</strong><small>${escape(row.reservation.client||'Cliente')}</small></td>
        <td><strong>${escape(serviceName(row.service))}</strong></td>
        <td><strong>${money.format(row.net)}</strong></td>
        <td><strong class="commitment-client-value">${money.format(row.clientContribution)}</strong></td>
        <td><strong class="commitment-company-value">${money.format(row.companyCover)}</strong></td>
        <td class="row-actions"><button type="button" class="commitment-paid-button" data-commitment-service="${escape(serviceKey)}" data-commitment-reservation="${escape(row.service.reservationId)}">Marcar como pago</button></td>
      </tr>`;
    }).join(''):`<tr><td colspan="7"><div class="empty-state"><strong>Nenhum compromisso pendente neste mês.</strong><p>Os NETs informados nas reservas aparecerão aqui automaticamente.</p></div></td></tr>`;
  }

  async function handlePayAction(event){
    const button=event.target.closest?.('[data-commitment-service]');
    if(!button)return;
    const services=read(SERVICES_KEY);
    const service=services.find(item=>String(item.reservationId)===String(button.dataset.commitmentReservation)&&String(item.id||item.sourceKey||'')===String(button.dataset.commitmentService));
    if(!service)return;

    const previous=service.repasseStatus;
    service.repasseStatus='Pago';
    write(SERVICES_KEY,services);
    renderCommitments();

    const reservation=read(RESERVATIONS_KEY).find(item=>String(item.id)===String(service.reservationId));
    if(!reservation||!window.JeriCloudWrite?.syncReservation)return;
    try{
      await window.JeriCloudWrite.syncReservation(reservation);
    }catch(error){
      console.error('Falha ao sincronizar compromisso pago:',error);
      const latest=read(SERVICES_KEY);
      const rollback=latest.find(item=>String(item.reservationId)===String(service.reservationId)&&String(item.id||item.sourceKey||'')===String(service.id||service.sourceKey||''));
      if(rollback)rollback.repasseStatus=previous||'A pagar';
      write(SERVICES_KEY,latest);
      renderCommitments();
      alert('Não foi possível salvar este pagamento no banco. Tente novamente.');
    }
  }

  function wrapRenderAll(){
    const base=window.renderAll;
    if(typeof base!=='function'||base.__commitmentsWrapped)return;
    const wrapped=function(){const result=base();renderCommitments();return result};
    wrapped.__commitmentsWrapped=true;
    window.renderAll=wrapped;
    try{renderAll=wrapped}catch{}
  }

  setupFinanceMarkup();
  wrapReservationModal();
  wrapRenderAll();
  loadNetDrafts(form.dataset.editingReservationId||'');
  injectNetFields();
  renderCommitments();
})();
