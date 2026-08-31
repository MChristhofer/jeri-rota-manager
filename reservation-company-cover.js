(function(){
  function cleanup(){document.getElementById('reservationCompanyCoverLive')?.remove()}
  document.addEventListener('input',cleanup,true);
  document.addEventListener('change',cleanup,true);
  window.addEventListener('reservation-finance-refresh',cleanup);
  const observer=new MutationObserver(()=>requestAnimationFrame(cleanup));
  const timer=setInterval(()=>{
    const summary=document.querySelector('.reservation-sale-total');
    if(!summary)return;
    clearInterval(timer);
    observer.observe(summary,{childList:true,subtree:true});
    cleanup();
  },80);
})();
