(function(){
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const OP_META_PREFIX='JR_OP_V1:';
  const byId=id=>document.getElementById(id);
  const readServices=()=>{try{const value=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const escape=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const decodeMeta=value=>{if(!String(value||'').startsWith(OP_META_PREFIX))return{};try{return JSON.parse(decodeURIComponent(String(value).slice(OP_META_PREFIX.length)))}catch{return{}}};
  const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const parseDate=value=>{const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12):null};
  const monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'});
  const fullDate=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const shortTime=value=>String(value||'').slice(0,5);
  const norm=value=>String(value??'').trim().toLowerCase();
  let visibleMonth=null;

  function serviceScore(service){
    let score=0;
    if(service.cloudId)score+=100;
    if(service.serviceCatalogId)score+=40;
    if(Number(service.netTotal)>0||Number(service.repasseAmount)>0)score+=20;
    if(service.returnServiceCatalogId)score+=10;
    if(service.updatedAt||service.updated_at)score+=5;
    return score;
  }

  function dedupeLinkedServices(linked){
    const kept=[];
    for(const service of linked){
      const same=kept.find(existing=>
        norm(existing.date)===norm(service.date)&&
        norm(existing.returnDate)===norm(service.returnDate)&&
        norm(existing.startTime||existing.time)===norm(service.startTime||service.time)&&
        norm(existing.endTime)===norm(service.endTime)&&
        norm(existing.boarding)===norm(service.boarding)&&
        norm(existing.dropoff)===norm(service.dropoff)
      );
      if(!same){kept.push(service);continue}
      const index=kept.indexOf(same);
      const newer=(Date.parse(service.updatedAt||service.updated_at||'')||0)>(Date.parse(same.updatedAt||same.updated_at||'')||0);
      if(newer||serviceScore(service)>serviceScore(same))kept[index]=service;
    }
    return kept;
  }

  function serviceEvents(){
    const services=readServices();const list=[];const seenEvents=new Set();
    for(const reservation of reservations){
      const linked=dedupeLinkedServices(services.filter(service=>String(service.reservationId)===String(reservation.id)));
      const operational=linked.length?linked:[{id:`fallback-${reservation.id}`,date:reservation.date,title:reservation.service,service:reservation.service,boarding:reservation.boarding||'',responsible:reservation.responsible||''}];
      operational.forEach((service,index)=>{
        const meta=decodeMeta(service.responsible);const title=service.title||service.service||service.tour||reservation.service||'Serviço';
        const outbound=parseDate(service.date||reservation.date);
        if(outbound){
          const time=shortTime(service.startTime||service.time||meta.startTime);
          const key=[reservation.id,'IDA',dateKey(outbound),time,norm(service.boarding||meta.boardingPoints?.[0]?.location||'')].join('|');
          if(!seenEvents.has(key)){
            seenEvents.add(key);
            list.push({date:outbound,leg:'IDA',time,endTime:shortTime(service.endTime||meta.endTime),client:reservation.client,title,place:service.boarding||meta.boardingPoints?.[0]?.location||'',reservationId:reservation.id,serviceIndex:index});
          }
        }
        const returning=parseDate(service.returnDate);
        if(returning){
          const time=shortTime(service.endTime||meta.endTime||service.startTime||meta.startTime);
          const key=[reservation.id,'VOLTA',dateKey(returning),time,norm(service.dropoff||meta.dropoffPoints?.[0]?.location||'')].join('|');
          if(!seenEvents.has(key)){
            seenEvents.add(key);
            list.push({date:returning,leg:'VOLTA',time,client:reservation.client,title:service.returnService||title,place:service.dropoff||meta.dropoffPoints?.[0]?.location||'',reservationId:reservation.id,serviceIndex:index});
          }
        }
      });
    }
    return list.sort((a,b)=>a.date-b.date||a.time.localeCompare(b.time));
  }

  function initialMonth(events){
    if(visibleMonth)return visibleMonth;
    const today=new Date();today.setHours(0,0,0,0);const next=events.find(event=>event.date>=today)||events[0];
    visibleMonth=next?new Date(next.date.getFullYear(),next.date.getMonth(),1):new Date(today.getFullYear(),today.getMonth(),1);
    return visibleMonth;
  }

  function eventCard(event){
    const time=event.time?`<span class="calendar-event-time">${escape(event.time)}</span>`:'';
    const returnTime=event.leg==='IDA'&&event.endTime?`<small>Retorno previsto ${escape(event.endTime)}</small>`:'';
    return `<button type="button" class="calendar-event ${event.leg.toLowerCase()}" data-calendar-reservation="${event.reservationId}" data-calendar-service="${event.serviceIndex}" data-calendar-leg="${event.leg}" aria-label="Visualizar reserva de ${escape(event.client)}"><span class="calendar-event-top"><b>${event.leg}</b>${time}</span><strong>${escape(event.client)}</strong><small>${escape(event.title)}</small>${event.place?`<small class="calendar-event-place">${escape(event.place)}</small>`:''}${returnTime}</button>`;
  }

  function detail(label,value){return value?`<div class="calendar-detail"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`:''}
  function openReservationPreview(id,serviceIndex,leg){
    const reservation=reservations.find(item=>String(item.id)===String(id));if(!reservation)return;
    const linked=dedupeLinkedServices(readServices().filter(service=>String(service.reservationId)===String(reservation.id)));
    const service=linked[serviceIndex]||{date:reservation.date,title:reservation.service,service:reservation.service,boarding:reservation.boarding||'',responsible:reservation.responsible||''};
    const meta=decodeMeta(service.responsible);const isReturn=leg==='VOLTA';
    const serviceDate=parseDate(isReturn?service.returnDate:(service.date||reservation.date));
    const time=shortTime(isReturn?(service.endTime||meta.endTime||service.startTime||meta.startTime):(service.startTime||service.time||meta.startTime));
    const boardingPoints=(meta.boardingPoints||[]).map(point=>[point.location,point.apartment?`AP ${point.apartment}`:'',point.passengers].filter(Boolean).join(' · ')).filter(Boolean);
    const dropoffPoints=(meta.dropoffPoints||[]).map(point=>[point.location,point.apartment?`AP ${point.apartment}`:'',point.passengers].filter(Boolean).join(' · ')).filter(Boolean);
    const boarding=boardingPoints.join(' / ')||service.boarding||reservation.boarding||'';
    const dropoff=dropoffPoints.join(' / ')||service.dropoff||'';
    const title=(isReturn&&service.returnService)||service.title||service.service||service.tour||reservation.service||'Serviço';
    let modal=byId('calendarReservationPreview');if(!modal){modal=document.createElement('div');modal.id='calendarReservationPreview';modal.className='modal-backdrop calendar-preview-backdrop';document.body.appendChild(modal)}
    modal.innerHTML=`<article class="modal calendar-preview-modal" role="dialog" aria-modal="true" aria-labelledby="calendarPreviewTitle"><button type="button" class="close-button" data-close-calendar-preview aria-label="Fechar">×</button><p class="eyebrow">${escape(reservation.reservationCode||'RESERVA')}</p><div class="calendar-preview-heading"><div><h2 id="calendarPreviewTitle">${escape(reservation.client)}</h2><p>Visualização da reserva · sem edição</p></div><span class="calendar-preview-leg ${leg.toLowerCase()}">${leg}</span></div><div class="calendar-preview-grid">${detail('Serviço',title)}${detail('Data',serviceDate?fullDate.format(serviceDate):'')}${detail('Horário',time||'Não informado')}${detail('Passageiros',`${reservation.people||1} pessoa${Number(reservation.people)===1?'':'s'}`)}${detail('Telefone',reservation.phone)}${detail('Status',reservation.status)}${detail('Embarque',boarding)}${detail('Desembarque',dropoff)}</div>${reservation.notes?`<div class="calendar-preview-notes"><span>Observações gerais</span><p>${escape(reservation.notes)}</p></div>`:''}<div class="calendar-preview-actions"><button type="button" class="outline-button" data-close-calendar-preview>Fechar visualização</button></div></article>`;
    const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')};
    modal.querySelectorAll('[data-close-calendar-preview]').forEach(button=>button.addEventListener('click',close));
    modal.addEventListener('click',event=>{if(event.target===modal)close()},{once:true});
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');modal.querySelector('[data-close-calendar-preview]')?.focus();
  }

  function renderCalendar(){
    const host=byId('upcomingReservations');const panel=host?.closest('.reservations-panel');if(!host||!panel)return;
    const events=serviceEvents();const month=initialMonth(events);const year=month.getFullYear(),monthIndex=month.getMonth();
    const first=new Date(year,monthIndex,1),lastDay=new Date(year,monthIndex+1,0).getDate();const offset=(first.getDay()+6)%7;
    const eventMap=new Map();events.forEach(event=>{const key=dateKey(event.date);if(!eventMap.has(key))eventMap.set(key,[]);eventMap.get(key).push(event)});
    const todayKey=dateKey(new Date());let cells='';
    for(let i=0;i<offset;i++)cells+='<div class="calendar-day outside" aria-hidden="true"></div>';
    for(let day=1;day<=lastDay;day++){
      const date=new Date(year,monthIndex,day,12),key=dateKey(date),dayEvents=eventMap.get(key)||[];
      cells+=`<div class="calendar-day${key===todayKey?' today':''}${dayEvents.length?' has-events':' empty'}"><div class="calendar-day-number"><span>${day}</span>${dayEvents.length?`<b>${dayEvents.length}</b>`:''}</div><div class="calendar-day-events">${dayEvents.map(eventCard).join('')}</div></div>`;
    }
    const head=panel.querySelector('.panel-head');
    if(head)head.innerHTML=`<div><p class="eyebrow">AGENDA OPERACIONAL</p><h3>Calendário de serviços</h3><small>Idas e voltas organizadas por data</small></div><div class="calendar-controls"><button type="button" data-calendar-today>Hoje</button><button type="button" data-calendar-prev aria-label="Mês anterior">←</button><strong>${escape(monthLabel.format(month))}</strong><button type="button" data-calendar-next aria-label="Próximo mês">→</button></div>`;
    host.className='operational-calendar';
    host.innerHTML=`<div class="calendar-weekdays"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div><div class="calendar-grid">${cells}</div>${events.length?'':'<div class="calendar-empty">Nenhum serviço cadastrado na agenda.</div>'}`;
    panel.querySelector('[data-calendar-prev]')?.addEventListener('click',()=>{visibleMonth=new Date(year,monthIndex-1,1);renderCalendar()});
    panel.querySelector('[data-calendar-next]')?.addEventListener('click',()=>{visibleMonth=new Date(year,monthIndex+1,1);renderCalendar()});
    panel.querySelector('[data-calendar-today]')?.addEventListener('click',()=>{const today=new Date();visibleMonth=new Date(today.getFullYear(),today.getMonth(),1);renderCalendar()});
    host.querySelectorAll('[data-calendar-reservation]').forEach(button=>button.addEventListener('click',()=>openReservationPreview(Number(button.dataset.calendarReservation),Number(button.dataset.calendarService),button.dataset.calendarLeg||'IDA')));
  }

  const baseRender=window.renderDashboard||renderDashboard;
  window.renderDashboard=function(){baseRender();renderCalendar()};
  try{renderDashboard=window.renderDashboard}catch{}
  window.addEventListener('jeri:cloud-ready',renderCalendar);
  window.addEventListener('storage',event=>{if(!event.key||event.key===SERVICES_KEY||event.key==='jeri-rota-manager-reservas-v1')renderCalendar()});
  renderCalendar();
})();
