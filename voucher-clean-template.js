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
  const systemText={
    pt:{branding:'TURISMO PERSONALIZADO',leg:{'IDA':'Ida','VOLTA':'Volta','IDA E VOLTA':'Ida e volta','BATE E VOLTA':'Bate-volta','SERVIÇO':'Serviço'},modality:{'PRIVATIVO':'Privativo','PRIVADO':'Privativo','COMPARTILHADO':'Compartilhado','SEMI-PRIVADO':'Semi-privativo','SEMI-PRIVATIVO':'Semi-privativo'}},
    en:{branding:'TAILOR-MADE TRAVEL',leg:{'IDA':'Outbound','VOLTA':'Return','IDA E VOLTA':'Round trip','BATE E VOLTA':'Day trip','SERVIÇO':'Service'},modality:{'PRIVATIVO':'Private','PRIVADO':'Private','COMPARTILHADO':'Shared','SEMI-PRIVADO':'Semi-private','SEMI-PRIVATIVO':'Semi-private'}},
    fr:{branding:'VOYAGES SUR MESURE',leg:{'IDA':'Aller','VOLTA':'Retour','IDA E VOLTA':'Aller-retour','BATE E VOLTA':'Excursion à la journée','SERVIÇO':'Prestation'},modality:{'PRIVATIVO':'Privé','PRIVADO':'Privé','COMPARTILHADO':'Partagé','SEMI-PRIVADO':'Semi-privé','SEMI-PRIVATIVO':'Semi-privé'}},
    es:{branding:'VIAJES PERSONALIZADOS',leg:{'IDA':'Ida','VOLTA':'Regreso','IDA E VOLTA':'Ida y vuelta','BATE E VOLTA':'Excursión de un día','SERVIÇO':'Servicio'},modality:{'PRIVATIVO':'Privado','PRIVADO':'Privado','COMPARTILHADO':'Compartido','SEMI-PRIVADO':'Semiprivado','SEMI-PRIVATIVO':'Semiprivado'}}
  };
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  function systemTerm(value,locale,group){return systemText[locale][group]?.[normalize(value)]||value}
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
    if(service?.leg)items.push(t.leg+': '+systemTerm(service.leg,locale,'leg'));
    if(service?.modality)items.push(t.type+': '+systemTerm(service.modality,locale,'modality'));
    if(service?.vehicle)items.push(t.vehicle+': '+service.vehicle);
    return items;
  }
  // Com 12 ou menos serviços, uma página de confirmação e uma página deliberada
  // de condições. Com mais serviços, as linhas são distribuídas de modo equilibrado
  // antes da página de condições (evita uma página com apenas um item).
  function chunks(items,maxSize=12){
    if(items.length<=maxSize)return [items];
    const count=Math.ceil(items.length/maxSize),base=Math.floor(items.length/count),extra=items.length%count;
    const pages=[];let offset=0;
    for(let i=0;i<count;i++){const size=base+(i<extra?1:0);pages.push(items.slice(offset,offset+size));offset+=size}
    return pages;
  }
  function header(t,locale,model){
    return '<header class="vc-top"><div class="vc-brand"><img src="jeri-rota-mark.svg" crossorigin="anonymous" alt=""><div>'+
      '<strong>JERI ROTA</strong><small>'+esc(systemText[locale].branding)+'</small></div></div>'+
      '<div class="vc-company"><strong>JERI ROTA · AGÊNCIA DE TURISMO</strong>'+
      '<span>CNPJ / Cadastur 63.754.344/0001-06</span>'+
      '<span>contato@jerirota.com.br · +55 88 98227-4666</span>'+
      '<span>www.jerirota.com.br · Fortaleza/CE · Brasil</span></div></header>';
  }
  function footer(locale,model,index,total){
    const place={pt:'Página',en:'Page',fr:'Page',es:'Página'}[locale];
    return '<footer class="vc-footer"><span>JERI ROTA · '+esc(model.voucher_number||'—')+'</span><span>'+place+' '+index+' / '+total+'</span></footer>';
  }
  function serviceRow(service,locale,t){
    const details=tags(service,locale,t);
    // Locais são exibidos uma única vez, em linha própria.
    const pickup=service.boarding||'';
    const destination=service.dropoff||'';
    const route=pickup||destination?
      '<div class="vc-service-route">'+(pickup?'<span>'+esc(t.boarding)+': '+esc(pickup)+'</span>':'')+
      (destination?'<span>'+esc(t.dropoff)+': '+esc(destination)+'</span>':'')+'</div>':'';
    return '<div class="vc-service-row">'+
      '<div class="vc-service-date">'+esc(shortDate(service.date,locale))+'</div>'+
      '<div class="vc-service-main"><strong>'+esc(title(service,locale))+'</strong>'+route+'</div>'+
      '<div class="vc-service-details">'+esc(details.join(' · ')||'—')+'</div></div>';
  }
  function page1(model,locale,t,services,number,total,qrPage){
    const passengers=Array.isArray(model.passengers)&&model.passengers.length?model.passengers:[model.client||'—'];
    const period=model.period||{};
    const main=[];
    main.push('<section class="vc-head"><div class="vc-document-title"><div><span>'+t.sub+'</span><h1>'+t.document+'</h1></div><div class="vc-status '+(model.status==='cancelled'?'vc-cancelled':'')+'">'+esc(model.status==='cancelled'?t.cancelled:t.status)+'</div></div>'+
      '<div class="vc-reference">'+esc(model.voucher_number||'—')+'</div><div class="vc-id-meta">'+t.reservation+': '+esc(model.reservation_code||'—')+' &nbsp; · &nbsp; '+t.issued+' '+esc(date(model.issued_at,locale))+'</div></section>');
    if(number===1){
      main.push('<section class="vc-summary"><div><span>'+t.client+'</span><strong>'+passengers.map(esc).join(' / ')+'</strong>'+
        (model.holder_cpf_masked?'<small>CPF: '+esc(model.holder_cpf_masked)+'</small>':'')+'</div>'+
        '<div><span>'+t.period+'</span><strong>'+esc(date(period.start,locale))+' – '+esc(date(period.end,locale))+'</strong></div>'+
        '<div><span>'+t.people+'</span><strong>'+esc(model.people||passengers.length)+'</strong></div></section>');
    }
    main.push('<section class="vc-section vc-services"><h2>'+t.services+'</h2><div class="vc-service-table"><div class="vc-service-header"><div>'+t.date+'</div><div>'+t.description+'</div><div>'+t.details+'</div></div>');
    if(!services.length)main.push('<div class="vc-no-services">'+t.noServices+'</div>');
    main.push(services.map(item=>serviceRow(item,locale,t)).join(''));
    main.push('</div></section>');
    if(qrPage){
      if(model.boarding||model.boarding_time)main.push('<section class="vc-pickup"><strong>'+t.pickup+'</strong><span>'+esc(model.boarding||t.pending)+(model.boarding_time?' · '+t.time+': '+esc(model.boarding_time):'')+'</span></section>');
      if(model.show_value)main.push('<section class="vc-money"><div><small>'+t.total+'</small><strong>'+esc(cash(model.amount,model.currency,locale))+'</strong></div><div><small>'+t.paid+'</small><strong>'+esc(cash(model.paid_amount,model.currency,locale))+'</strong></div><div><small>'+t.balance+'</small><strong>'+esc(cash(model.balance,model.currency,locale))+'</strong></div></section>');
      if(model.customer_notes)main.push('<section class="vc-notes"><strong>'+t.notes+'</strong><p>'+esc(model.customer_notes)+'</p></section>');
      main.push('<section class="vc-validation"><div class="vc-validation-text"><strong>'+t.validation+'</strong><span>'+t.scan+'</span><b>'+esc(model.voucher_number||'—')+'</b></div>'+
        (model.qr_data_url?'<img class="vc-qr vp-qr" src="'+esc(model.qr_data_url)+'" alt="QR de validação">':'<div class="vc-qr vp-qr vp-qr-pending">'+t.noQr+'</div>')+
        '<div class="vc-assistance"><strong>'+t.support+'</strong><b>+55 88 98227-4666</b><small>contato@jerirota.com.br</small></div></section>');
    }else{
      main.push('<div class="vc-continuation">'+esc(model.voucher_number||'—')+' · '+t.services+'</div>');
    }
    return '<section class="vc-page vc-document-page" data-voucher-page>'+header(t,locale,model)+'<main class="vc-main">'+main.join('')+'</main>'+footer(locale,model,number,total)+'</section>';
  }
  function termsPage(model,locale,t,number,total){
    const terms=window.JeriVoucherTerms;
    const copy=terms?.translations?.[locale];
    if(!copy)throw new Error('Política geral indisponível para o idioma selecionado.');
    const clauses=copy.clauses.map((item,index)=>'<div class="vc-condition"><h3>'+(index+1)+'. '+esc(item[0])+'</h3><p>'+esc(item[1])+'</p></div>').join('');
    return '<section class="vc-page vc-terms-page" data-voucher-page>'+header(t,locale,model)+
      '<main class="vc-main"><div class="vc-terms-head"><span>'+esc(model.voucher_number||'—')+'</span><h1>'+esc(copy.title)+'</h1><h2>'+esc(copy.subtitle)+'</h2><p>'+esc(copy.summary)+'</p></div>'+
      '<div class="vc-terms-grid">'+clauses+'</div><div class="vc-terms-link"><strong>'+esc(copy.link)+'</strong><span>'+esc(terms.url)+'</span><small>Versão publicada no site em '+esc(terms.version)+' · '+esc(copy.footer)+'</small></div></main>'+
      footer(locale,model,number,total)+'</section>';
  }
  function render(model){
    const locale=lang(model.language),t=languages[locale],services=Array.isArray(model.services)?model.services:[];
    const groups=chunks(services);
    const total=groups.length+1;
    const result=groups.map((group,i)=>page1(model,locale,t,group,i+1,total,i===groups.length-1));
    result.push(termsPage(model,locale,t,total,total));
    return '<article class="vc-book" data-voucher-sheet lang="'+locale+'">'+result.join('')+'</article>';
  }
  window.JeriVoucherClean={render,languages,lang};
})();