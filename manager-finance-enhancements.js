(function(){
  if(window.__jeriFinanceEnhanced)return;window.__jeriFinanceEnhanced=true;
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const read=key=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function servicesFor(reservationId){return read(SERVICES_KEY).filter(s=>String(s.reservationId)===String(reservationId))}
  function netFor(reservationId){return servicesFor(reservationId).reduce((sum,s)=>{const ida=Number(s.netTotal??s.repasseAmount)||0;const volta=s.roundTripSameMode?(Number(s.returnRepasseAmount)||0):0;return sum+ida+volta},0)}
  function paymentStatus(r){const total=Number(r.amount)||0,paid=Math.min(Number(r.paidAmount)||0,total||Infinity);if(total>0&&paid>=total)return{label:'Quitado',className:'pago'};if(paid>0)return{label:'Parcial',className:'parcial'};return{label:'Pendente',className:'sem-pagamento'}}

  function inject(){
    const section=document.getElementById('financeiro');if(!section)return;
    const heading=section.querySelector('.section-heading p:last-child');if(heading)heading.textContent='Acompanhe recebimentos, saldos de clientes, NET dos serviços e resultado estimado por reserva.';
    const grid=section.querySelector('.finance-grid');
    const received=grid?.querySelector('.received-card');if(received){received.querySelector('p').textContent='Recebido de clientes';received.querySelector('span').textContent='Total já recebido nas reservas'}
    const pending=grid?.querySelector('.pending-card');if(pending){pending.querySelector('p').textContent='Falta receber';pending.querySelector('span').textContent='Saldo ainda pendente dos clientes'}
    const total=grid?.querySelector('.total-card');if(total){total.querySelector('p').textContent='Total vendido';total.querySelector('span').textContent='Valor comercial das reservas ativas'}
    if(grid&&!document.getElementById('financeNetCard'))grid.insertAdjacentHTML('beforeend','<article class="finance-card finance-net-card" id="financeNetCard"><p>NET dos serviços</p><strong id="financeNetTotal">R$ 0,00</strong><span>Custo operacional previsto</span></article><article class="finance-card finance-margin-card" id="financeMarginCard"><p>Margem estimada</p><strong id="financeMarginTotal">R$ 0,00</strong><span>Total vendido menos NET</span></article>');

    const panel=section.querySelector('.table-panel');if(panel&&!document.getElementById('financeControlBar')){
      panel.insertAdjacentHTML('beforebegin','<div class="finance-control-bar" id="financeControlBar"><input id="financeSearch" type="search" placeholder="Buscar reserva ou cliente"><select id="financeSituation"><option value="">Todas as situações</option><option value="open">Com valor a receber</option><option value="paid">Quitadas</option></select><button type="button" class="outline-button" id="financeClear">Limpar</button></div>');
      document.getElementById('financeSearch')?.addEventListener('input',render);
      document.getElementById('financeSituation')?.addEventListener('change',render);
      document.getElementById('financeClear')?.addEventListener('click',()=>{document.getElementById('financeSearch').value='';document.getElementById('financeSituation').value='';render()});
    }
    const thead=panel?.querySelector('thead');if(thead)thead.innerHTML='<tr><th>Reserva / cliente</th><th>Total</th><th>Recebido</th><th>Falta receber</th><th>NET</th><th>Margem estimada</th><th>Situação</th><th></th></tr>';
    panel?.querySelector('tbody')?.addEventListener('click',e=>{const btn=e.target.closest('[data-finance-reservation]');if(!btn)return;const id=Number(btn.dataset.financeReservation);if(typeof window.openModal==='function')window.openModal(id);else try{openModal(id)}catch{}});
  }

  function render(){
    inject();const list=read(RESERVATIONS_KEY).filter(r=>r.status!=='Cancelada');const query=(document.getElementById('financeSearch')?.value||'').trim().toLowerCase();const situation=document.getElementById('financeSituation')?.value||'';
    const totals=list.reduce((acc,r)=>{const total=Number(r.amount)||0,paid=Math.min(Number(r.paidAmount)||0,total||Infinity),open=Math.max(0,total-paid),net=netFor(r.id);acc.total+=total;acc.paid+=paid;acc.open+=open;acc.net+=net;return acc},{total:0,paid:0,open:0,net:0});
    const receivedEl=document.getElementById('financeReceived'),pendingEl=document.getElementById('financePending'),totalEl=document.getElementById('financeTotal');if(receivedEl)receivedEl.textContent=money(totals.paid);if(pendingEl)pendingEl.textContent=money(totals.open);if(totalEl)totalEl.textContent=money(totals.total);if(document.getElementById('financeNetTotal'))document.getElementById('financeNetTotal').textContent=money(totals.net);if(document.getElementById('financeMarginTotal'))document.getElementById('financeMarginTotal').textContent=money(totals.total-totals.net);

    const filtered=list.filter(r=>{const total=Number(r.amount)||0,paid=Math.min(Number(r.paidAmount)||0,total||Infinity),open=Math.max(0,total-paid);const text=[r.reservationCode,r.client,r.phone,r.service].filter(Boolean).join(' ').toLowerCase();return(!query||text.includes(query))&&(!situation||(situation==='open'?open>0:open<=0))}).sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));
    const tbody=document.getElementById('financeTable');if(!tbody)return;
    if(!filtered.length){tbody.innerHTML='<tr><td colspan="8"><div class="empty-state"><strong>Nenhuma reserva encontrada.</strong><p>Ajuste os filtros para consultar outros lançamentos.</p></div></td></tr>';return}
    tbody.innerHTML=filtered.map(r=>{const total=Number(r.amount)||0,paid=Math.min(Number(r.paidAmount)||0,total||Infinity),open=Math.max(0,total-paid),net=netFor(r.id),margin=total-net,status=paymentStatus(r);return `<tr><td><strong>${esc(r.reservationCode||'Reserva')}</strong><small>${esc(r.client||'Cliente')} · ${esc(r.service||'Serviço')}</small></td><td><strong>${money(total)}</strong></td><td>${money(paid)}<small>${esc(r.collectedBy||'Não informado')}</small></td><td><strong class="${open>0?'finance-open-value':''}">${money(open)}</strong></td><td>${money(net)}</td><td><strong>${money(margin)}</strong></td><td><span class="status ${status.className}">${status.label}</span></td><td><button type="button" class="edit-button" data-finance-reservation="${esc(r.id)}">Ver reserva</button></td></tr>`}).join('');
  }

  const baseRenderFinance=window.renderFinance;
  if(typeof baseRenderFinance==='function'){
    window.renderFinance=function(){baseRenderFinance();render()};
    try{renderFinance=window.renderFinance}catch{}
  }
  document.querySelector('.nav-item[data-section="financeiro"]')?.addEventListener('click',()=>setTimeout(render,0));
  window.addEventListener('storage',render);window.addEventListener('jeri:cloud-ready',render);window.addEventListener('reservation-finance-refresh',render);
  inject();render();
})();