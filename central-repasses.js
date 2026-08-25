(function(){
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const RESERVATION_SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const REPASSES_STORAGE_KEY='jeri-rota-manager-repasses-v1';
  const byId=id=>document.getElementById(id);
  const read=(key)=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const writeLocal=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const date=v=>{if(!v)return'';const [y,m,d]=String(v).split('-');return y&&m&&d?`${d}/${m}/${y}`:v};

  function addAssets(){
    if(!document.querySelector('link[href="central-repasses.css"]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href='central-repasses.css';document.head.appendChild(link);
    }
  }
  function reservations(){return read(RESERVATIONS_KEY)}
  function services(){return read(RESERVATION_SERVICES_KEY)}
  function repasses(){return typeof getRepasses==='function'?getRepasses():read(REPASSES_STORAGE_KEY)}
  function reservationFor(service,list=reservations()){return list.find(r=>String(r.id)===String(service.reservationId))||null}
  function linkedRepasse(service,reservation,list=repasses()){
    return list.find(r=>String(r.reservationServiceId||'')===String(service.id))
      ||list.find(r=>r.reservationCode&&reservation?.reservationCode&&r.reservationCode===reservation.reservationCode&&(!service.date||r.date===service.date)&&(!service.service||r.service===service.service))
      ||null;
  }
  function statusFor(service,repasse){
    if(repasse?.status==='Realizado')return'Realizado';
    if(repasse?.status==='Cancelado')return'Cancelado';
    if(repasse?.status==='Enviado')return'Repassado';
    if(repasse?.status==='Pendente')return'Aguardando repasse';
    if(service.repasseStatus==='Realizado'||service.repasseStatus==='Cancelado'||service.repasseStatus==='Repassado')return service.repasseStatus;
    return'Aguardando repasse';
  }
  function statusClass(status){return status==='Repassado'?'sent':status==='Realizado'?'done':status==='Cancelado'?'cancelled':'awaiting'}
  function serviceTitle(s){
    const parts=[];
    if(s.tour)parts.push(s.tour);
    if(s.service)parts.push(s.service);
    if(!parts.length&&s.title)parts.push(s.title);
    if(!parts.length)parts.push('Serviço da reserva');
    return parts.join(' · ');
  }
  function payload(reservation,service){
    return{
      reservationId:reservation?.id||null,
      reservationCode:reservation?.reservationCode||'',
      serviceId:service.id,
      client:reservation?.client||'',
      phone:reservation?.phone||'',
      phones:Array.isArray(reservation?.phones)?reservation.phones:[],
      people:reservation?.people||null,
      date:service.date||reservation?.date||'',
      returnDate:service.returnDate||'',
      tour:service.tour||'',
      service:service.service||service.title||'',
      route:service.route||'',
      boarding:service.boarding||'',
      dropoff:service.dropoff||'',
      apartment:service.apartment||'',
      amount:service.repasseAmount??'',
      responsible:service.responsible||reservation?.responsible||''
    };
  }
  function prepareRepasse(serviceId){
    const svcs=services();const s=svcs.find(x=>String(x.id)===String(serviceId));if(!s)return;
    const r=reservationFor(s);sessionStorage.setItem('jeri-rota-repasse-from-reservation',JSON.stringify(payload(r,s)));
    location.href='repasses.html?fromReservation=1';
  }
  function openReservation(serviceId){
    const s=services().find(x=>String(x.id)===String(serviceId));if(!s)return;
    location.href=`index.html?openReservation=${encodeURIComponent(s.reservationId)}`;
  }
  function openHistory(repasse){
    if(!repasse)return;
    if(typeof activateTab==='function')activateTab('historico');
    const code=byId('historyCode');if(code){code.value=repasse.code||'';code.dispatchEvent(new Event('input',{bubbles:true}))}
    if(typeof renderHistory==='function')renderHistory();
  }
  function resend(repasse){if(!repasse)return;const text=typeof message==='function'?message(repasse,repasse.code):'';if(text&&window.openWhatsApp)window.openWhatsApp(text)}
  function setOperationalStatus(serviceId,nextStatus){
    const svcs=services();const idx=svcs.findIndex(x=>String(x.id)===String(serviceId));if(idx<0)return;
    const r=reservationFor(svcs[idx]);const reps=repasses();const rep=linkedRepasse(svcs[idx],r,reps);
    svcs[idx].repasseStatus=nextStatus;svcs[idx].updatedAt=new Date().toISOString();
    writeLocal(RESERVATION_SERVICES_KEY,svcs);
    if(rep){
      const repIdx=reps.findIndex(x=>String(x.id)===String(rep.id));
      if(repIdx>=0){
        reps[repIdx].status=nextStatus==='Realizado'?'Realizado':nextStatus==='Cancelado'?'Cancelado':nextStatus==='Repassado'?'Enviado':'Pendente';
        if(typeof write==='function')write(REPASSES_STORAGE_KEY,reps);else writeLocal(REPASSES_STORAGE_KEY,reps);
      }
    }
    if(typeof renderHistory==='function')renderHistory();
    render();
    if(typeof toast==='function')toast(nextStatus==='Realizado'?'Serviço marcado como realizado.':nextStatus==='Cancelado'?'Serviço cancelado.':'Serviço voltou para a fila de repasse.');
  }

  function inject(){
    addAssets();
    const tabs=document.querySelector('.repasse-tabs');const main=document.querySelector('.main-content');const novo=document.querySelector('.repasse-tab[data-tab="novo"]');
    if(!tabs||!main||!novo)return;
    novo.textContent='Repasse avulso';
    const heading=document.querySelector('.topbar h1');if(heading)heading.textContent='Central de repasses';
    const eyebrow=document.querySelector('.topbar .eyebrow');if(eyebrow)eyebrow.textContent='OPERAÇÃO';
    if(!tabs.querySelector('[data-tab="central"]')){
      const b=document.createElement('button');b.className='repasse-tab';b.dataset.tab='central';b.type='button';b.textContent='Central';tabs.insertBefore(b,novo);
    }
    if(!byId('tab-central')){
      const panel=document.createElement('section');panel.className='repasse-panel';panel.id='tab-central';
      panel.innerHTML=`
        <div class="central-repasses-head"><div><p class="eyebrow">FILA OPERACIONAL</p><h2>Central de repasses</h2><p>Os serviços cadastrados nas reservas aparecem aqui. Prepare, envie, acompanhe e finalize cada repasse sem redigitar os dados do cliente.</p></div><button class="outline-button" id="centralNewAvulso" type="button">+ Repasse avulso</button></div>
        <div class="central-kpis">
          <button class="central-kpi awaiting" data-central-kpi="Aguardando repasse"><span>Aguardando repasse</span><strong id="centralAwaitingCount">0</strong></button>
          <button class="central-kpi sent" data-central-kpi="Repassado"><span>Repassados</span><strong id="centralSentCount">0</strong></button>
          <button class="central-kpi done" data-central-kpi="Realizado"><span>Realizados</span><strong id="centralDoneCount">0</strong></button>
          <button class="central-kpi cancelled" data-central-kpi="Cancelado"><span>Cancelados</span><strong id="centralCancelledCount">0</strong></button>
        </div>
        <div class="central-toolbar">
          <input id="centralSearch" type="search" placeholder="Reserva, passageiro, passeio, serviço, rota ou local...">
          <input id="centralDate" type="date" aria-label="Filtrar por data">
          <select id="centralStatus"><option value="">Todos os status</option><option>Aguardando repasse</option><option>Repassado</option><option>Realizado</option><option>Cancelado</option></select>
          <button class="outline-button" id="centralClear" type="button">Limpar</button>
        </div>
        <div class="central-section-note"><strong id="centralResultCount">0 serviços</strong><span>Repasse avulso fica reservado para exceções sem reserva.</span></div>
        <div class="central-list" id="centralRepasseList"></div>`;
      main.insertBefore(panel,byId('tab-novo'));
      panel.addEventListener('click',event=>{
        const target=event.target.closest('button');if(!target)return;
        if(target.id==='centralNewAvulso'){activateTab('novo');return}
        if(target.dataset.centralKpi!==undefined){byId('centralStatus').value=target.dataset.centralKpi;render();return}
        if(target.dataset.centralPrepare){prepareRepasse(target.dataset.centralPrepare);return}
        if(target.dataset.centralReservation){openReservation(target.dataset.centralReservation);return}
        if(target.dataset.centralHistory){const rep=repasses().find(x=>String(x.id)===String(target.dataset.centralHistory));openHistory(rep);return}
        if(target.dataset.centralResend){const rep=repasses().find(x=>String(x.id)===String(target.dataset.centralResend));resend(rep);return}
        if(target.dataset.centralDone){setOperationalStatus(target.dataset.centralDone,'Realizado');return}
        if(target.dataset.centralCancel){if(confirm('Cancelar este serviço na fila de repasses?'))setOperationalStatus(target.dataset.centralCancel,'Cancelado');return}
        if(target.dataset.centralReopen){setOperationalStatus(target.dataset.centralReopen,'Aguardando repasse');return}
      });
      ['centralSearch','centralDate','centralStatus'].forEach(id=>{byId(id)?.addEventListener('input',render);byId(id)?.addEventListener('change',render)});
      byId('centralClear')?.addEventListener('click',()=>{byId('centralSearch').value='';byId('centralDate').value='';byId('centralStatus').value='';render()});
    }
    const fromReservation=new URLSearchParams(location.search).get('fromReservation')==='1';
    if(fromReservation){novo.textContent='Revisar repasse';if(typeof activateTab==='function')activateTab('novo')}
    else if(typeof activateTab==='function')activateTab('central');
    render();
  }

  function render(){
    const host=byId('centralRepasseList');if(!host)return;
    const rs=reservations();const reps=repasses();
    const all=services().map(service=>{const reservation=reservationFor(service,rs);const repasse=linkedRepasse(service,reservation,reps);return{service,reservation,repasse,status:statusFor(service,repasse)}});
    const counts={"Aguardando repasse":0,"Repassado":0,"Realizado":0,"Cancelado":0};all.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
    byId('centralAwaitingCount').textContent=counts['Aguardando repasse']||0;byId('centralSentCount').textContent=counts.Repassado||0;byId('centralDoneCount').textContent=counts.Realizado||0;byId('centralCancelledCount').textContent=counts.Cancelado||0;
    const q=(byId('centralSearch')?.value||'').trim().toLowerCase();const d=byId('centralDate')?.value||'';const st=byId('centralStatus')?.value||'';
    const filtered=all.filter(({service,reservation,status})=>{
      const text=[reservation?.reservationCode,reservation?.client,reservation?.phone,service.tour,service.service,service.title,service.route,service.boarding,service.dropoff,service.responsible].filter(Boolean).join(' ').toLowerCase();
      return(!q||text.includes(q))&&(!d||service.date===d||service.returnDate===d)&&(!st||status===st);
    }).sort((a,b)=>String(a.service.date||'9999').localeCompare(String(b.service.date||'9999')));
    byId('centralResultCount').textContent=`${filtered.length} ${filtered.length===1?'serviço':'serviços'}`;
    if(!filtered.length){host.innerHTML='<div class="central-empty"><strong>Nenhum serviço nesta fila.</strong><span>Cadastre serviços dentro de uma reserva ou altere os filtros.</span></div>';return}
    host.innerHTML=filtered.map(({service:s,reservation:r,repasse:rep,status})=>{
      const cls=statusClass(status);const dates=[s.date?`Ida ${date(s.date)}`:'',s.returnDate?`Volta ${date(s.returnDate)}`:''].filter(Boolean).join(' · ')||'Sem data';
      const route=s.route?`<span><strong>Rota:</strong> ${esc(s.route)}</span>`:'';const path=[s.boarding,s.dropoff].filter(Boolean).map(esc).join(' → ');
      let actions=`<button class="mini-button" type="button" data-central-reservation="${esc(s.id)}">Ver reserva</button>`;
      if(status==='Aguardando repasse')actions+=`<button class="primary-button" type="button" data-central-prepare="${esc(s.id)}">Preparar repasse</button>`;
      if(status==='Repassado'){
        if(rep)actions+=`<button class="mini-button" type="button" data-central-history="${esc(rep.id)}">Histórico</button><button class="outline-button" type="button" data-central-resend="${esc(rep.id)}">Reenviar WhatsApp</button>`;
        actions+=`<button class="primary-button" type="button" data-central-done="${esc(s.id)}">Marcar realizado</button>`;
      }
      if(status==='Realizado'&&rep)actions+=`<button class="mini-button" type="button" data-central-history="${esc(rep.id)}">Ver histórico</button>`;
      if(status==='Cancelado')actions+=`<button class="outline-button" type="button" data-central-reopen="${esc(s.id)}">Reabrir</button>`;
      if(status!=='Cancelado'&&status!=='Realizado')actions+=`<button class="mini-button" type="button" data-central-cancel="${esc(s.id)}">Cancelar</button>`;
      return `<article class="central-item"><div class="central-item-main"><div class="central-item-top"><span class="central-reservation-code">${esc(r?.reservationCode||'RESERVA')}</span><span class="central-status ${cls}">${esc(status)}</span></div><h3>${esc(serviceTitle(s))}</h3><div class="central-meta"><span>${esc(r?.client||'Passageiro não informado')}</span><span>${dates}</span>${r?.people?`<span>${r.people} pessoa${Number(r.people)===1?'':'s'}</span>`:''}${s.repasseAmount!==null&&s.repasseAmount!==undefined&&s.repasseAmount!==''?`<span>Repasse/NET ${money(s.repasseAmount)}</span>`:''}${route}</div>${path?`<div class="central-route"><strong>Operação:</strong> ${path}</div>`:''}</div><div class="central-actions">${actions}</div></article>`;
    }).join('');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
  window.addEventListener('storage',render);
})();