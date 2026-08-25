(function(){
  const SERVICES='jeri-rota-manager-reservation-services-v1';
  const RESERVATIONS='jeri-rota-manager-reservas-v1';
  const REPASSES='jeri-rota-manager-repasses-v1';
  const KEY='jeri-rota-repasse-from-reservation';
  const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const br=v=>{if(!v)return'';const [y,m,d]=String(v).split('-');return y&&m&&d?`${d}/${m}/${y}`:v};
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  let rendering=false;

  function services(){return read(SERVICES)}
  function reservationFor(s){return read(RESERVATIONS).find(r=>String(r.id)===String(s.reservationId))||null}
  function returnRepasse(s,r){return read(REPASSES).find(x=>String(x.reservationServiceId||'')===String(s.id)&&x.reservationLeg==='return')||read(REPASSES).find(x=>x.reservationCode&&x.reservationCode===r?.reservationCode&&x.reservationLeg==='return'&&x.date===s.returnDate)||null}
  function returnStatus(s,rep){if(rep?.status==='Realizado')return'Realizado';if(rep?.status==='Cancelado')return'Cancelado';if(rep?.status==='Enviado')return'Repassado';if(rep?.status==='Pendente')return'Aguardando repasse';return s.returnRepasseStatus||'Aguardando repasse'}
  function cls(st){return st==='Repassado'?'sent':st==='Realizado'?'done':st==='Cancelado'?'cancelled':'awaiting'}
  function returnPayload(s,r){return{reservationId:r?.id||null,reservationCode:r?.reservationCode||'',serviceId:s.id,reservationLeg:'return',client:r?.client||'',phone:r?.phone||'',phones:Array.isArray(r?.phones)?r.phones:[],people:r?.people||null,date:s.returnDate||'',returnDate:'',tour:'',service:s.returnService||s.service||s.title||'',route:s.returnRoute||'',boarding:s.dropoff||'',dropoff:s.boarding||'',apartment:s.apartment||'',amount:s.returnRepasseAmount??s.repasseAmount??'',responsible:s.responsible||r?.responsible||''}}
  function outboundPayload(s,r){return{reservationId:r?.id||null,reservationCode:r?.reservationCode||'',serviceId:s.id,reservationLeg:'outbound',client:r?.client||'',phone:r?.phone||'',phones:Array.isArray(r?.phones)?r.phones:[],people:r?.people||null,date:s.date||r?.date||'',returnDate:'',tour:s.tour||'',service:s.service||s.title||'',route:s.route||'',boarding:s.boarding||'',dropoff:s.dropoff||'',apartment:s.apartment||'',amount:s.repasseAmount??'',responsible:s.responsible||r?.responsible||''}}
  function prepareReturn(id){const s=services().find(x=>String(x.id)===String(id));if(!s)return;sessionStorage.setItem(KEY,JSON.stringify(returnPayload(s,reservationFor(s))));location.href='repasses.html?fromReservation=1'}
  function prepareOutbound(id){const s=services().find(x=>String(x.id)===String(id));if(!s)return;sessionStorage.setItem(KEY,JSON.stringify(outboundPayload(s,reservationFor(s))));location.href='repasses.html?fromReservation=1'}
  function openReservation(id){const s=services().find(x=>String(x.id)===String(id));if(s)location.href=`index.html?openReservation=${encodeURIComponent(s.reservationId)}`}
  function setStatus(id,status){const svcs=services();const i=svcs.findIndex(x=>String(x.id)===String(id));if(i<0)return;svcs[i].returnRepasseStatus=status;svcs[i].updatedAt=new Date().toISOString();localStorage.setItem(SERVICES,JSON.stringify(svcs));const r=reservationFor(svcs[i]);const reps=read(REPASSES);const rep=returnRepasse(svcs[i],r);if(rep){const j=reps.findIndex(x=>String(x.id)===String(rep.id));if(j>=0){reps[j].status=status==='Realizado'?'Realizado':status==='Cancelado'?'Cancelado':status==='Repassado'?'Enviado':'Pendente';localStorage.setItem(REPASSES,JSON.stringify(reps))}}renderReturns()}
  function resend(rep){if(!rep)return;const text=typeof message==='function'?message(rep,rep.code):'';if(text&&window.openWhatsApp)window.openWhatsApp(text)}

  function renderReturns(){
    if(rendering)return;rendering=true;
    try{
      document.querySelectorAll('.central-return-item').forEach(x=>x.remove());
      const roundTrips=services().filter(s=>s.roundTripSameMode&&s.returnDate);
      roundTrips.forEach(s=>{
        const anchor=document.querySelector(`[data-central-reservation="${CSS.escape(String(s.id))}"]`)?.closest('.central-item');if(!anchor)return;
        const code=anchor.querySelector('.central-reservation-code');if(code&&!code.textContent.includes('IDA'))code.textContent=`${code.textContent.trim()} · IDA`;
        const dateSpan=[...anchor.querySelectorAll('.central-meta span')].find(x=>/Ida\s/i.test(x.textContent)||x.textContent.includes(br(s.date)));if(dateSpan&&s.date)dateSpan.textContent=`Ida ${br(s.date)}`;
        const r=reservationFor(s);const rep=returnRepasse(s,r);const status=returnStatus(s,rep);
        const item=document.createElement('article');item.className='central-item central-return-item';
        let actions=`<button class="mini-button" type="button" data-return-reservation="${esc(s.id)}">Ver reserva</button>`;
        if(status==='Aguardando repasse')actions+=`<button class="primary-button" type="button" data-return-prepare="${esc(s.id)}">Preparar repasse</button>`;
        if(status==='Repassado'){if(rep)actions+=`<button class="outline-button" type="button" data-return-resend="${esc(rep.id)}">Reenviar WhatsApp</button>`;actions+=`<button class="primary-button" type="button" data-return-done="${esc(s.id)}">Marcar realizado</button>`}
        if(status==='Cancelado')actions+=`<button class="outline-button" type="button" data-return-reopen="${esc(s.id)}">Reabrir</button>`;
        if(status!=='Cancelado'&&status!=='Realizado')actions+=`<button class="mini-button" type="button" data-return-cancel="${esc(s.id)}">Cancelar</button>`;
        item.innerHTML=`<div class="central-item-main"><div class="central-item-top"><span class="central-reservation-code">${esc(r?.reservationCode||'RESERVA')} · VOLTA</span><span class="central-status ${cls(status)}">${esc(status)}</span></div><h3>${esc(s.returnService||s.service||'Serviço')} <small style="font-weight:700">· volta</small></h3><div class="central-meta"><span>${esc(r?.client||'Passageiro não informado')}</span><span>Volta ${br(s.returnDate)}</span>${r?.people?`<span>${r.people} pessoa${Number(r.people)===1?'':'s'}</span>`:''}${s.returnRepasseAmount!==null&&s.returnRepasseAmount!==undefined?`<span>Repasse/NET ${money(s.returnRepasseAmount)}</span>`:''}${s.returnRoute?`<span><strong>Rota:</strong> ${esc(s.returnRoute)}</span>`:''}</div>${s.dropoff||s.boarding?`<div class="central-route"><strong>Operação:</strong> ${esc(s.dropoff||'')} → ${esc(s.boarding||'')}</div>`:''}</div><div class="central-actions">${actions}</div>`;
        anchor.insertAdjacentElement('afterend',item);
      });
      const host=document.getElementById('centralRepasseList');if(host&&!host.dataset.returnBound){host.dataset.returnBound='1';host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.returnPrepare)prepareReturn(b.dataset.returnPrepare);else if(b.dataset.returnReservation)openReservation(b.dataset.returnReservation);else if(b.dataset.returnDone)setStatus(b.dataset.returnDone,'Realizado');else if(b.dataset.returnReopen)setStatus(b.dataset.returnReopen,'Aguardando repasse');else if(b.dataset.returnCancel){if(confirm('Cancelar o trecho de volta?'))setStatus(b.dataset.returnCancel,'Cancelado')}else if(b.dataset.returnResend){const rep=read(REPASSES).find(x=>String(x.id)===String(b.dataset.returnResend));resend(rep)}})}
    }finally{rendering=false}
  }

  document.addEventListener('click',e=>{const b=e.target.closest('[data-central-prepare]');if(!b)return;const s=services().find(x=>String(x.id)===String(b.dataset.centralPrepare));if(!s?.roundTripSameMode||!s.returnDate)return;e.preventDefault();e.stopImmediatePropagation();prepareOutbound(s.id)},true);

  const wait=setInterval(()=>{const host=document.getElementById('centralRepasseList');if(!host)return;clearInterval(wait);new MutationObserver(()=>setTimeout(renderReturns,0)).observe(host,{childList:true});renderReturns()},100);
  window.addEventListener('storage',()=>setTimeout(renderReturns,0));
})();