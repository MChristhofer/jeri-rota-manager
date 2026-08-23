(function(){
  const primaryInput=phoneInput;
  const primaryIti=phoneIti;
  const primaryHelp=document.getElementById('phoneHelp');
  const peopleLabel=document.getElementById('peopleInput')?.closest('label');
  if(!primaryInput||!peopleLabel)return;

  const tools=document.createElement('div');
  tools.className='multi-phone-tools';
  tools.innerHTML=`<div class="multi-phone-header"><span>Você pode adicionar outros telefones deste mesmo repasse.</span><button class="add-phone-button" id="addPhoneButton" type="button">+ Adicionar telefone</button></div><div class="extra-phone-list" id="extraPhoneList"></div>`;
  peopleLabel.insertAdjacentElement('afterend',tools);

  const list=document.getElementById('extraPhoneList');
  const addButton=document.getElementById('addPhoneButton');
  const extras=[];
  let extraCounter=0;

  function itiOptions(){
    return{
      initialCountry:'br',
      countryOrder:['br','us','ar','pt','gb','fr','es','it','de'],
      countryNameLocale:'pt-BR',
      numberDisplayFormat:'NATIONAL',
      formatAsYouType:true,
      strictMode:true,
      loadUtils:()=>import('https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.0/dist/js/utils.js')
    };
  }

  function infoFrom(input,iti){
    const raw=input.value.trim();
    const selected=iti?.getSelectedCountryData?.()||{iso2:'br'};
    let phone=raw;
    let phoneE164='';
    if(iti&&raw){
      try{
        phoneE164=iti.getNumber('E164')||'';
        const formatted=iti.getNumber(selected.iso2==='br'?'NATIONAL':'INTERNATIONAL');
        if(formatted)phone=formatted;
      }catch{}
    }
    return{phone,phoneE164,phoneCountry:selected.iso2||''};
  }

  function setPhone(input,iti,data){
    const phoneData=data||{};
    if(iti){
      if(phoneData.phoneE164)iti.setNumber(phoneData.phoneE164);
      else{
        iti.setCountry(phoneData.phoneCountry||'br');
        iti.setNumber(phoneData.phone||'');
      }
    }else input.value=phoneData.phone||'';
  }

  function removeExtra(entry){
    const index=extras.indexOf(entry);
    if(index>=0)extras.splice(index,1);
    try{entry.iti?.destroy?.()}catch{}
    entry.row.remove();
    updatePreview();
  }

  function addExtraPhone(data={}){
    extraCounter+=1;
    const row=document.createElement('div');
    row.className='extra-phone-row';
    row.innerHTML=`<div class="extra-phone-field"><span>Telefone adicional ${extras.length+1}</span><input class="extra-phone-input" type="tel" inputmode="tel" autocomplete="tel" placeholder="(85) 99999-9999"><small class="extra-phone-help">Brasil selecionado por padrão.</small></div><button class="remove-phone-button" type="button">Remover</button>`;
    list.appendChild(row);
    const input=row.querySelector('.extra-phone-input');
    const help=row.querySelector('.extra-phone-help');
    const remove=row.querySelector('.remove-phone-button');
    const iti=window.intlTelInput?window.intlTelInput(input,itiOptions()):null;
    const entry={id:extraCounter,row,input,help,iti};
    extras.push(entry);
    setPhone(input,iti,data);
    input.addEventListener('input',updatePreview);
    input.addEventListener('change',updatePreview);
    input.addEventListener('countrychange',()=>{
      const country=iti?.getSelectedCountryData?.();
      help.textContent=country?.name?`${country.name} selecionado. Digite o número no formato local.`:'Digite o telefone.';
      help.classList.remove('phone-invalid','phone-valid');
      updatePreview();
    });
    remove.addEventListener('click',()=>removeExtra(entry));
    setTimeout(()=>input.focus(),50);
    updatePreview();
    return entry;
  }

  function clearExtras(){
    [...extras].forEach(entry=>removeExtra(entry));
  }

  function allPhones(){
    const result=[];
    const primary=infoFrom(primaryInput,primaryIti);
    if(primary.phone)result.push(primary);
    extras.forEach(entry=>{
      const info=infoFrom(entry.input,entry.iti);
      if(info.phone)result.push(info);
    });
    return result;
  }

  async function validateEntry(input,iti,help,isPrimary){
    if(iti?.promise){try{await iti.promise}catch{}}
    const raw=input.value.trim();
    if(!raw){
      if(isPrimary){
        input.focus();
        toast('Informe pelo menos um telefone de contato.');
        return false;
      }
      return true;
    }
    if(iti?.isValidNumber&&!iti.isValidNumber()){
      help.textContent='Confira o número para o país selecionado.';
      help.classList.remove('phone-valid');
      help.classList.add('phone-invalid');
      input.focus();
      toast('Há um telefone inválido. Confira o número destacado.');
      return false;
    }
    const country=iti?.getSelectedCountryData?.();
    help.textContent=country?.name?`${country.name} · número reconhecido`:'Número reconhecido';
    help.classList.remove('phone-invalid');
    help.classList.add('phone-valid');
    return true;
  }

  addButton.addEventListener('click',()=>addExtraPhone());

  validatePhone=async function(){
    if(!(await validateEntry(primaryInput,primaryIti,primaryHelp,true)))return false;
    for(const entry of extras){
      if(!(await validateEntry(entry.input,entry.iti,entry.help,false)))return false;
    }
    return true;
  };

  formData=function(){
    const phones=allPhones();
    const primary=phones[0]||{phone:'',phoneE164:'',phoneCountry:''};
    return{
      date:$('serviceDate').value,
      tour:$('tourSelect').value,
      boarding:$('boardingInput').value.trim(),
      names:$('namesInput').value.trim(),
      phone:primary.phone,
      phoneE164:primary.phoneE164,
      phoneCountry:primary.phoneCountry,
      phones,
      people:Math.max(1,Number($('peopleInput').value)||1),
      amount:normalizeMoney($('amountInput').value)
    };
  };

  message=function(data,code){
    const phones=Array.isArray(data.phones)&&data.phones.length
      ?data.phones.map(p=>p.phone).filter(Boolean)
      :[data.phone].filter(Boolean);
    const phoneLine=phones.length>1?`Telefones: ${phones.join(' / ')}`:`Telefone: ${phones[0]||''}`;
    return `Código: ${code}\nData: ${brDate(data.date)}\nPasseio: ${data.tour}\nEmbarque: ${data.boarding}\nPassageiro(s): ${data.names}\n${phoneLine}\nQuantidade: ${data.people} pessoa${data.people===1?'':'s'}\nValor a receber: ${currency.format(data.amount)}`;
  };

  resetPhone=function(){
    clearExtras();
    if(primaryIti){primaryIti.setCountry('br');primaryIti.setNumber('')}else primaryInput.value='';
    primaryHelp.textContent='Brasil selecionado por padrão. Use a bandeira para trocar de país.';
    primaryHelp.classList.remove('phone-invalid','phone-valid');
  };

  editRepasse=function(id){
    const item=getRepasses().find(x=>x.id===id);
    if(!item)return;
    editingRepasseId=id;
    $('serviceDate').value=item.date||localToday();
    $('tourSelect').value=item.tour||'';
    $('boardingInput').value=item.boarding||'';
    $('namesInput').value=item.names||'';
    clearExtras();
    const storedPhones=Array.isArray(item.phones)&&item.phones.length
      ?item.phones
      :[{phone:item.phone||'',phoneE164:item.phoneE164||'',phoneCountry:item.phoneCountry||'br'}];
    setPhone(primaryInput,primaryIti,storedPhones[0]||{});
    storedPhones.slice(1).forEach(phone=>addExtraPhone(phone));
    $('peopleInput').value=item.people||1;
    $('amountInput').value=Number(item.amount||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    $('saveLocationCheck').checked=false;
    $('repasseForm').querySelector('button[type="submit"]').textContent='Salvar alterações';
    $('saveWhatsappButton').textContent='Salvar alterações + WhatsApp';
    activateTab('novo');
    updatePreview();
    setTimeout(()=>$('serviceDate').focus(),250);
  };

  const oldRenderHistory=window.renderHistory;
  window.renderHistory=function(){
    if(typeof oldRenderHistory==='function')oldRenderHistory();
  };

  updatePreview();
})();