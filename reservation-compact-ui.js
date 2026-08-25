(function(){
  const form=document.getElementById('reservationForm');
  if(!form)return;
  const byId=id=>document.getElementById(id);
  let compacting=false;

  function legacy(name){return form.querySelector(`[name="${name}"]`)}
  function setTextLabel(label,text){
    if(!label)return;
    const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
    if(node)node.textContent=text;
  }
  function prepareLegacy(){
    const service=legacy('service'),date=legacy('date'),boarding=legacy('boarding');
    [service,date,boarding].forEach(input=>input?.closest('label')?.classList.add('legacy-service-field'));
    if(service&&!service.value)service.value='Serviços da reserva';
    if(date&&!date.value){
      const now=new Date();
      date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    }
    if(boarding&&!boarding.value)boarding.value='Definido por serviço';
  }
  function ensureAlert(){
    let alert=byId('reservationValidationAlert');
    if(!alert){
      alert=document.createElement('div');
      alert.id='reservationValidationAlert';
      alert.className='reservation-validation-alert';
      alert.hidden=true;
      alert.setAttribute('role','alert');
      form.prepend(alert);
    }
    return alert;
  }
  function clearError(input){
    if(!input)return;
    const label=input.closest('label');
    label?.classList.remove('field-invalid');
    label?.querySelector('.field-error')?.remove();
    input.removeAttribute('aria-invalid');
    input.setCustomValidity?.('');
  }
  function markError(input,message){
    if(!input)return null;
    const label=input.closest('label');
    label?.classList.add('field-invalid');
    input.setAttribute('aria-invalid','true');
    label?.querySelector('.field-error')?.remove();
    const error=document.createElement('small');
    error.className='field-error';
    error.textContent=message;
    label?.appendChild(error);
    return input;
  }
  function clearValidation(){
    form.querySelectorAll('.field-invalid').forEach(el=>el.classList.remove('field-invalid'));
    form.querySelectorAll('.field-error').forEach(el=>el.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach(el=>el.removeAttribute('aria-invalid'));
    const alert=ensureAlert();alert.hidden=true;alert.textContent='';
  }
  function serviceIdentity(card){
    const catalog=card.querySelector('[data-service-catalog-select]');
    const manual=card.querySelector('[data-field="service"]');
    const tour=card.querySelector('[data-field="tour"]');
    const title=card.querySelector('[data-field="title"]');
    const value=String(catalog?.value||'').trim()||String(manual?.value||'').trim()||String(tour?.value||'').trim()||String(title?.value||'').trim();
    return{value,input:catalog||manual||tour||title};
  }
  function cards(){return [...document.querySelectorAll('#reservationServiceDrafts .reservation-service-draft')]}
  function syncLegacy(){
    prepareLegacy();
    const first=cards()[0];if(!first)return;
    const identity=serviceIdentity(first);
    const service=legacy('service'),date=legacy('date'),boarding=legacy('boarding');
    if(service)service.value=identity.value||'Serviços da reserva';
    const firstDate=first.querySelector('[data-field="date"]')?.value||'';
    const firstBoarding=first.querySelector('[data-field="boarding"]')?.value||'';
    if(date&&firstDate)date.value=firstDate;
    if(boarding)boarding.value=firstBoarding||'Definido por serviço';
  }
  function validate(event){
    clearValidation();syncLegacy();
    const errors=[];
    [[legacy('client'),'Informe o nome do passageiro.'],[legacy('phone'),'Informe o telefone principal.'],[legacy('amount'),'Informe o valor da reserva. O valor pode ser R$ 0,00.']].forEach(([input,message])=>{
      if(!input)return;
      const raw=String(input.value??'');
      const invalid=input.name==='amount'?raw===''||Number(raw)<0:raw.trim()==='';
      if(invalid)errors.push(markError(input,message));
    });
    const list=cards();
    if(!list.length){
      errors.push(byId('addReservationService'));
    }else{
      list.forEach((card,index)=>{
        const identity=serviceIdentity(card);
        const date=card.querySelector('[data-field="date"]');
        const boarding=card.querySelector('[data-field="boarding"]');
        if(!identity.value)errors.push(markError(identity.input,`Selecione o serviço ${index+1}.`));
        if(!String(date?.value||'').trim())errors.push(markError(date,`Informe a data do serviço ${index+1}.`));
        if(!String(boarding?.value||'').trim())errors.push(markError(boarding,`Informe o embarque do serviço ${index+1}.`));
      });
    }
    if(!errors.length)return true;
    event.preventDefault();event.stopImmediatePropagation();
    const alert=ensureAlert();alert.hidden=false;alert.innerHTML='<strong>Preencha os campos obrigatórios para salvar a reserva.</strong><span>Os campos pendentes estão destacados.</span>';
    const first=errors.find(Boolean);
    if(first){
      (first.closest?.('label')||first).scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>first.focus?.({preventScroll:true}),220);
    }
    return false;
  }
  function detailsFor(card){
    let details=card.querySelector('.service-extra-details');
    if(!details){
      details=document.createElement('details');details.className='service-extra-details';
      details.innerHTML='<summary>Mais detalhes</summary><div class="service-extra-grid"></div>';
      card.appendChild(details);
    }
    return details;
  }
  function moveToDetails(card,element){
    if(!element)return;
    const grid=detailsFor(card).querySelector('.service-extra-grid');
    if(element.parentElement!==grid)grid.appendChild(element);
  }
  function compactCard(card,index){
    card.classList.add('reservation-service-compact');
    const top=card.querySelector('.service-draft-top');
    if(top&&!top.querySelector('.service-card-hint')){
      const hint=document.createElement('small');hint.className='service-card-hint';hint.textContent='Serviço, data e embarque são obrigatórios.';
      top.querySelector('strong')?.insertAdjacentElement('afterend',hint);
    }
    const date=card.querySelector('[data-field="date"]'),boarding=card.querySelector('[data-field="boarding"]'),dropoff=card.querySelector('[data-field="dropoff"]');
    setTextLabel(date?.closest('label'),'Data do serviço *');
    setTextLabel(boarding?.closest('label'),'Embarque *');
    setTextLabel(dropoff?.closest('label'),'Desembarque');
    const catalog=card.querySelector('[data-service-catalog-select]');
    const manual=card.querySelector('[data-field="service"]');
    const serviceField=catalog||manual;
    if(serviceField){setTextLabel(serviceField.closest('label'),'Serviço *');serviceField.closest('label')?.classList.add('service-primary-field')}
    ['tour','route','apartment','repasseAmount','responsible','returnDate'].forEach(name=>moveToDetails(card,card.querySelector(`[data-field="${name}"]`)?.closest('label')));
    moveToDetails(card,card.querySelector('.reservation-service-finance'));
    moveToDetails(card,card.querySelector('.roundtrip-controls'));
    card.dataset.compactIndex=String(index);
  }
  function compact(){
    if(compacting)return;compacting=true;
    prepareLegacy();ensureAlert();
    const editor=byId('reservationServicesEditor');
    if(editor){
      const legend=editor.querySelector('legend');if(legend)legend.textContent='Serviços da reserva';
      const text=editor.querySelector('.service-editor-head p');if(text)text.textContent='Preencha o essencial. Informações operacionais e NET ficam em “Mais detalhes”.';
    }
    cards().forEach(compactCard);syncLegacy();
    compacting=false;
  }

  form.addEventListener('input',event=>{if(event.target.matches('input,select,textarea'))clearError(event.target);if(event.target.closest?.('.reservation-service-draft'))syncLegacy()});
  form.addEventListener('change',event=>{if(event.target.matches('input,select,textarea'))clearError(event.target);if(event.target.closest?.('.reservation-service-draft'))syncLegacy()});
  form.addEventListener('submit',event=>validate(event),true);

  prepareLegacy();ensureAlert();
  const wait=setInterval(()=>{
    const host=byId('reservationServiceDrafts');if(!host)return;
    clearInterval(wait);compact();
    const observer=new MutationObserver(()=>setTimeout(compact,0));observer.observe(host,{childList:true,subtree:true});
  },60);
  ['jeri-service-catalog-ready','reservation-finance-refresh'].forEach(name=>window.addEventListener(name,()=>setTimeout(compact,0)));
})();
