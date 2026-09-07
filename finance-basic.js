(function(){
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const dateFmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const monthFmt=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'});
  const form=document.getElementById('reservationForm');
  const financeSection=document.getElementById('financeiro');
  if(!form||!financeSection)return;

  let selectedMonth=null;

  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const escape=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const monthOf=value=>String(value||'').slice(0,7);
  const isPaid=status=>/^(pago|quitado|repassado|realizado)$/i.test(String(status||'').trim());
  const serviceName=service=>service.title||service.service||service.tour||'Serviço';
  const formatDate=value=>{if(!value)return'—';const date=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(date.getTime())?String(value):dateFmt.format(date)};
  const formatMonth=value=>{
    const [year,month]=String(value||'').split('-').map(Number);
    if(!year||!month)return'Período';
    const label=monthFmt.format(new Date(year,month-1,1,12));
    return label.charAt(0).toUpperCase()+label.slice(1);
  };

  function setupFinanceMarkup(){
    financeSection.innerHTML=`
      <div class="commitments-head commitments-head-simple">
        <div>
          <p class="eyebrow">CONTROLE MENSAL</p>
          <h2>Compromissos</h2>
        </div>
      </div>

      <section class="commitment-month-overview" aria-labelledby="commitmentMonthOverviewTitle">
        <div class="commitment-month-overview-head">
          <div>
            <p class="eyebrow">VISÃO RÁPIDA</p>
            <h3 id="commitmentMonthOverviewTitle">Quanto precisa sair do caixa</h3>
          </div>
          <small>NET total menos o saldo que os clientes ainda vão pagar</small>
        </div>
        <div id="commitmentMonthCards" class="commitment-month-grid"></div>
      </section>

      <article id="commitmentDetailPanel" class="panel commitments-panel commitments-detail-panel" hidden>
        <div class="panel-head commitments-detail-head">
          <div>
            <p class="eyebrow">DETALHAMENTO</p>
            <h3 id="commitmentDetailTitle">Compromissos do mês</h3>
          </div>
          <div class="commitment-detail-actions">
            <label><span>Buscar neste mês</span><input id="commitmentSearch" type="search" placeholder="Cliente, reserva ou serviço"></label>
            <button type="button" id="commitmentCloseDetail" class="commitment-close-detail">Ocultar detalhes</button>
          </div>
        </div>

        <input id="commitmentMonth" type="hidden" value="">

        <div class="commitment-detail-summary">
          <div><span>NET total do mês</span><strong id="commitmentNetTotal">R$ 0,00</strong></div>
          <div><span>Saldo futuro dos clientes</span><strong id="commitmentClientTotal">R$ 0,00</strong></div>
          <div class="company"><span>Empresa precisa cobrir</span><strong id="commitmentCompanyTotal">R$ 0,00</strong></div>
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Reserva / Cliente</th><th>Serviço</th><th>NET contratado</th><th>Saldo do cliente usado</th><th>Empresa cobre</th><th></th></tr></thead>
            <tbody id="commitmentTable"></tbody>
          </table>
        </div>
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
    return window.JeriFinance.commitments(read(RESERVATIONS_KEY),read(SERVICES_KEY));
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
      host.innerHTML='<div class="commitment-month-empty"><strong>Nenhum NET contratado.</strong><p>Quando houver compromissos nas reservas, os meses aparecerão aqui automaticamente.</p></div>';
      return;
    }
    host.innerHTML=groups.map(group=>`
      <button type="button" class="commitment-month-card${selectedMonth===group.month?' active':''}" data-commitment-month="${escape(group.month)}" aria-expanded="${selectedMonth===group.month?'true':'false'}">
        <span class="commitment-month-name">${escape(formatMonth(group.month))}</span>
        <small>Empresa precisa cobrir</small>
        <strong>${money.format(group.company)}</strong>
        <span class="commitment-month-count">NET total ${money.format(group.net)} · ${group.rows.length} compromisso${group.rows.length===1?'':'s'}</span>
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

    const netTotal=window.JeriFinance.total(monthRows.map(row=>row.net));
    const clientTotal=window.JeriFinance.total(monthRows.map(row=>row.clientContribution));
    const companyTotal=window.JeriFinance.total(monthRows.map(row=>row.companyCover));
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
        <td class="row-actions"><button type="button" class="commitment-paid-button" ${isPaid(row.service.repasseStatus)?'disabled':''} data-commitment-service="${escape(serviceKey)}" data-commitment-reservation="${escape(row.service.reservationId)}">${isPaid(row.service.repasseStatus)?'Pago':'Marcar como pago'}</button></td>
      </tr>`;
    }).join(''):`<tr><td colspan="7"><div class="empty-state"><strong>Nenhum compromisso neste mês.</strong></div></td></tr>`;
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
  wrapRenderAll();
  window.addEventListener('reservation-finance-refresh',renderCommitments);
  window.addEventListener('storage',renderCommitments);
  renderCommitments();
})();
