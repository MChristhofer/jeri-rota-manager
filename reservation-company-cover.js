(function(){
  function cleanup(){document.getElementById('reservationCompanyCoverLive')?.remove()}
  function loadScript(src){
    if(document.querySelector(`script[src^="${src}"]`))return;
    const script=document.createElement('script');
    script.src=`${src}?v=20260831-3`;
    document.body.appendChild(script);
  }
  loadScript('reservation-summary-order.js');
  loadScript('finance-binary-cover.js');
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
