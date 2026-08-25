(function(){
  const raw=sessionStorage.getItem('jeri-rota-repasse-from-reservation');
  if(!raw)return;
  let payload;try{payload=JSON.parse(raw)}catch{return}
  const phones=Array.isArray(payload.phones)&&payload.phones.length?payload.phones:(payload.phone?[{phone:payload.phone,phoneCountry:'br'}]:[]);
  if(!phones.length)return;

  function setWithIti(input,data){
    if(!input)return;
    const iti=window.intlTelInput?.getInstance?.(input);
    try{
      if(iti){
        if(data.phoneE164)iti.setNumber(data.phoneE164);
        else{iti.setCountry(data.phoneCountry||'br');iti.setNumber(data.phone||'')}
      }else input.value=data.phone||'';
    }catch{input.value=data.phone||''}
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function apply(){
    const primary=document.getElementById('phoneInput');
    const add=document.getElementById('addPhoneButton');
    if(!primary||!add)return false;
    document.querySelectorAll('.extra-phone-row .remove-phone-button').forEach(b=>b.click());
    setWithIti(primary,phones[0]||{});
    phones.slice(1).forEach((phone,index)=>{
      add.click();
      setTimeout(()=>{
        const inputs=document.querySelectorAll('.extra-phone-input');
        const input=inputs[inputs.length-1];
        setWithIti(input,phone);
        if(index===phones.length-2&&typeof updatePreview==='function')updatePreview();
      },60*(index+1));
    });
    if(phones.length===1&&typeof updatePreview==='function')updatePreview();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries+=1;if(apply()||tries>30)clearInterval(timer)},100);
})();