(function(){
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const parse=value=>{
    const raw=String(value??'').trim().replace(/\s|R\$/g,'');
    if(!raw)return 0;
    return Math.max(0,Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw)||0);
  };

  function calculate(){
    const total=parse(document.getElementById('reservationTotalAmount')?.value);
    const received=parse(document.getElementById('reservationReceivedAmount')?.value);
    const balance=Math.max(0,total-received);
    const net=[...document.querySelectorAll('#reservationServiceDrafts [data-basic-net-input]')]
      .reduce((sum,input)=>sum+parse(input.value),0);
    const companyCover=Math.max(0,net-balance);
    return{total,received,balance,net,companyCover};
  }

  function render(){
    const feedback=document.getElementById('reservationPaymentFeedback');
    if(!feedback)return;
    const values=calculate();
    let line=document.getElementById('reservationCompanyCoverLive');
    if(!line){
      line=document.createElement('span');
      line.id='reservationCompanyCoverLive';
      line.style.display='block';
      line.style.marginTop='5px';
      line.style.fontWeight='700';
      line.style.color='#8a6117';
      feedback.insertAdjacentElement('afterend',line);
    }
    line.textContent=values.net>0
      ?`Empresa precisa cobrir ${money.format(values.companyCover)} deste NET. Saldo futuro do cliente considerado: ${money.format(Math.min(values.balance,values.net))}.`
      :'Informe os NETs dos serviços para calcular quanto a empresa precisa cobrir.';
  }

  document.addEventListener('input',event=>{
    if(event.target.matches?.('#reservationTotalAmount,#reservationReceivedAmount,[data-basic-net-input]'))render();
  },true);
  document.addEventListener('change',event=>{
    if(event.target.matches?.('#reservationTotalAmount,#reservationReceivedAmount,[data-basic-net-input]'))render();
  },true);
  window.addEventListener('reservation-finance-refresh',render);

  const observer=new MutationObserver(()=>requestAnimationFrame(render));
  const timer=setInterval(()=>{
    const host=document.getElementById('reservationServiceDrafts');
    if(!host)return;
    clearInterval(timer);
    observer.observe(host,{childList:true,subtree:true});
    render();
  },80);
})();
