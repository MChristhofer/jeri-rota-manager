(function(){
  'use strict';
  // Voucher Clean — documento operacional, sem fotografias nem preços internos.
  // O QR é recebido do módulo atual e continua apontando ao token real de validação.
  const languages = {
    pt:{tag:'pt-BR',document:'VOUCHER OFICIAL',sub:'Confirmação de serviços',issued:'Emitido em',reservation:'Reserva',status:'RESERVA CONFIRMADA',cancelled:'VOUCHER CANCELADO',client:'PASSAGEIROS',period:'PERÍODO',people:'PESSOAS',services:'SERVIÇOS CONTRATADOS',date:'DATA',description:'SERVIÇO / DESCRIÇÃO',details:'DETALHES',boarding:'Embarque',dropoff:'Destino',time:'Horário',type:'Modalidade',vehicle:'Veículo',leg:'Trecho',free:'Dia livre',payment:'RESUMO FINANCEIRO',total:'Valor da reserva',paid:'Valor recebido',balance:'Saldo',notes:'OBSERVAÇÕES E ORIENTAÇÕES',pickup:'PONTO DE EMBARQUE',validation:'VALIDAÇÃO DO DOCUMENTO',scan:'Escaneie para consultar a autenticidade e o status do voucher.',support:'ASSISTÊNCIA DURANTE A VIAGEM',conditions:'Os serviços estão sujeitos ao contrato e às condições da reserva. Tarifas de fornecedores não são exibidas neste documento.',noServices:'Nenhum serviço cadastrado.',noNotes:'Consulte as instruções enviadas pela equipe Jeri Rota.',pending:'A definir',noQr:'QR indisponível'},
    en:{tag:'en-GB',document:'OFFICIAL TRAVEL VOUCHER',sub:'Service confirmation',issued:'Issued on',reservation:'Booking',status:'BOOKING CONFIRMED',cancelled:'VOUCHER CANCELLED',client:'TRAVELLERS',period:'TRAVEL DATES',people:'GUESTS',services:'BOOKED SERVICES',date:'DATE',description:'SERVICE / DESCRIPTION',details:'DETAILS',boarding:'Pick-up',dropoff:'Destination',time:'Time',type:'Service type',vehicle:'Vehicle',leg:'Leg',free:'Free day',payment:'PAYMENT SUMMARY',total:'Booking total',paid:'Amount received',balance:'Balance',notes:'NOTES AND INSTRUCTIONS',pickup:'PICK-UP POINT',validation:'DOCUMENT VALIDATION',scan:'Scan to check this voucher’s validity and status.',support:'TRAVEL ASSISTANCE',conditions:'Services are governed by the signed agreement and booking conditions. Supplier rates are not disclosed on this document.',noServices:'No services listed.',noNotes:'Please follow instructions provided by Jeri Rota.',pending:'To be confirmed',noQr:'QR unavailable'},
    fr:{tag:'fr-FR',document:'VOUCHER OFFICIEL DE VOYAGE',sub:'Confirmation des prestations',issued:'Émis le',reservation:'Réservation',status:'RÉSERVATION CONFIRMÉE',cancelled:'VOUCHER ANNULÉ',client:'VOYAGEURS',period:'DATES DU VOYAGE',people:'PERSONNES',services:'PRESTATIONS RÉSERVÉES',date:'DATE',description:'PRESTATION / DESCRIPTION',details:'DÉTAILS',boarding:'Prise en charge',dropoff:'Destination',time:'Horaire',type:'Modalité',vehicle:'Véhicule',leg:'Trajet',free:'Journée libre',payment:'RÉCAPITULATIF FINANCIER',total:'Total de la réservation',paid:'Montant reçu',balance:'Solde',notes:'REMARQUES ET INSTRUCTIONS',pickup:'LIEU DE PRISE EN CHARGE',validation:'VALIDATION DU DOCUMENT',scan:'Scannez pour vérifier l’authenticité et le statut du voucher.',support:'ASSISTANCE PENDANT LE SÉJOUR',conditions:'Les prestations sont régies par le contrat signé et les conditions de réservation. Les tarifs des fournisseurs ne figurent pas sur ce document.',noServices:'Aucune prestation enregistrée.',noNotes:'Consultez les informations transmises par Jeri Rota.',pending:'À confirmer',noQr:'QR indisponible'},
    es:{tag:'es-ES',document:'VOUCHER OFICIAL DE VIAJE',sub:'Confirmación de servicios',issued:'Emitido el',reservation:'Reserva',status:'RESERVA CONFIRMADA',cancelled:'VOUCHER CANCELADO',client:'VIAJEROS',period:'FECHAS DEL VIAJE',people:'PERSONAS',services:'SERVICIOS CONTRATADOS',date:'FECHA',description:'SERVICIO / DESCRIPCIÓN',details:'DETALLES',boarding:'Recogida',dropoff:'Destino',time:'Horario',type:'Modalidad',vehicle:'Vehículo',leg:'Trayecto',free:'Día libre',payment:'RESUMEN FINANCIERO',total:'Total de la reserva',paid:'Importe recibido',balance:'Saldo',notes:'OBSERVACIONES E INSTRUCCIONES',pickup:'PUNTO DE RECOGIDA',validation:'VALIDACIÓN DEL DOCUMENTO',scan:'Escanee para comprobar la autenticidad y el estado del voucher.',support:'ASISTENCIA DURANTE EL VIAJE',conditions:'Los servicios se rigen por el contrato firmado y las condiciones de la reserva. Las tarifas de los proveedores no se muestran en este documento.',noServices:'No hay servicios registrados.',noNotes:'Consulte las instrucciones enviadas por Jeri Rota.',pending:'Por confirmar',noQr:'QR no disponible'}
  };
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function lang(value){return Object.prototype.hasOwnProperty.call(languages,value)?value:'pt'}
  function date(value,locale){
    if(!value)return '—';
    const text=String(value).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return esc(value);
    const parts=text.split('-');
    return parts[2]+'/'+parts[1]+'/'+parts[0];
  }
  function shortDate(value,locale){
    if(!value)return '—';
    const text=String(value).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return esc(value);
    const d=new Date(text+'T12:00:00');
    return new Intl.DateTimeFormat(languages[locale].tag,{day:'2-digit',month:'short'}).format(d);
  }
  function cash(value,currency,locale){
    const iso=/^[A-Z]{3}$/.test(currency||'')?currency:'BRL';
    return new Intl.NumberFormat(languages[locale].tag,{style:'currency',currency:iso}).format(Number(value)||0);
  }
  function title(service,locale){
    // O conteúdo livre não é traduzido automaticamente para não alterar nomes comerciais.
    return service?.title_i18n?.[locale]||service?.titles?.[locale]||service?.translations?.[locale]||service?.title||'—';
  }
  function tags(service,locale,t){
    const items=[];
    if(service?.time)items.push(t.time+': '+service.time);
    if(service?.leg)items.push(t.leg+': '+service.leg);
    if(service?.modality)items.push(t.type+': '+service.modality);
    if(service?.vehicle)items.push(t.vehicle+': '+service.vehicle);
    return items;
  }
  function render(model){
    const locale=lang(model.language),t=languages[locale];
    const passengers=Array.isArray(model.passengers)&&model.passengers.length?model.passengers:[model.client||'—'];
    const services=Array.isArray(model.services)?model.services:[];
    const period=model.period||{};
    const show=Boolean(model.show_value);
    const status=model.status==='cancelled'?t.cancelled:t.status;
    const html=[];
    html.push('<article class="voucher-sheet vc-sheet" data-voucher-sheet lang="'+locale+'">');
    html.push('<header class="vc-top"><div class="vc-brand"><img src="jeri-rota-mark.svg" alt="" crossorigin="anonymous"><div><div class="vc-brand-name">JERI ROTA</div><div class="vc-brand-small">TURISMO PERSONALIZADO</div></div></div><div class="vc-status">'+esc(status)+'</div></header>');
    html.push('<section class="vc-head"><p class="vc-overline">'+t.sub+'</p><h1>'+t.document+'</h1><div class="vc-reference">'+esc(model.voucher_number||'—')+'</div><div class="vc-id-meta">'+t.reservation+': <strong>'+esc(model.reservation_code||'—')+'</strong><span>·</span>'+t.issued+' '+date(model.issued_at,locale)+'</div></section>');
    html.push('<section class="vc-summary"><div><span>'+t.client+'</span><strong>'+passengers.map(esc).join(' &amp; ')+'</strong></div><div><span>'+t.period+'</span><strong>'+date(period.start,locale)+' – '+date(period.end,locale)+'</strong></div><div><span>'+t.people+'</span><strong>'+esc(model.people||passengers.length)+'</strong></div></section>');
    html.push('<section class="vc-section"><h2>'+t.services+'</h2><div class="vc-service-table"><div class="vc-service-header"><div>'+t.date+'</div><div>'+t.description+'</div><div>'+t.details+'</div></div>');
    if(!services.length)html.push('<div class="vc-no-services">'+t.noServices+'</div>');
    services.forEach(service=>{
      const route=[service.boarding? t.boarding+': '+service.boarding:'',service.dropoff? t.dropoff+': '+service.dropoff:''].filter(Boolean);
      const meta=tags(service,locale,t);
      html.push('<div class="vc-service-row"><div class="vc-service-date">'+shortDate(service.date,locale)+'</div><div class="vc-service-main"><strong>'+esc(title(service,locale))+'</strong>'+(route.length?'<small>'+route.map(esc).join(' · ')+'</small>':'')+'</div><div class="vc-service-details">'+(meta.length?meta.map(esc).join(' · '):'—')+'</div></div>');
    });
    html.push('</div></section>');
    if(model.boarding||model.boarding_time)html.push('<section class="vc-card"><h2>'+t.pickup+'</h2><p>'+esc(model.boarding||t.pending)+(model.boarding_time?' · '+t.time+': '+esc(model.boarding_time):'')+'</p></section>');
    if(show)html.push('<section class="vc-section vc-payment"><h2>'+t.payment+'</h2><div class="vc-money"><div><span>'+t.total+'</span><strong>'+cash(model.amount,model.currency,locale)+'</strong></div><div><span>'+t.paid+'</span><strong>'+cash(model.paid_amount,model.currency,locale)+'</strong></div><div><span>'+t.balance+'</span><strong>'+cash(model.balance,model.currency,locale)+'</strong></div></div></section>');
    if(model.customer_notes)html.push('<section class="vc-card"><h2>'+t.notes+'</h2><p>'+esc(model.customer_notes)+'</p></section>');
    html.push('<div class="vc-bottom"><section class="vc-verify"><div><h2>'+t.validation+'</h2><p>'+t.scan+'</p><strong>'+esc(model.voucher_number||'—')+'</strong></div>'+(model.qr_data_url?'<img class="vc-qr vp-qr" alt="QR" src="'+esc(model.qr_data_url)+'">':'<div class="vc-qr vp-qr vp-qr-pending">'+t.noQr+'</div>')+'</section><section class="vc-contact"><h2>'+t.support+'</h2><strong>+55 88 98227-4666</strong><p>contato@jerirota.com.br</p><p>www.jerirota.com.br</p></section></div>');
    html.push('<footer class="vc-footer"><span>JERI ROTA · CNPJ 63.754.344/0001-06</span><span>'+t.conditions+'</span></footer>');
    html.push('</article>');
    return html.join('');
  }
  window.JeriVoucherClean={render,languages,lang};
})();