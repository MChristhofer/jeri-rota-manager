(function(){
  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const SERVICES_KEY='jeri-rota-manager-reservation-services-v1';
  const table=document.getElementById('reservationsTable');
  if(!table)return;

  const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const brDate=value=>{if(!value)return'';const [y,m,d]=String(value).slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:String(value)};
  const phoneDigits=value=>{let digits=String(value||'').replace(/\D/g,'');if((digits.length===10||digits.length===11)&&!digits.startsWith('55'))digits=`55${digits}`;return digits};
  const number=value=>Math.max(0,Number(value)||0);

  function reservationById(id){return read(RESERVATIONS_KEY).find(item=>String(item.id)===String(id))||null}
  function servicesFor(id){return read(SERVICES_KEY).filter(item=>String(item.reservationId)===String(id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))}
  function serviceTitle(service,reservation){return service?.title||service?.service||service?.tour||reservation?.service||'Serviço'}
  function serviceTime(service,returning=false){return returning?(service?.returnTime||service?.return_time||''):(service?.departureTime||service?.startTime||service?.time||'')}
  function dateAndTime(date,time){return [brDate(date),time?`às ${time}`:''].filter(Boolean).join(' ')}

  function details(reservation){
    const services=servicesFor(reservation.id);
    const first=services[0]||null;
    const outboundDate=first?.date||reservation.date||'';
    const returnDate=first?.returnDate||'';
    return{
      service:serviceTitle(first,reservation),
      outbound:dateAndTime(outboundDate,serviceTime(first,false)),
      returning:returnDate?dateAndTime(returnDate,serviceTime(first,true)):'',
      boarding:first?.boarding||reservation.boarding||'',
      dropoff:first?.dropoff||'',
      total:number(reservation.amount),
      received:number(reservation.paidAmount),
      balance:Math.max(0,number(reservation.amount)-number(reservation.paidAmount)),
      people:Math.max(1,Number(reservation.people)||1),
      notes:reservation.notes||''
    };
  }

  function messageFor(reservation){
    const d=details(reservation);
    const lines=['*CONFIRMAÇÃO DE RESERVA | JERI ROTA*','',`Cliente: ${reservation.client||'Não informado'}`];
    if(reservation.reservationCode)lines.push(`Reserva: ${reservation.reservationCode}`);
    lines.push(`Serviço: ${d.service}`);
    if(d.outbound)lines.push(`Data de ida: ${d.outbound}`);
    if(d.returning)lines.push(`Data de volta: ${d.returning}`);
    if(d.boarding)lines.push(`Embarque: ${d.boarding}`);
    if(d.dropoff)lines.push(`Desembarque: ${d.dropoff}`);
    lines.push(`Passageiros: ${d.people}`);
    lines.push('',`Valor total: ${currency.format(d.total)}`,`Valor recebido: ${currency.format(d.received)}`);
    if(d.balance>0)lines.push(`Saldo a receber: ${currency.format(d.balance)}`);
    if(d.notes)lines.push('',`Observações: ${d.notes}`);
    return lines.join('\n');
  }

  function icon(name){
    const paths={
      copy:'<rect x="8" y="8" width="10" height="10" rx="2"/><path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"/>',
      whatsapp:'<path d="M20 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.2-4.4A8.5 8.5 0 1 1 20 11.5Z"/><path d="M8.4 7.6c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.7.8c-.2.2-.2.4-.1.6.5 1 1.2 1.8 2.2 2.3.2.1.4.1.6-.1l.9-1c.2-.2.4-.3.7-.1l1.8.8c.3.1.4.3.4.5 0 .3-.1 1.2-.7 1.8-.6.6-1.5.9-2.5.7-1.6-.3-3.4-1.2-4.9-2.7-1.4-1.4-2.3-3.1-2.6-4.5-.2-.8 0-1.4.3-1.6Z"/>',
      edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/>'
    };
    return `<span class="reservation-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[name]||''}</svg></span>`;
  }

  function decorateRows(){
    table.querySelectorAll('tr').forEach(row=>{
      const cells=row.querySelectorAll('td');
      if(cells.length>=7){
        ['Cliente','Serviço / data','Pessoas','Valor total','Pagamento','Status','Ações'].forEach((label,index)=>cells[index]?.setAttribute('data-label',label));
      }
      row.querySelectorAll('.reservation-action-popover button').forEach(button=>{
        if(button.dataset.actionDecorated==='true')return;
        let type='';
        if(button.dataset.copy)type='copy';
        else if(button.dataset.whatsapp)type='whatsapp';
        else if(button.dataset.edit)type='edit';
        else if(button.dataset.delete)type='trash';
        if(type)button.insertAdjacentHTML('afterbegin',icon(type));
        button.dataset.actionDecorated='true';
      });
      row.querySelectorAll('.row-actions > button,.row-actions > a').forEach(button=>{
        if(/repasse/i.test(button.textContent||''))button.classList.add('repasse-button');
      });
    });
  }

  function ensureModal(){
    let backdrop=document.getElementById('reservationWhatsappPreview');
    if(backdrop)return backdrop;
    backdrop=document.createElement('div');
    backdrop.id='reservationWhatsappPreview';
    backdrop.className='whatsapp-preview-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    backdrop.innerHTML=`
      <div class="whatsapp-preview-modal" role="dialog" aria-modal="true" aria-labelledby="reservationWhatsappPreviewTitle">
        <div class="whatsapp-preview-head">
          <div class="whatsapp-preview-title"><span class="whatsapp-preview-mark">◔</span><div><h3 id="reservationWhatsappPreviewTitle">Pré-visualizar mensagem WhatsApp</h3><p>Confira as informações antes de abrir o WhatsApp.</p></div></div>
          <button type="button" class="whatsapp-preview-close" data-close-whatsapp-preview aria-label="Fechar">×</button>
        </div>
        <div class="whatsapp-preview-body">
          <section class="whatsapp-reservation-summary"><strong>Resumo da reserva</strong><div class="whatsapp-summary-list" data-whatsapp-summary></div></section>
          <section class="whatsapp-message-panel"><strong>Mensagem que será enviada</strong><div class="whatsapp-chat-stage"><div class="whatsapp-message-bubble" data-whatsapp-message></div></div></section>
        </div>
        <div class="whatsapp-preview-footer"><button type="button" class="whatsapp-preview-cancel" data-close-whatsapp-preview>Cancelar</button><button type="button" class="whatsapp-preview-send" data-send-whatsapp-preview>◉ Abrir WhatsApp</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click',event=>{if(event.target===backdrop||event.target.closest('[data-close-whatsapp-preview]'))closePreview()});
    backdrop.querySelector('[data-send-whatsapp-preview]')?.addEventListener('click',sendPreview);
    return backdrop;
  }

  let previewReservation=null;
  function summaryItem(iconText,label,value){if(!value)return'';return `<div class="whatsapp-summary-item"><span>${iconText}</span><div><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></div></div>`}
  function openPreview(reservation){
    if(!reservation)return;
    previewReservation=reservation;
    const d=details(reservation);
    const modal=ensureModal();
    modal.querySelector('[data-whatsapp-summary]').innerHTML=[
      summaryItem('●','Cliente',reservation.client||''),
      summaryItem('◆','Serviço',d.service),
      summaryItem('▣','Data de ida',d.outbound),
      summaryItem('▣','Data de volta',d.returning),
      summaryItem('⌖','Embarque',d.boarding),
      summaryItem('⌖','Desembarque',d.dropoff),
      summaryItem('R$','Valor total',currency.format(d.total)),
      summaryItem('R$','Valor recebido',currency.format(d.received))
    ].join('');
    modal.querySelector('[data-whatsapp-message]').textContent=messageFor(reservation);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    modal.querySelector('[data-close-whatsapp-preview]')?.focus();
  }
  function closePreview(){
    const modal=document.getElementById('reservationWhatsappPreview');
    if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}
    document.body.style.overflow='';
    previewReservation=null;
  }
  function sendPreview(){
    if(!previewReservation)return;
    const text=messageFor(previewReservation);
    const phone=phoneDigits(previewReservation.phone);
    const url=phone?`https://wa.me/${phone}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url,'_blank','noopener');
    try{navigator.clipboard?.writeText(text)}catch{}
    closePreview();
  }

  table.addEventListener('click',event=>{
    const whatsapp=event.target.closest?.('[data-whatsapp]');
    if(!whatsapp)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const menu=whatsapp.closest('details');if(menu)menu.removeAttribute('open');
    openPreview(reservationById(whatsapp.dataset.whatsapp));
  },true);

  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('reservationWhatsappPreview')?.classList.contains('open'))closePreview()});
  new MutationObserver(()=>requestAnimationFrame(decorateRows)).observe(table,{childList:true,subtree:true});
  decorateRows();
})();
