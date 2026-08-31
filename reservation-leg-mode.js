(function(){
  const FORM_ID='reservationForm';
  const HOST_ID='reservationServiceDrafts';

  function inferMode(card){
    const date=card.querySelector('[data-field="date"]')?.value||'';
    const returnDate=card.querySelector('[data-field="returnDate"]')?.value||'';
    if(date&&returnDate)return'roundtrip';
    if(!date&&returnDate)return'return';
    return'outbound';
  }

  function dispatch(input){
    if(!input)return;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function setLabelText(label,text){
    if(!label)return;
    const node=[...label.childNodes].find(item=>item.nodeType===Node.TEXT_NODE);
    if(node)node.textContent=text;
  }

  function applyMode(card,mode,{clearOpposite=false}={}){
    const type=card.querySelector('[data-field="serviceType"]')?.value||card.dataset.serviceType||'transfer';
    const field=card.querySelector('[data-leg-mode]');
    const wrapper=field?.closest('.reservation-leg-mode');
    if(type==='hospedagem'){
      if(wrapper)wrapper.hidden=true;
      return;
    }
    if(wrapper)wrapper.hidden=false;
    if(field&&field.value!==mode)field.value=mode;

    const date=card.querySelector('[data-field="date"]');
    const returnDate=card.querySelector('[data-field="returnDate"]');
    const startTime=card.querySelector('[data-field="startTime"]');
    const endTime=card.querySelector('[data-field="endTime"]');
    const dateLabel=date?.closest('label');
    const returnLabel=returnDate?.closest('label');
    const startLabel=startTime?.closest('label');
    const endLabel=endTime?.closest('label');
    const returnOptional=returnLabel?.querySelector('.optional-label');

    if(mode==='return'){
      if(clearOpposite){
        if(date?.value){date.value='';dispatch(date)}
        if(startTime?.value){startTime.value='';dispatch(startTime)}
      }
      if(date){date.required=false;date.disabled=false}
      if(returnDate){returnDate.required=true;returnDate.disabled=false}
      if(dateLabel)dateLabel.style.display='none';
      if(returnLabel)returnLabel.style.display='grid';
      if(startLabel)startLabel.style.display='none';
      if(endLabel)endLabel.style.display='grid';
      if(returnOptional)returnOptional.hidden=true;
      setLabelText(returnLabel,'Data de volta * ');
      setLabelText(endLabel,'Horário da volta ');
    }else if(mode==='roundtrip'){
      if(date){date.required=true;date.disabled=false}
      if(returnDate){returnDate.required=true;returnDate.disabled=false}
      if(dateLabel)dateLabel.style.display='grid';
      if(returnLabel)returnLabel.style.display='grid';
      if(startLabel)startLabel.style.display='grid';
      if(endLabel)endLabel.style.display='grid';
      if(returnOptional)returnOptional.hidden=true;
      setLabelText(dateLabel,'Data de ida * ');
      setLabelText(returnLabel,'Data de volta * ');
      setLabelText(startLabel,'Horário de ida / início ');
      setLabelText(endLabel,'Horário de volta / fim ');
    }else{
      if(clearOpposite){
        if(returnDate?.value){returnDate.value='';dispatch(returnDate)}
      }
      if(date){date.required=true;date.disabled=false}
      if(returnDate){returnDate.required=false;returnDate.disabled=false}
      if(dateLabel)dateLabel.style.display='grid';
      if(returnLabel)returnLabel.style.display='none';
      if(startLabel)startLabel.style.display='grid';
      if(endLabel)endLabel.style.display='grid';
      if(returnOptional)returnOptional.hidden=false;
      setLabelText(dateLabel,'Data do serviço * ');
      setLabelText(startLabel,'Horário de saída / início ');
      setLabelText(endLabel,'Horário de retorno / fim ');
    }

    card.dataset.legMode=mode;
  }

  function decorateCard(card){
    if(!card)return;
    const date=card.querySelector('[data-field="date"]');
    if(!date)return;
    let select=card.querySelector('[data-leg-mode]');
    if(!select){
      const label=document.createElement('label');
      label.className='reservation-leg-mode';
      label.innerHTML='<span>Trecho do serviço *</span><select data-leg-mode><option value="outbound">Ida / serviço único</option><option value="return">Somente volta</option><option value="roundtrip">Ida e volta</option></select><small>Define quais datas entram na agenda operacional.</small>';
      date.closest('label')?.insertAdjacentElement('beforebegin',label);
      select=label.querySelector('[data-leg-mode]');
      select.addEventListener('change',()=>applyMode(card,select.value,{clearOpposite:true}));
    }
    const mode=card.dataset.legMode||inferMode(card);
    applyMode(card,mode);
  }

  function decorateAll(){
    document.querySelectorAll(`#${HOST_ID} .reservation-service-draft`).forEach(decorateCard);
  }

  function installStyles(){
    if(document.getElementById('reservationLegModeStyles'))return;
    const style=document.createElement('style');
    style.id='reservationLegModeStyles';
    style.textContent=`
      .reservation-leg-mode{display:grid;gap:6px;padding:10px 11px;border:1px solid #ead9b5;border-radius:11px;background:#fffaf0}
      .reservation-leg-mode>span{color:#7b5a19;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      .reservation-leg-mode select{min-height:40px}
      .reservation-leg-mode small{color:#8a7b61;font-size:9px;font-weight:500;line-height:1.35}
      @media(max-width:700px){.reservation-leg-mode{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    installStyles();
    decorateAll();
    const host=document.getElementById(HOST_ID);
    if(host&&!host.dataset.legModeObserver){
      host.dataset.legModeObserver='true';
      new MutationObserver(()=>requestAnimationFrame(decorateAll)).observe(host,{childList:true,subtree:true});
    }
    const form=document.getElementById(FORM_ID);
    if(form&&!form.dataset.legModeValidation){
      form.dataset.legModeValidation='true';
      form.addEventListener('submit',event=>{
        let valid=true;
        document.querySelectorAll(`#${HOST_ID} .reservation-service-draft`).forEach(card=>{
          const mode=card.querySelector('[data-leg-mode]')?.value||inferMode(card);
          applyMode(card,mode);
          const date=card.querySelector('[data-field="date"]');
          const returnDate=card.querySelector('[data-field="returnDate"]');
          if((mode==='outbound'||mode==='roundtrip')&&!date?.value)valid=false;
          if((mode==='return'||mode==='roundtrip')&&!returnDate?.value)valid=false;
        });
        if(!valid){event.preventDefault();event.stopImmediatePropagation();form.reportValidity()}
      },true);
    }
  }

  const timer=setInterval(()=>{
    if(!document.getElementById(HOST_ID))return;
    clearInterval(timer);install();
  },80);
  if(document.readyState!=='loading')install();
  else document.addEventListener('DOMContentLoaded',install,{once:true});
})();
