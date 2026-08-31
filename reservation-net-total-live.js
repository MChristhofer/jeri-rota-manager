(function(){
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const parse=value=>{
    const raw=String(value??'').trim().replace(/\s|R\$/g,'');
    if(!raw)return 0;
    return Math.max(0,Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw)||0);
  };

  function visibleNetInputs(){
    return [...document.querySelectorAll('#reservationServiceDrafts [data-basic-net-input]')]
      .filter(input=>!input.disabled&&input.offsetParent!==null);
  }

  function calculate(){
    return visibleNetInputs().reduce((sum,input)=>sum+parse(input.value),0);
  }

  function render(){
    const output=document.getElementById('reservationServicesNetTotal');
    if(!output)return;
    const total=calculate();
    const formatted=money.format(total);
    if(output.textContent!==formatted)output.textContent=formatted;
  }

  document.addEventListener('input',event=>{
    if(event.target.matches?.('#reservationServiceDrafts [data-basic-net-input]'))requestAnimationFrame(render);
  },true);
  document.addEventListener('change',event=>{
    if(event.target.matches?.('#reservationServiceDrafts [data-basic-net-input]'))requestAnimationFrame(render);
  },true);
  window.addEventListener('reservation-finance-refresh',()=>requestAnimationFrame(render));

  const hostTimer=setInterval(()=>{
    const host=document.getElementById('reservationServiceDrafts');
    const output=document.getElementById('reservationServicesNetTotal');
    if(!host||!output)return;
    clearInterval(hostTimer);

    const hostObserver=new MutationObserver(()=>requestAnimationFrame(render));
    hostObserver.observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['value','disabled']});

    const outputObserver=new MutationObserver(()=>{
      const expected=money.format(calculate());
      if(output.textContent!==expected)requestAnimationFrame(render);
    });
    outputObserver.observe(output,{childList:true,subtree:true,characterData:true});

    render();
  },60);
})();
