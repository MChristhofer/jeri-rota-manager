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
  const shortTime=value=>String(value||'').slice(0,5);
  let visibleMonth=null;

  function serviceEvents(){
    const services=readServices();const list=[];
    for(const reservation of reservations){
      const linked=services.filter(service=>String(service.reservationId)===String(reservation.id));
      const operational=linked.length?linked:[{id:`fallback-${reservation.id}`,date:reservation.date,title:reservation.service,service:reservation.service,boarding:reservation.boarding||'',responsible:reservation.responsible||''}];
      operational.forEach((service,index)=>{
        const meta=decodeMeta(service.responsible);const title=service.title||service.service||service.tour||reservation.service||'Serviço';
        const outbound=parseDate(service.date||reservation.date);
        if(outbound)list.push({date:outbound,leg:'IDA',time:shortTime(service.startTime||service.time||meta.startTime),endTime:shortTime(service.endTime||meta.endTime),client:reservation.client,title,place:service.boarding||meta.boardingPoints?.[0]?.location||'',reservationId:reservation.id,serviceIndex:index});
        const returning=parseDate(service.returnDate);
        if(returning)list.push({date:returning,leg:'VOLTA',time:shortTime(service.endTime||meta.endTime||service.startTime||meta.startTime),client:reservation.client,title,place:service.dropoff||meta.dropoffPoints?.[0]?.location||'',reservationId:reservation.id,serviceIndex:index});
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
    return `<button type="button" class="calendar-event ${event.leg.toLowerCase()}" data-calendar-reservation="${event.reservationId}" aria-label="Abrir reserva de ${escape(event.client)}"><span class="calendar-event-top"><b>${event.leg}</b>${time}</span><strong>${escape(event.client)}</strong><small>${escape(event.title)}</small>${event.place?`<small class="calendar-event-place">${escape(event.place)}</small>`:''}${returnTime}</button>`;
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
    host.querySelectorAll('[data-calendar-reservation]').forEach(button=>button.addEventListener('click',()=>{const id=Number(button.dataset.calendarReservation);if(typeof window.openModal==='function')window.openModal(id);else try{openModal(id)}catch{}}));
  }

  const baseRender=window.renderDashboard||renderDashboard;
  window.renderDashboard=function(){baseRender();renderCalendar()};
  try{renderDashboard=window.renderDashboard}catch{}
  window.addEventListener('jeri:cloud-ready',renderCalendar);
  window.addEventListener('storage',event=>{if(!event.key||event.key===SERVICES_KEY||event.key==='jeri-rota-manager-reservas-v1')renderCalendar()});
  renderCalendar();
})();
