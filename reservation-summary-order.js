(function(){
  function reorder(){
    const summary=document.querySelector('.reservation-sale-total');
    const net=document.getElementById('reservationServicesNetTotal')?.closest('.reservation-payment-item');
    if(!summary||!net)return;
    const first=summary.querySelector('.reservation-payment-item');
    if(first!==net)summary.insertBefore(net,first||summary.firstChild);
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
