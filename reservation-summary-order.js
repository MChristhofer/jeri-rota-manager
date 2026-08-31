(function(){
  function itemByLabel(summary,label){
    return [...summary.querySelectorAll('.reservation-payment-item')].find(item=>String(item.querySelector('span')?.textContent||'').trim().toLowerCase()===label);
  }
  function reorder(){
    const summary=document.querySelector('.reservation-sale-total');
    if(!summary)return;
    const net=document.getElementById('reservationServicesNetTotal')?.closest('.reservation-payment-item');
    const received=itemByLabel(summary,'valor recebido');
    const balance=itemByLabel(summary,'saldo a receber');
    const total=itemByLabel(summary,'valor total da reserva');
    [net,received,balance,total].filter(Boolean).forEach(item=>summary.appendChild(item));
    const feedback=document.getElementById('reservationPaymentFeedback');
    if(feedback)summary.appendChild(feedback);
    document.getElementById('reservationCompanyCoverLive')?.remove();
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(reorder));
  const timer=setInterval(()=>{
    const summary=document.querySelector('.reservation-sale-total');
    if(!summary)return;
    clearInterval(timer);
    observer.observe(summary,{childList:true,subtree:true});
    reorder();
  },80);

  window.addEventListener('reservation-finance-refresh',reorder);
})();
