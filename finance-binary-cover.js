(function(){
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const number=value=>{const raw=String(value??0).trim().replace(/\s|R\$/g,'');if(!raw)return 0;return Math.max(0,Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw)||0)};
  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const operationalDate=service=>service?.date||service?.returnDate||'';
  const monthOf=value=>String(value||'').slice(0,7);
  const isPaid=status=>/^(pago|quitado|repassado|realizado)$/i.test(String(status||'').trim());
  const storedNet=service=>{
    const repasse=number(service?.repasseAmount);
    const total=number(service?.netTotal);
    const unit=number(service?.netUnit);
    const quantity=Math.max(1,number(service?.quantity)||1);
    if(repasse>0)return repasse;
    if(total>0)return total;
    if(unit>0)return unit*quantity;
    return 0;
  };

  function data(){
    const reservations=read(RESERVATIONS_KEY).filter(r=>r.status!=='Cancelada');
    const reservationMap=new Map(reservations.map(r=>[String(r.id),r]));
    const rows=[];
    read(SERVICES_KEY).forEach(service=>{
      const reservation=reservationMap.get(String(service.reservationId));
      const net=storedNet(service);
      if(!reservation||net<=0||isPaid(service.repasseStatus))return;
      const balance=Math.max(0,number(reservation.amount)-number(reservation.paidAmount));
      rows.push({
        reservation,
        service,
        net,
        balance,
        companyCover:balance<=0?net:0,
        month:monthOf(operationalDate(service))
      });
    });
    return rows;
  }

  function updateTexts(){
    const overview=document.querySelector('.commitment-month-overview-head small');
    if(overview)overview.textContent='O NET só entra como valor da empresa quando o saldo a receber da reserva estiver zerado.';
    const detail=document.querySelector('.commitments-detail-head p:not(.eyebrow)');
    if(detail)detail.textContent='NET total pendente por mês. A empresa só assume o NET das reservas que já estão totalmente recebidas.';
    const note=document.querySelector('.commitments-note');
    if(note)note.innerHTML='<strong>Regra:</strong> se a reserva ainda tem saldo a receber, o NET não entra em “Empresa precisa cobrir”. Quando o saldo a receber chega a R$ 0,00, 100% do NET pendente passa a ser responsabilidade da empresa.';
    const clientLabel=document.querySelector('#commitmentClientTotal')?.previousElementSibling;
    if(clientLabel)clientLabel.textContent='Saldo ainda a receber';
  }

  function selectedMonth(){return document.getElementById('commitmentMonth')?.value||null}

  function updateMonthCards(rows){
    document.querySelectorAll('[data-commitment-month]').forEach(card=>{
      const month=card.dataset.commitmentMonth;
      const monthRows=rows.filter(row=>row.month===month);
      const company=monthRows.reduce((sum,row)=>sum+row.companyCover,0);
      const net=monthRows.reduce((sum,row)=>sum+row.net,0);
      const strong=card.querySelector('strong');
      const count=card.querySelector('.commitment-month-count');
      if(strong)strong.textContent=money.format(company);
      if(count)count.textContent=`NET pendente ${money.format(net)} · ${monthRows.length} compromisso${monthRows.length===1?'':'s'}`;
    });
  }

  function updateDetail(rows){
    const month=selectedMonth();
    if(!month)return;
    const monthRows=rows.filter(row=>row.month===month);
    const netTotal=monthRows.reduce((sum,row)=>sum+row.net,0);
    const companyTotal=monthRows.reduce((sum,row)=>sum+row.companyCover,0);
    const uniqueReservations=new Map();
    monthRows.forEach(row=>uniqueReservations.set(String(row.reservation.id),row.reservation));
    const receivable=[...uniqueReservations.values()].reduce((sum,r)=>sum+Math.max(0,number(r.amount)-number(r.paidAmount)),0);
    const netNode=document.getElementById('commitmentNetTotal');
    const clientNode=document.getElementById('commitmentClientTotal');
    const companyNode=document.getElementById('commitmentCompanyTotal');
    if(netNode)netNode.textContent=money.format(netTotal);
    if(clientNode)clientNode.textContent=money.format(receivable);
    if(companyNode)companyNode.textContent=money.format(companyTotal);

    document.querySelectorAll('#commitmentTable tr').forEach(tr=>{
      const button=tr.querySelector('[data-commitment-reservation]');
      if(!button)return;
      const reservationId=String(button.dataset.commitmentReservation);
      const serviceId=String(button.dataset.commitmentService||'');
      const row=monthRows.find(item=>String(item.service.reservationId)===reservationId&&String(item.service.id||item.service.sourceKey||'')===serviceId);
      if(!row)return;
      const cells=tr.querySelectorAll('td');
      if(cells[4])cells[4].innerHTML=`<strong class="commitment-client-value">${row.balance>0?money.format(row.balance):money.format(0)}</strong>`;
      if(cells[5])cells[5].innerHTML=`<strong class="commitment-company-value">${money.format(row.companyCover)}</strong>`;
    });
  }

  function apply(){
    updateTexts();
    const rows=data();
    updateMonthCards(rows);
    updateDetail(rows);
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(apply));
  const timer=setInterval(()=>{
    const finance=document.getElementById('financeiro');
    if(!finance)return;
    clearInterval(timer);
    observer.observe(finance,{childList:true,subtree:true});
    apply();
  },100);
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-commitment-month],#commitmentCloseDetail,[data-commitment-service]'))setTimeout(apply,30)},true);
  window.addEventListener('storage',apply);
  window.addEventListener('reservation-finance-refresh',apply);
})();
