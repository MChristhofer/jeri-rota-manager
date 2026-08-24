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

  const repasseForm=byId('repasseForm');
  repasseForm?.querySelectorAll('[required]').forEach(field=>{field.required=false});

  const serviceDate=byId('serviceDate');
  if(serviceDate){
    const nativeSetCustomValidity=serviceDate.setCustomValidity.bind(serviceDate);
    nativeSetCustomValidity('');
    serviceDate.setCustomValidity=function(){nativeSetCustomValidity('')};
  }

  const roomInput=byId('roomInput');
  const legacyApInput=byId('apInput');
  if(roomInput&&legacyApInput&&legacyApInput!==roomInput){
    legacyApInput.closest('label')?.remove();
  }

  const boardingInput=byId('boardingInput');
  let dropoffInput=byId('dropoffInput');
  if(boardingInput&&!dropoffInput){
    const boardingLabel=boardingInput.closest('label');
    const dropoffLabel=document.createElement('label');
    dropoffLabel.className='full';
    dropoffLabel.innerHTML=`Local de desembarque <small class="field-help">Opcional</small>
      <div class="location-picker">
        <input id="dropoffInput" list="boardingOptions" placeholder="Digite um hotel ou local">
        <button class="outline-button map-search-button" id="searchDropoffMapsButton" type="button">Buscar no Maps</button>
      </div>
      <small class="field-help">Você pode usar um local já cadastrado ou digitar outro destino.</small>`;
    boardingLabel?.insertAdjacentElement('afterend',dropoffLabel);
    dropoffInput=byId('dropoffInput');
    byId('searchDropoffMapsButton')?.addEventListener('click',()=>{
      const q=dropoffInput?.value.trim()||'';
      if(!q)return toast('Digite o local de desembarque primeiro.');
      window.open(mapUrl(locationMapQuery(q)),'_blank');
    });
  }

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

  if(typeof formData==='function'){
    const baseFormData=formData;
    formData=function(){
      const data=baseFormData();
      const peopleRaw=byId('peopleInput')?.value.trim()||'';
      const amountRaw=byId('amountInput')?.value.trim()||'';
      return{
        ...data,
        dropoff:dropoffInput?.value.trim()||'',
        apartment:roomInput?.value.trim()||'',
        people:peopleRaw?Math.max(1,Number(peopleRaw)||1):null,
        amount:amountRaw?normalizeMoney(amountRaw):null
      };
    };
  }

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
    if(data?.dropoff)lines.push(`Desembarque: ${data.dropoff}`);
    if(data?.apartment)lines.push(`AP / Quarto: ${data.apartment}`);
    if(data?.names)lines.push(`Passageiro(s): ${data.names}`);
    if(phones.length>1)lines.push(`Telefones: ${phones.join(' / ')}`);
    else if(phones[0])lines.push(`Telefone: ${phones[0]}`);
    if(data?.people!==null&&data?.people!==undefined&&data.people!=='')lines.push(`Quantidade: ${data.people} pessoa${Number(data.people)===1?'':'s'}`);
    if(data?.amount!==null&&data?.amount!==undefined&&data.amount!=='')lines.push(`Valor a receber: ${currency.format(data.amount)}`);
    return lines.join('\n');
  };

  updatePreview=function(){
    const data=formData();
    const preview=byId('messagePreview');
    const code=currentCode();
    const codeLabel=byId('nextCode');
    if(codeLabel)codeLabel.textContent=code;
    if(!preview)return;
    const hasAny=Boolean(
      data.date||data.returnDate||data.tour||data.service||data.route||data.routeLabel||
      data.boarding||data.dropoff||data.apartment||data.names||data.phone||
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

  ['serviceDate','returnDate','tourSelect','serviceSelect','routeSelect','boardingInput','dropoffInput','roomInput','namesInput','phoneInput','peopleInput','amountInput']
    .forEach(id=>{
      const field=byId(id);
      field?.addEventListener('input',updatePreview);
      field?.addEventListener('change',updatePreview);
    });

  if(typeof editRepasse==='function'){
    const baseEditRepasse=editRepasse;
    editRepasse=function(id){
      const item=getRepasses().find(x=>String(x.id)===String(id));
      baseEditRepasse(id);
      if(!item)return;
      if(dropoffInput)dropoffInput.value=item.dropoff||'';
      if(roomInput)roomInput.value=item.apartment||'';
      const people=byId('peopleInput');
      if(people)people.value=item.people===null||item.people===undefined?'':item.people;
      const amount=byId('amountInput');
      if(amount)amount.value=item.amount===null||item.amount===undefined?'':Number(item.amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
      updatePreview();
    };
  }

  if(typeof renderHistory==='function'){
    const baseRenderHistory=renderHistory;
    renderHistory=function(){
      baseRenderHistory();
      const table=document.querySelector('#tab-historico table');
      if(!table)return;
      const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
      const boardingIndex=headers.indexOf('Embarque');
      const peopleIndex=headers.indexOf('Pessoas');
      const amountIndex=headers.indexOf('Valor');
      table.querySelectorAll('tbody tr').forEach(row=>{
        const code=row.cells[0]?.textContent.trim();
        const item=getRepasses().find(x=>x.code===code);
        if(!item)return;
        if(boardingIndex>=0&&item.dropoff){
          const boarding=item.boarding
            ?`${escapeHtml(item.boarding)}<small><a href="${mapUrl(locationMapQuery(item.boarding))}" target="_blank" rel="noopener">Ver embarque no Maps</a></small>`
            :'—';
          const dropoff=`<small><strong>Desembarque:</strong> ${escapeHtml(item.dropoff)} · <a href="${mapUrl(locationMapQuery(item.dropoff))}" target="_blank" rel="noopener">Maps</a></small>`;
          row.cells[boardingIndex].innerHTML=boarding+dropoff;
        }
        if(peopleIndex>=0&&(item.people===null||item.people===undefined||item.people===''))row.cells[peopleIndex].textContent='—';
        if(amountIndex>=0&&(item.amount===null||item.amount===undefined||item.amount===''))row.cells[amountIndex].textContent='—';
      });
    };
    window.renderHistory=renderHistory;
  }

  if(typeof resetRepasseForm==='function'){
    const baseResetRepasseForm=resetRepasseForm;
    resetRepasseForm=function(){
      baseResetRepasseForm();
      repasseForm?.querySelectorAll('[required]').forEach(field=>{field.required=false});
      serviceDate?.setCustomValidity('');
      if(dropoffInput)dropoffInput.value='';
      if(roomInput)roomInput.value='';
      updatePreview();
    };
  }

  updatePreview();

  // ---- Supabase Auth + sincronização ---------------------------------------
  const SUPABASE_URL='https://euqixdlpkjajhigqwhvi.supabase.co';
  const SUPABASE_KEY='sb_publishable_D9hnQLDMekew4_jZWXa2BA_G3UF9TIP';
  let cloudReady=false;
  let cloudPaused=false;
  let cloudClient=null;
  const originalWrite=write;

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){if(window.supabase)return resolve();existing.addEventListener('load',resolve,{once:true});return}
      const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }

  function addCloudBadge(email){
    const actions=document.querySelector('.topbar-actions');
    if(!actions||byId('cloudSessionBadge'))return;
    const wrap=document.createElement('div');
    wrap.id='cloudSessionBadge';
    wrap.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end';
    wrap.innerHTML=`<span style="font-size:12px;color:#277246;font-weight:700">● Supabase conectado</span><button class="outline-button" id="logoutButton" type="button" style="padding:8px 11px">Sair</button>`;
    actions.appendChild(wrap);
    byId('logoutButton')?.addEventListener('click',async()=>{await cloudClient.auth.signOut();location.replace('login.html')});
  }

  function repasseRow(x){
    return {
      code:x.code,
      number:Number(x.number)||Number(String(x.code||'').replace(/\D/g,''))||0,
      service_date:x.date||null,
      return_date:x.returnDate||null,
      tour:x.tour||null,
      service:x.service||null,
      route:x.route||null,
      route_origin:x.routeOrigin||null,
      route_destination:x.routeDestination||null,
      boarding:x.boarding||null,
      dropoff:x.dropoff||null,
      apartment:x.apartment||null,
      names:x.names||null,
      people:x.people===undefined?null:x.people,
      amount:x.amount===undefined?null:x.amount,
      status:x.status||'Pendente',
      updated_at:new Date().toISOString()
    };
  }

  async function syncRepasses(items){
    if(!cloudReady||cloudPaused)return;
    const rows=(items||[]).filter(x=>x.code).map(repasseRow);
    const codes=rows.map(x=>x.code);
    if(rows.length){
      const {error}=await cloudClient.from('repasses').upsert(rows,{onConflict:'code'});
      if(error)throw error;
    }
    const {data:existing,error:listError}=await cloudClient.from('repasses').select('id,code');
    if(listError)throw listError;
    const remove=(existing||[]).filter(x=>!codes.includes(x.code)).map(x=>x.id);
    if(remove.length){const {error}=await cloudClient.from('repasses').delete().in('id',remove);if(error)throw error}
    const map=new Map((existing||[]).map(x=>[x.code,x.id]));
    if(rows.length){
      const {data:fresh,error}=await cloudClient.from('repasses').select('id,code').in('code',codes);
      if(error)throw error;
      (fresh||[]).forEach(x=>map.set(x.code,x.id));
    }
    for(const item of items||[]){
      const repasseId=map.get(item.code);if(!repasseId)continue;
      await cloudClient.from('repasse_phones').delete().eq('repasse_id',repasseId);
      const phones=(Array.isArray(item.phones)&&item.phones.length?item.phones:[{phone:item.phone,phoneE164:item.phoneE164,phoneCountry:item.phoneCountry}]).filter(p=>p?.phone||p?.phoneE164);
      if(phones.length){
        const payload=phones.map((p,i)=>({repasse_id:repasseId,phone:p.phone||null,phone_e164:p.phoneE164||null,phone_country:p.phoneCountry||null,sort_order:i}));
        const {error}=await cloudClient.from('repasse_phones').insert(payload);if(error)throw error;
      }
    }
  }

  async function syncCatalog(table,items,mapper){
    if(!cloudReady||cloudPaused)return;
    const {error:deleteError}=await cloudClient.from(table).delete().neq('id','00000000-0000-0000-0000-000000000000');
    if(deleteError)throw deleteError;
    const payload=(items||[]).map(mapper).filter(Boolean);
    if(payload.length){const {error}=await cloudClient.from(table).insert(payload);if(error)throw error}
  }

  async function syncKey(key,value){
    try{
      if(key===REPASSES_KEY)await syncRepasses(value);
      else if(key===TOURS_KEY)await syncCatalog('tours',value,x=>x?{name:String(x)}:null);
      else if(key===LOCATIONS_KEY)await syncCatalog('locations',value,x=>x?.name?{name:x.name,type:x.type||null,address:x.address||null}:null);
      else if(key==='jeri-rota-manager-servicos-v1')await syncCatalog('services',value,x=>x?{name:String(x)}:null);
      else if(key==='jeri-rota-manager-rotas-v1')await syncCatalog('routes',value,x=>x?.code?{code:x.code,origin:x.origin||null,destination:x.destination||null}:null);
    }catch(err){console.error('Falha ao sincronizar Supabase:',err);toast('Salvo neste dispositivo. Sincronização pendente.')}
  }

  write=function(key,value){
    originalWrite(key,value);
    if(cloudReady&&!cloudPaused)syncKey(key,value);
  };

  function dbRepasseToLocal(row,phones){
    const ph=(phones||[]).sort((a,b)=>a.sort_order-b.sort_order).map(p=>({phone:p.phone||'',phoneE164:p.phone_e164||'',phoneCountry:p.phone_country||''}));
    return {
      id:row.id,number:Number(row.number),code:row.code,date:row.service_date||'',returnDate:row.return_date||'',tour:row.tour||'',service:row.service||'',route:row.route||'',routeOrigin:row.route_origin||'',routeDestination:row.route_destination||'',routeLabel:row.route||'',boarding:row.boarding||'',dropoff:row.dropoff||'',apartment:row.apartment||'',names:row.names||'',phone:ph[0]?.phone||'',phoneE164:ph[0]?.phoneE164||'',phoneCountry:ph[0]?.phoneCountry||'',phones:ph,people:row.people,amount:row.amount===null?null:Number(row.amount),status:row.status||'Pendente',createdAt:row.created_at
    };
  }

  async function bootstrapCloud(){
    const {data:{user},error:userError}=await cloudClient.auth.getUser();
    if(userError||!user){
      const next=encodeURIComponent(location.pathname.split('/').pop()||'repasses.html');
      location.replace(`login.html?next=${next}`);
      return;
    }
    addCloudBadge(user.email||'');
    const {data:rows,error}=await cloudClient.from('repasses').select('*').order('number',{ascending:false});
    if(error)throw error;
    const local=getRepasses();
    cloudReady=true;
    if((rows||[]).length===0&&local.length){
      await syncRepasses(local);
    }else if((rows||[]).length){
      const ids=rows.map(x=>x.id);
      const {data:phones,error:phoneError}=await cloudClient.from('repasse_phones').select('*').in('repasse_id',ids);
      if(phoneError)throw phoneError;
      const grouped=new Map();
      (phones||[]).forEach(p=>{if(!grouped.has(p.repasse_id))grouped.set(p.repasse_id,[]);grouped.get(p.repasse_id).push(p)});
      const converted=rows.map(r=>dbRepasseToLocal(r,grouped.get(r.id)||[]));
      cloudPaused=true;originalWrite(REPASSES_KEY,converted);cloudPaused=false;
    }
    renderHistory();updatePreview();
  }

  (async()=>{
    try{
      document.body.style.visibility='hidden';
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      cloudClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      await bootstrapCloud();
    }catch(err){
      console.error('Erro ao conectar Supabase:',err);
      toast('Não foi possível conectar ao banco agora.');
    }finally{
      document.body.style.visibility='visible';
    }
  })();
})();