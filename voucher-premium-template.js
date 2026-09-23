(function(){
  'use strict';

  const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[char]);
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  const shortDate=value=>value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'A definir';
  const serviceDate=value=>value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replaceAll('.','').toUpperCase():'A DEFINIR';
  const titleKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const localImages=[
    [/cumbuco/, 'assets/voucher/cumbuco-buggy.jpg'],
    [/lagoinha/, 'assets/voucher/lagoinha.jpg'],
    [/paracuru/, 'assets/voucher/paracuru-com-buggy.png'],
    [/aguas belas/, 'assets/voucher/aguas-belas.jpg']
  ];

  function fallbackImage(title){return localImages.find(([pattern])=>pattern.test(titleKey(title)))?.[1]||''}
  function splitPassengers(value){return String(value||'').split(/\s*[/,;]\s*/).map(item=>item.trim()).filter(Boolean)}
  function serviceSortKey(service){
    const date=String(service?.date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return [Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY];
    const time=String(service?.time||'').match(/^(\d{1,2}):(\d{2})/);
    const minutes=time?Math.min(Number(time[1]),23)*60+Math.min(Number(time[2]),59):Number.POSITIVE_INFINITY;
    return [Date.parse(`${date}T12:00:00`),minutes];
  }
  function sortServices(services=[]){
    return services.map((service,index)=>({service,index,key:serviceSortKey(service)})).sort((a,b)=>a.key[0]-b.key[0]||a.key[1]-b.key[1]||a.index-b.index).map(item=>item.service);
  }

  function publicViewModel({voucher={},snapshot={},qrDataUrl='',preview=false}){
    const amount=Number(snapshot.amount)||0;
    const paid=Number(snapshot.paid_amount)||0;
    const balance=Math.max(0,Number(snapshot.balance??amount-paid)||0);
    return{
      voucher_number:voucher.voucher_number||(preview?'Número gerado na emissão':'Voucher'),
      reservation_code:snapshot.reservation_code||'A definir',
      issued_at:voucher.issued_at||new Date().toISOString(),
      status:voucher.status||'issued',
      client:snapshot.client||'Cliente',
      passengers:Array.isArray(snapshot.passengers)&&snapshot.passengers.length?snapshot.passengers:splitPassengers(snapshot.client),
      period:snapshot.period||{},
      people:Number(snapshot.people)||1,
      services:sortServices(snapshot.services||[]).map(service=>({
        title:service.title||'Serviço',date:service.date||'',time:service.time||'',modality:service.modality||'',
        vehicle:service.vehicle||'',boarding:service.boarding||'',image_url:service.image_url||fallbackImage(service.title)
      })),
      boarding:snapshot.boarding||'A definir',
      boarding_time:snapshot.boarding_time||snapshot.services?.find(item=>item.time)?.time||'',
      payment_status:snapshot.payment_status||'',amount,paid_amount:paid,balance,
      show_value:voucher.show_value??snapshot.show_value??true,
      customer_notes:snapshot.customer_notes||'',qr_data_url:qrDataUrl
    };
  }

  function serviceCard(service){
    const image=service.image_url
      ?`<img class="vp-service-image" src="${escapeHtml(service.image_url)}" alt="${escapeHtml(service.title)}" crossorigin="anonymous">`
      :'<div class="vp-service-image vp-image-fallback"><img src="jeri-rota-mark.svg" alt=""></div>';
    return`<article class="vp-service-card">
      <div class="vp-service-date">${escapeHtml(serviceDate(service.date)).replace(' ','<br>')}</div>
      ${image}
      <div class="vp-service-copy"><h3>${escapeHtml(service.title)}</h3><div class="vp-service-meta">
        ${service.time?`<span>◷ ${escapeHtml(service.time)}</span>`:''}
        ${service.modality?`<span>♟ ${escapeHtml(service.modality)}</span>`:''}
        ${service.vehicle?`<span>▰ ${escapeHtml(service.vehicle)}</span>`:''}
      </div></div>
    </article>`;
  }

  function render(model){
    const passengers=model.passengers.length?model.passengers:[model.client];
    const payment=model.show_value?`<section class="vp-card vp-payment"><div class="vp-card-title">▤ <span>PAGAMENTO</span></div><div class="vp-payment-values"><div><small>Valor da reserva</small><strong>${money(model.amount)}</strong></div><div><small>Sinal recebido</small><strong>${money(model.paid_amount)}</strong></div></div><div class="vp-balance"><span>${model.balance>0?'SALDO NO EMBARQUE':'RESERVA QUITADA'}</span><strong>${model.balance>0?money(model.balance):'PAGO'}</strong></div></section>`:'';
    return`<article class="voucher-sheet" data-voucher-sheet>
      <header class="vp-hero" aria-label="Jeri Rota - Reserva confirmada"></header>
      <main class="vp-body">
        <section class="vp-number-row"><div><span>VOUCHER OFICIAL DE RESERVA</span><h1>${escapeHtml(model.voucher_number)}</h1><p>Reserva ${escapeHtml(model.reservation_code)} <b>|</b> Emitido em ${escapeHtml(shortDate(model.issued_at))}</p></div><div class="vp-slogan">EXPERIÊNCIAS<br>QUE FICAM<br>PARA SEMPRE</div></section>
        <section class="vp-summary">
          <div><span>● &nbsp; CLIENTE</span><strong>${passengers.map(escapeHtml).join('<br>')}</strong></div>
          <div><span>▣ &nbsp; PERÍODO</span><strong>${escapeHtml(shortDate(model.period.start))} a ${escapeHtml(shortDate(model.period.end))}</strong></div>
          <div><span>♟ &nbsp; PASSAGEIROS</span><strong>${model.people}</strong></div>
        </section>
        <section class="vp-itinerary"><div class="vp-section-heading"><h2>● &nbsp; SEU ROTEIRO</h2><span>JERICOACOARA E REGIÃO &nbsp;•&nbsp; PASSEIOS INCRÍVEIS TE ESPERAM</span></div><div class="vp-services">${model.services.map(serviceCard).join('')}</div></section>
        <section class="vp-two-columns">
          <section class="vp-card vp-boarding"><div class="vp-card-title">● <span>LOCAL DE EMBARQUE</span></div><strong>${escapeHtml(model.boarding)}</strong>${model.boarding_time?`<p>Horário relacionado: <b>${escapeHtml(model.boarding_time)}</b></p>`:''}</section>
          ${payment}
        </section>
        <section class="vp-two-columns vp-bottom-cards">
          <section class="vp-card vp-info"><div class="vp-card-title">● <span>INFORMAÇÕES IMPORTANTES</span></div><ul><li>Apresente este voucher no momento do embarque.</li><li>Chegue ao local com alguns minutos de antecedência.</li><li>Em caso de dúvidas, fale com a equipe Jeri Rota.</li>${model.customer_notes?`<li>${escapeHtml(model.customer_notes)}</li>`:''}</ul></section>
          <section class="vp-card vp-validation">${model.qr_data_url?`<img class="vp-qr" src="${model.qr_data_url}" alt="QR Code de validação">`:'<div class="vp-qr vp-qr-pending">QR</div>'}<div><div class="vp-card-title"><span>VALIDAÇÃO DO VOUCHER</span></div><strong>Documento oficial Jeri Rota</strong><p>Escaneie o QR Code para confirmar autenticidade e status.</p><b>sistema.jerirota.com.br</b><small>${escapeHtml(model.voucher_number)}</small></div></section>
        </section>
      </main>
      <footer class="vp-footer"><div><img src="jeri-rota-mark.svg" alt=""><strong>JERI ROTA<small>Jericoacoara &nbsp;•&nbsp; Ceará</small></strong></div><p>Documento emitido em ${escapeHtml(shortDate(model.issued_at))}<br>Voucher sujeito às condições da reserva.</p><em>Mais que roteiros,<br>boas histórias.</em></footer>
    </article>`;
  }

  window.JeriVoucherPremium={publicViewModel,render,fallbackImage,splitPassengers,sortServices,escapeHtml};
})();
