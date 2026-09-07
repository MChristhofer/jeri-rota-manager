(function(root){
  const number=value=>{
    const raw=String(value??'').trim().replace(/\s|R\$/g,'');
    const parsed=Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw);
    return Number.isFinite(parsed)?Math.max(0,parsed):0;
  };
  const cents=value=>Math.round(number(value)*100);
  const shared=modality=>/^compartilhado$/i.test(String(modality||'').trim());
  const basis=modality=>shared(modality)?'per_person':'fixed';
  const serviceNet=(unit,modality,people)=>Math.round(cents(unit)*(shared(modality)?Math.max(1,number(people)):1))/100;
  function storedNet(service){
    if(service?.repasseAmount!=null)return number(service.repasseAmount);
    if(service?.netTotal!=null)return number(service.netTotal);
    let modality=service?.modality;
    if(!modality&&String(service?.responsible||'').startsWith('JR_OP_V1:')){
      try{modality=JSON.parse(decodeURIComponent(service.responsible.slice(9))).modality}catch{}
    }
    return serviceNet(service?.netUnit,modality,service?.quantity);
  }
  const total=values=>values.reduce((sum,value)=>sum+cents(value),0)/100;
  const balance=(sale,received)=>Math.max(0,cents(sale)-cents(received))/100;
  const companyCover=(net,remaining)=>Math.max(0,cents(net)-cents(remaining))/100;
  function reservation(sale,received,nets){
    const netTotal=total(nets),remaining=balance(sale,received);
    return{netTotal,balance:remaining,companyCover:companyCover(netTotal,remaining)};
  }
  // Preserve the existing service-date allocation: consume each reservation's
  // future balance once, in chronological order, including already paid NETs.
  function commitments(reservations,services){
    return reservations.filter(r=>r.status!=='Cancelada').flatMap(r=>{
      let remaining=balance(r.amount,r.paidAmount);
      return services.filter(s=>String(s.reservationId)===String(r.id))
        .slice().sort((a,b)=>String(a.date||a.returnDate||'9999').localeCompare(String(b.date||b.returnDate||'9999'))||(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0))
        .map(service=>{
          const net=storedNet(service),cover=companyCover(net,remaining);
          const clientContribution=balance(net,cover);
          remaining=balance(remaining,clientContribution);
          return{reservation:r,service,operationalDate:service.date||service.returnDate||'',net,clientContribution,companyCover:cover};
        });
    });
  }
  const api={number,shared,basis,serviceNet,storedNet,total,balance,companyCover,reservation,commitments};
  root.JeriFinance=Object.freeze(api);
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
