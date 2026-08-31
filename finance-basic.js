(function(){
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const dateFmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const monthFmt=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'});
  const form=document.getElementById('reservationForm');
  const financeSection=document.getElementById('financeiro');
  if(!form||!financeSection)return;

  let netDrafts=new Map();
  let draftSession='';
  let pendingSubmitId='';
  let serviceObserver=null;
  let selectedMonth=null;

  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const number=value=>{const raw=String(value??0).trim();const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;return Math.max(0,Number(normalized)||0)};
  const escape=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const monthOf=value=>String(value||'').slice(0,7);
  const isPaid=status=>/^(pago|quitado|repassado|realizado)$/i.test(String(status||'').trim());
  const isNoCost=status=>/^sem custo$/i.test(String(status||'').trim());
  const serviceName=service=>service.title||service.service||service.tour||'Serviço';
  const serviceOperationalDate=service=>service?.date||service?.returnDate||'';
  const storedNet=service=>{
    if(!service)return 0;
    const repasse=number(service.repasseAmount);
    const total=number(service.netTotal);
    const unit=number(service.netUnit);
    const quantity=Math.max(1,number(service.quantity)||1);
    if(isNoCost(service.repasseStatus)&&repasse===0)return 0;
    if(repasse>0)return repasse;
    if(total>0)return total;
    if(unit>0)return unit*quantity;
    return 0;
  };
  const formatDate=value=>{if(!value)return'—';const date=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(date.getTime())?String(value):dateFmt.format(date)};
  const formatMonth=value=>{
    const [year,month]=String(value||'').split('-').map(Number);
    if(!year||!month)return'Período';
    const label=monthFmt.format(new Date(year,month-1,1,12));
    return label.charAt(0).toUpperCase()+label.slice(1);
  };

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
    if(id){reservationServices(id).forEach((service,index)=>netDrafts.set(index,storedNet(service)))}
    updateNetSummary();
  }

  function updateNetSummary(){
    const output=document.getElementById('reservationServicesNetTotal');
    if(!output)return;
    const total=[...netDrafts.values()].reduce((sum,value)=>sum+number(value),0);
    const formatted=money.format(total);
    if(output.textContent!==formatted)output.textContent=formatted;
  }

  function hydrateExistingNetField(card,index){
    const label=card.querySelector('[data-basic-net]');
    const netInput=label?.querySelector('[data-basic-net-input]')||card.querySelector('[data-basic-net-input]');
    if(!netInput)return false;
    const hydrationKey=`${draftSession}:${index}`;
    if(netInput.dataset.netHydrationKey!==hydrationKey&&netDrafts.has(index)&&netInput.dataset.netUserChanged!=='true'){
      const value=number(netDrafts.get(index));
      netInput.value=value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
      netInput.dataset.netHydrationKey=hydrationKey;
      netInput.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return true;
  }

  function bindNetInput(netInput,index){
    if(!netInput||netInput.dataset.netDraftBound==='true')return;
    netInput.dataset.netDraftBound='true';
    netInput.addEventListener('focus',()=>netInput.select());
    netInput.addEventListener('input',event=>{
      if(event.isTrusted)event.currentTarget.dataset.netUserChanged='true';
      netDrafts.set(index,number(event.currentTarget.value));
      updateNetSummary();
    });
    netInput.addEventListener('blur',()=>{netInput.value=number(netInput.value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})});
  }

  function injectNetFields(){
    ensureNetSummary();
    document.querySelectorAll('.operational-service-card[data-service-index]').forEach(card=>{
      const index=Number(card.dataset.serviceIndex)||0;
      const existing=card.querySelector('[data-basic-net-input]');
      if(existing){
        bindNetInput(existing,index);
        hydrateExistingNetField(card,index);
        return;
      }
      const anchor=card.querySelector('[data-field="returnDate"]')?.closest('label')||card.querySelector('[data-field="date"]')?.closest('label');
      if(!anchor)return;
      const label=document.createElement('label');
      label.className='service-basic-net-field';
      label.dataset.basicNet='1';
      const value=netDrafts.has(index)?number(netDrafts.get(index)):0;
      label.innerHTML=`Valor NET<input data-basic-net-input type="text" inputmode="decimal" placeholder="0,00" value="${escape(value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}))}"><small>Carregado do catálogo e sempre editável nesta reserva.</small>`;
      anchor.insertAdjacentElement('afterend',label);
      const netInput=label.querySelector('[data-basic-net-input]');
      bindNetInput(netInput,index);
      if(netInput)netInput.dataset.netHydrationKey=`${draftSession}:${index}`;
    });
    updateNetSummary();
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

  function installServiceObserver(){
    const draftsHost=document.getElementById('reservationServiceDrafts');
    if(!draftsHost||serviceObserver)return;
    serviceObserver=new MutationObserver(()=>requestAnimationFrame(injectNetFields));
    serviceObserver.observe(draftsHost,{childList:true,subtree:true});
  }

  function shiftNetDraftsAfterRemoval(index){
    const next=new Map();
    [...netDrafts.entries()].forEach(([key,value])=>{
      if(key<index)next.set(key,value);
      if(key>index)next.set(key-1,value);
    });
    netDrafts=next;
    updateNetSummary();
  }

  function duplicateNetDraft(index){
    const next=new Map();
    [...netDrafts.entries()].forEach(([key,value])=>next.set(key>index?key+1:key,value));
    next.set(index+1,number(netDrafts.get(index)||0));
    netDrafts=next;
    updateNetSummary();
  }

  document.addEventListener('click',event=>{
    const removeService=event.target.closest?.('.remove-service-draft');
    if(removeService)shiftNetDraftsAfterRemoval(Number(removeService.dataset.index)||0);
    const duplicateService=event.target.closest?.('.duplicate-service-draft');
    if(duplicateService)duplicateNetDraft(Number(duplicateService.dataset.index)||0);
    if(event.target.closest?.('#addReservationService,.remove-service-draft,.duplicate-service-draft,.add-location-point,.remove-location-point'))setTimeout(injectNetFields,0);
  },true);

  function wrapReservationModal(){
    const base=window.openModal;
    if(typeof base!=='function'||base.__commitmentsWrapped)return;
    const wrapped=function(id=null){
      draftSession='';
      netDrafts=new Map();
      const result=base(id);
      setTimeout(()=>{
        loadNetDrafts(id);
        installServiceObserver();
        injectNetFields();
        setTimeout(injectNetFields,80);
      },25);
      return result;
    };
    wrapped.__commitmentsWrapped=true;
    window.openModal=wrapped;
    try{openModal=wrapped}catch{}
  }

  function protectNetDraftsBeforeSubmit(){
    const editingId=form.dataset.editingReservationId||'';
    if(!editingId)return;
    const saved=reservationServices(editingId);
    saved.forEach((service,index)=>{
      const input=document.querySelector(`.operational-service-card[data-service-index="${index}"] [data-basic-net-input]`);
      const userChanged=input?.dataset.netUserChanged==='true';
      const persisted=storedNet(service);
      const current=netDrafts.has(index)?number(netDrafts.get(index)):number(input?.value);
      if(!userChanged&&persisted>0&&current<=0){
        netDrafts.set(index,persisted);
        if(input){
          input.value=persisted.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
          input.dispatchEvent(new Event('input',{bubbles:true}));
        }
      }
    });
    updateNetSummary();
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
    services.forEach((service,arrayIndex)=>{if(String(service.reservationId)===String(target.id))indexes.push(arrayIndex)});
    indexes.sort((a,b)=>(Number(services[a].sortOrder)||0)-(Number(services[b].sortOrder)||0));

    indexes.forEach((arrayIndex,index)=>{
      const service=services[arrayIndex];
      const net=netDrafts.has(index)?number(netDrafts.get(index)):storedNet(service);
      service.repasseAmount=net;
      service.netTotal=net;
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
    protectNetDraftsBeforeSubmit();
    pendingSubmitId=form.dataset.editingReservationId||'';
    setTimeout(patchSavedNetValues,80);
  },true);

  function setupFinanceMarkup(){
    financeSection.innerHTML=`
      <div class="commitments-head commitments-head-simple">
        <div>
          <p class="eyebrow">CONTROLE MENSAL</p>
          <h2>Compromissos</h2>
          <p>Veja quanto de NET ainda precisa ser pago e quanto realmente precisa sair do caixa da Jeri Rota em cada mês.</p>
        </div>
      </div>

      <section class="commitment-month-overview" aria-labelledby="commitmentMonthOverviewTitle">
        <div class="commitment-month-overview-head">
          <div>
            <p class="eyebrow">VISÃO RÁPIDA</p>
            <h3 id="commitmentMonthOverviewTitle">Quanto precisa sair do caixa</h3>
          </div>
          <small>NET pendente menos o saldo que os clientes ainda vão pagar</small>
        </div>
        <div id="commitmentMonthCards" class="commitment-month-grid"></div>
      </section>

      <article id="commitmentDetailPanel" class="panel commitments-panel commitments-detail-panel" hidden>
        <div class="panel-head commitments-detail-head">
          <div>
            <p class="eyebrow">DETALHAMENTO</p>
            <h3 id="commitmentDetailTitle">Compromissos do mês</h3>
            <p>O NET mostra tudo que ainda será pago. O valor a cobrir considera apenas o que não será coberto pelo saldo futuro dos clientes.</p>
          </div>
          <div class="commitment-detail-actions">
            <label><span>Buscar neste mês</span><input id="commitmentSearch" type="search" placeholder="Cliente, reserva ou serviço"></label>
            <button type="button" id="commitmentCloseDetail" class="commitment-close-detail">Ocultar detalhes</button>
          </div>
        </div>

        <input id="commitmentMonth" type="hidden" value="">

        <div class="commitment-detail-summary">
          <div><span>NET total pendente</span><strong id="commitmentNetTotal">R$ 0,00</strong></div>
          <div><span>Saldo futuro dos clientes</span><strong id="commitmentClientTotal">R$ 0,00</strong></div>
          <div class="company"><span>Empresa precisa cobrir</span><strong id="commitmentCompanyTotal">R$ 0,00</strong></div>
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Reserva / Cliente</th><th>Serviço</th><th>NET a pagar</th><th>Saldo do cliente usado</th><th>Empresa cobre</th><th></th></tr></thead>
            <tbody id="commitmentTable"></tbody>
          </table>
        </div>
        <div class="commitments-note"><strong>Regra:</strong> empresa cobre = NET pendente − saldo que o cliente ainda vai pagar. O saldo do cliente é utilizado uma única vez, seguindo a ordem das datas dos serviços. Se a reserva já estiver totalmente recebida, o NET pendente fica integralmente como valor a cobrir.</div>
      </article>

      <div class="finance-legacy-hooks" aria-hidden="true"><strong id="financeReceived"></strong><strong id="financePending"></strong><strong id="financeTotal"></strong><table><tbody id="financeTable"></tbody></table></div>`;

    document.getElementById('commitmentMonthCards')?.addEventListener('click',event=>{
      const card=event.target.closest?.('[data-commitment-month]');
      if(!card)return;
      selectedMonth=card.dataset.commitmentMonth;
      const search=document.getElementById('commitmentSearch');
      if(search)search.value='';
      renderCommitments();
      setTimeout(()=>document.getElementById('commitmentDetailPanel')?.scrollIntoView({behavior:'smooth',block:'start'}),40);
    });
    document.getElementById('commitmentCloseDetail')?.addEventListener('click',()=>{
      selectedMonth=null;
      renderCommitments();
    });
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
      const net=storedNet(service);
      if(!reservation||net<=0||isPaid(service.repasseStatus))return;
      const key=String(reservation.id);
      if(!servicesByReservation.has(key))servicesByReservation.set(key,[]);
      servicesByReservation.get(key).push(service);
    });

    const rows=[];
    reservations.forEach(reservation=>{
      const linked=(servicesByReservation.get(String(reservation.id))||[])
        .sort((a,b)=>String(serviceOperationalDate(a)||'9999-12-31').localeCompare(String(serviceOperationalDate(b)||'9999-12-31'))||(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0));
      if(!linked.length)return;

      /* Regra financeira: apenas o saldo ainda a receber do cliente reduz o que a empresa precisa cobrir. */
      let customerBalance=Math.max(0,number(reservation.amount)-number(reservation.paidAmount));
      linked.forEach(service=>{
        const net=storedNet(service);
        const clientContribution=Math.min(customerBalance,net);
        const companyCover=Math.max(0,net-clientContribution);
        customerBalance=Math.max(0,customerBalance-clientContribution);
        rows.push({reservation,service,operationalDate:serviceOperationalDate(service),net,clientContribution,companyCover});
      });
    });
    return rows;
  }

  function groupByMonth(rows){
    const groups=new Map();
    rows.forEach(row=>{
      const month=monthOf(row.operationalDate);
      if(!/^\d{4}-\d{2}$/.test(month))return;
      if(!groups.has(month))groups.set(month,{month,rows:[],net:0,client:0,company:0});
      const group=groups.get(month);
      group.rows.push(row);
      group.net+=row.net;
      group.client+=row.clientContribution;
      group.company+=row.companyCover;
    });
    return [...groups.values()].sort((a,b)=>a.month.localeCompare(b.month));
  }

  function renderMonthCards(groups){
    const host=document.getElementById('commitmentMonthCards');
    if(!host)return;
    if(!groups.length){
      host.innerHTML='<div class="commitment-month-empty"><strong>Nenhum NET pendente.</strong><p>Quando houver compromissos nas reservas, os meses aparecerão aqui automaticamente.</p></div>';
      return;
    }
    host.innerHTML=groups.map(group=>`
      <button type="button" class="commitment-month-card${selectedMonth===group.month?' active':''}" data-commitment-month="${escape(group.month)}" aria-expanded="${selectedMonth===group.month?'true':'false'}">
        <span class="commitment-month-name">${escape(formatMonth(group.month))}</span>
        <small>Empresa precisa cobrir</small>
        <strong>${money.format(group.company)}</strong>
        <span class="commitment-month-count">NET pendente ${money.format(group.net)} · ${group.rows.length} compromisso${group.rows.length===1?'':'s'}</span>
      </button>`).join('');
  }

  function renderCommitments(){
    const allRows=buildPendingCommitments();
    const groups=groupByMonth(allRows);
    renderMonthCards(groups);

    const panel=document.getElementById('commitmentDetailPanel');
    if(!panel)return;
    if(!selectedMonth){
      panel.hidden=true;
      return;
    }

    panel.hidden=false;
    const hiddenMonth=document.getElementById('commitmentMonth');
    if(hiddenMonth)hiddenMonth.value=selectedMonth;
    const title=document.getElementById('commitmentDetailTitle');
    if(title)title.textContent=`Compromissos de ${formatMonth(selectedMonth)}`;

    const monthRows=allRows.filter(row=>monthOf(row.operationalDate)===selectedMonth);
    const query=(document.getElementById('commitmentSearch')?.value||'').trim().toLowerCase();
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
        <td>${formatDate(row.operationalDate)}</td>
        <td><strong>${escape(row.reservation.reservationCode||'Reserva')}</strong><small>${escape(row.reservation.client||'Cliente')}</small></td>
        <td><strong>${escape(serviceName(row.service))}</strong></td>
        <td><strong>${money.format(row.net)}</strong></td>
        <td><strong class="commitment-client-value">${money.format(row.clientContribution)}</strong></td>
        <td><strong class="commitment-company-value">${money.format(row.companyCover)}</strong></td>
        <td class="row-actions"><button type="button" class="commitment-paid-button" data-commitment-service="${escape(serviceKey)}" data-commitment-reservation="${escape(row.service.reservationId)}">Marcar como pago</button></td>
      </tr>`;
    }).join(''):`<tr><td colspan="7"><div class="empty-state"><strong>Nenhum compromisso pendente neste mês.</strong><p>O mês pode ter sido totalmente pago ou o filtro não encontrou resultados.</p></div></td></tr>`;
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
  installServiceObserver();
  injectNetFields();
  renderCommitments();
})();