(function(){
  const byId=id=>document.getElementById(id);

  function goToTab(name){
    if(typeof activateTab==='function'){
      activateTab(name);
      return;
    }
    document.querySelectorAll('.repasse-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.tab===name));
    document.querySelectorAll('.repasse-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`tab-${name}`));
  }

  // As abas Serviços e Rotas são criadas depois do carregamento do script principal.
  // Delegação garante que elas também possam ser abertas normalmente.
  document.querySelector('.repasse-tabs')?.addEventListener('click',event=>{
    const tab=event.target.closest('.repasse-tab[data-tab]');
    if(!tab)return;
    goToTab(tab.dataset.tab);
  });

  function addEditShortcut(selectId,tabName,label){
    const select=byId(selectId);
    const field=select?.closest('label');
    if(!select||!field||field.querySelector(`[data-edit-catalog="${tabName}"]`))return;

    const button=document.createElement('button');
    button.type='button';
    button.className='text-button';
    button.dataset.editCatalog=tabName;
    button.textContent=label;
    button.style.marginTop='7px';
    button.style.alignSelf='flex-start';
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      goToTab(tabName);
    });
    field.appendChild(button);
  }

  addEditShortcut('serviceSelect','servicos','Editar serviços');
  addEditShortcut('routeSelect','rotas','Editar rotas / sentidos');

  const serviceTab=document.querySelector('.repasse-tab[data-tab="servicos"]');
  if(serviceTab)serviceTab.textContent='Serviços';
  const routeTab=document.querySelector('.repasse-tab[data-tab="rotas"]');
  if(routeTab)routeTab.textContent='Rotas / Sentidos';

  // Todos os campos do NOVO REPASSE são opcionais. Os formulários de cadastro
  // (passeios, serviços, rotas e locais) continuam validando seus próprios dados.
  const repasseForm=byId('repasseForm');
  repasseForm?.querySelectorAll('[required]').forEach(field=>{field.required=false});

  // A versão anterior exigia pelo menos ida ou volta via setCustomValidity.
  // Mantemos as duas datas livres e opcionais.
  const serviceDate=byId('serviceDate');
  if(serviceDate){
    const nativeSetCustomValidity=serviceDate.setCustomValidity.bind(serviceDate);
    nativeSetCustomValidity('');
    serviceDate.setCustomValidity=function(){nativeSetCustomValidity('')};
  }

  // Garante apenas uma janela de AP / Quarto. A janela declarada no HTML é a oficial.
  const roomInput=byId('roomInput');
  const legacyApInput=byId('apInput');
  if(roomInput&&legacyApInput&&legacyApInput!==roomInput){
    legacyApInput.closest('label')?.remove();
  }

  // Telefone também é opcional. Se houver telefone principal preenchido,
  // continua sendo validado para o país selecionado.
  validatePhone=async function(){
    const input=byId('phoneInput');
    const raw=input?.value.trim()||'';
    if(!raw)return true;
    if(phoneIti?.promise){try{await phoneIti.promise}catch{}}
    if(phoneIti?.isValidNumber&&!phoneIti.isValidNumber()){
      const help=byId('phoneHelp');
      if(help){
        help.textContent='Confira o número para o país selecionado.';
        help.classList.remove('phone-valid');
        help.classList.add('phone-invalid');
      }
      input?.focus();
      toast('Telefone inválido para o país selecionado.');
      return false;
    }
    return true;
  };

  // Preserva toda a estrutura atual, mas permite quantidade e valor realmente vazios
  // e usa somente o campo único de AP / Quarto.
  if(typeof formData==='function'){
    const baseFormData=formData;
    formData=function(){
      const data=baseFormData();
      const peopleRaw=byId('peopleInput')?.value.trim()||'';
      const amountRaw=byId('amountInput')?.value.trim()||'';
      return{
        ...data,
        apartment:roomInput?.value.trim()||'',
        people:peopleRaw?Math.max(1,Number(peopleRaw)||1):null,
        amount:amountRaw?normalizeMoney(amountRaw):null
      };
    };
  }

  // Mensagem compacta: só entra o que estiver preenchido.
  // A rota aparece apenas pela sigla, como Jeri-Fort ou Fort-Jeri.
  message=function(data,code){
    const phones=Array.isArray(data?.phones)&&data.phones.length
      ?data.phones.map(p=>p.phone).filter(Boolean)
      :[data?.phone].filter(Boolean);
    const lines=[`Código: ${code}`];

    if(data?.date)lines.push(`Ida: ${brDate(data.date)}`);
    if(data?.returnDate)lines.push(`Volta: ${brDate(data.returnDate)}`);
    if(data?.tour)lines.push(`Passeio: ${data.tour}`);
    if(data?.service)lines.push(`Serviço: ${data.service}`);

    const routeCode=data?.route||String(data?.routeLabel||'').split(' — ')[0].trim();
    if(routeCode)lines.push(`Rota: ${routeCode}`);

    if(data?.boarding)lines.push(`Embarque: ${data.boarding}`);
    if(data?.apartment)lines.push(`AP / Quarto: ${data.apartment}`);
    if(data?.names)lines.push(`Passageiro(s): ${data.names}`);
    if(phones.length>1)lines.push(`Telefones: ${phones.join(' / ')}`);
    else if(phones[0])lines.push(`Telefone: ${phones[0]}`);
    if(data?.people!==null&&data?.people!==undefined&&data.people!==''){
      lines.push(`Quantidade: ${data.people} pessoa${Number(data.people)===1?'':'s'}`);
    }
    if(data?.amount!==null&&data?.amount!==undefined&&data.amount!==''){
      lines.push(`Valor a receber: ${currency.format(data.amount)}`);
    }
    return lines.join('\n');
  };

  // A prévia precisa considerar também Serviço, Rota, Volta e AP/Quarto,
  // mesmo quando os demais campos estiverem vazios.
  updatePreview=function(){
    const data=formData();
    const preview=byId('messagePreview');
    const code=currentCode();
    const codeLabel=byId('nextCode');
    if(codeLabel)codeLabel.textContent=code;
    if(!preview)return;

    const hasAny=Boolean(
      data.date||data.returnDate||data.tour||data.service||data.route||data.routeLabel||
      data.boarding||data.apartment||data.names||data.phone||
      (Array.isArray(data.phones)&&data.phones.length)||
      (data.people!==null&&data.people!==undefined&&data.people!=='')||
      (data.amount!==null&&data.amount!==undefined&&data.amount!=='')
    );

    if(!hasAny){
      preview.className='message-preview empty';
      preview.textContent='Preencha os dados que desejar para visualizar a mensagem.';
      return;
    }
    preview.className='message-preview';
    preview.textContent=message(data,code);
  };

  // Campos que foram criados por scripts anteriores também atualizam a prévia.
  ['serviceDate','returnDate','tourSelect','serviceSelect','routeSelect','boardingInput','roomInput','namesInput','phoneInput','peopleInput','amountInput']
    .forEach(id=>{
      const field=byId(id);
      field?.addEventListener('input',updatePreview);
      field?.addEventListener('change',updatePreview);
    });

  // Ao editar um repasse antigo, traz AP, quantidade e valor sem inventar 1 ou R$ 0,00.
  if(typeof editRepasse==='function'){
    const baseEditRepasse=editRepasse;
    editRepasse=function(id){
      const item=getRepasses().find(x=>x.id===id);
      baseEditRepasse(id);
      if(!item)return;
      if(roomInput)roomInput.value=item.apartment||'';
      const people=byId('peopleInput');
      if(people)people.value=item.people===null||item.people===undefined?'':item.people;
      const amount=byId('amountInput');
      if(amount)amount.value=item.amount===null||item.amount===undefined?'':Number(item.amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
      updatePreview();
    };
  }

  // Depois que o histórico for renderizado, campos não informados aparecem como traço,
  // em vez de sugerir automaticamente 1 pessoa ou R$ 0,00.
  if(typeof renderHistory==='function'){
    const baseRenderHistory=renderHistory;
    renderHistory=function(){
      baseRenderHistory();
      const table=document.querySelector('#tab-historico table');
      if(!table)return;
      const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
      const peopleIndex=headers.indexOf('Pessoas');
      const amountIndex=headers.indexOf('Valor');
      table.querySelectorAll('tbody tr').forEach(row=>{
        const code=row.cells[0]?.textContent.trim();
        const item=getRepasses().find(x=>x.code===code);
        if(!item)return;
        if(peopleIndex>=0&&(item.people===null||item.people===undefined||item.people===''))row.cells[peopleIndex].textContent='—';
        if(amountIndex>=0&&(item.amount===null||item.amount===undefined||item.amount===''))row.cells[amountIndex].textContent='—';
      });
    };
    window.renderHistory=renderHistory;
  }

  // Reaplica a regra após reset do formulário, pois scripts antigos restauram defaults.
  if(typeof resetRepasseForm==='function'){
    const baseResetRepasseForm=resetRepasseForm;
    resetRepasseForm=function(){
      baseResetRepasseForm();
      repasseForm?.querySelectorAll('[required]').forEach(field=>{field.required=false});
      serviceDate?.setCustomValidity('');
      if(roomInput)roomInput.value='';
      updatePreview();
    };
  }

  updatePreview();
})();