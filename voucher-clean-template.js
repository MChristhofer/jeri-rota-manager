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
  const formalLabels={
    pt:{doc:'Nº Doc',name:'Nome',address:'Local de embarque',holder:'Titular',email:'E-mail',phone:'Fone',language:'Idioma',checkin:'Check-In',checkout:'Check-Out',pax:'PAX',item:'Item',check:'Rese. / Chk-In',out:'Check-Out',observations:'Observações',type:'Tipo',passenger:'Passageiro',document:'Docto',birth:'Nascimento',nationality:'Nacionalidade',payer:'Pagante',unknown:'Não informado',portuguese:'Português',important:'INFORMAÇÕES IMPORTANTES',responsible:'Responsável',website:'www.jerirota.com.br',valueTotal:'Valor da reserva',valuePaid:'Sinal / valor recebido',valueBalance:'Saldo a pagar',validation:'Validação',terms:'CONDIÇÕES GERAIS'},
    en:{doc:'Document',name:'Name',address:'Pick-up point',holder:'Lead traveller',email:'E-mail',phone:'Phone',language:'Language',checkin:'Check-In',checkout:'Check-Out',pax:'PAX',item:'Item',check:'Booking / Check-In',out:'Check-Out',observations:'Notes',type:'Type',passenger:'Traveller',document:'Document',birth:'Birth date',nationality:'Nationality',payer:'Paying',unknown:'Not informed',portuguese:'English',important:'IMPORTANT INFORMATION',responsible:'Responsible',website:'www.jerirota.com.br',valueTotal:'Booking total',valuePaid:'Amount received',valueBalance:'Balance',validation:'Validation',terms:'GENERAL TERMS'},
    fr:{doc:'Document',name:'Nom',address:'Lieu de prise en charge',holder:'Titulaire',email:'E-mail',phone:'Téléphone',language:'Langue',checkin:'Check-In',checkout:'Check-Out',pax:'PAX',item:'Prestation',check:'Réservation / Check-In',out:'Check-Out',observations:'Observations',type:'Type',passenger:'Voyageur',document:'Document',birth:'Naissance',nationality:'Nationalité',payer:'Payant',unknown:'Non renseigné',portuguese:'Français',important:'INFORMATIONS IMPORTANTES',responsible:'Responsable',website:'www.jerirota.com.br',valueTotal:'Total',valuePaid:'Montant reçu',valueBalance:'Solde',validation:'Validation',terms:'CONDITIONS GÉNÉRALES'},
    es:{doc:'Documento',name:'Nombre',address:'Punto de recogida',holder:'Titular',email:'E-mail',phone:'Teléfono',language:'Idioma',checkin:'Check-In',checkout:'Check-Out',pax:'PAX',item:'Servicio',check:'Reserva / Check-In',out:'Check-Out',observations:'Observaciones',type:'Tipo',passenger:'Pasajero',document:'Documento',birth:'Nacimiento',nationality:'Nacionalidad',payer:'Pagante',unknown:'No informado',portuguese:'Español',important:'INFORMACIÓN IMPORTANTE',responsible:'Responsable',website:'www.jerirota.com.br',valueTotal:'Valor de la reserva',valuePaid:'Importe recibido',valueBalance:'Saldo',validation:'Validación',terms:'CONDICIONES GENERALES'}
  };
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  function systemTerm(value,locale,group){return systemText[locale][group]?.[normalize(value)]||value}
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function brandMark(){
    return '<svg class="vc-inline-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 648" role="img" aria-label="Jeri Rota"><defs><linearGradient id="vcGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9d7627"/><stop offset=".28" stop-color="#e3bd62"/><stop offset=".55" stop-color="#f4d27e"/><stop offset=".78" stop-color="#b48733"/><stop offset="1" stop-color="#e6bf65"/></linearGradient></defs><path fill="url(#vcGold)" fill-rule="evenodd" d="M249 0 L142 26 L70 81 L11 184 L0 276 L22 367 L84 466 L255 344 L257 327 L203 270 L231 216 L228 261 L329 322 L336 347 L322 378 L171 541 L187 590 L260 647 L359 554 L454 432 L498 339 L511 254 L487 153 L436 77 L340 15 Z M58 226 L88 152 L141 97 L207 66 L283 62 L351 86 L408 134 L438 183 L454 259 L443 287 L402 276 L326 230 L252 164 L161 243 L84 285 L68 286 L58 277 Z"/></svg>';
  }
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
    return '<header class="vc-top vc-formal-top"><div class="vc-brand">'+brandMark()+'<div>'+
      '<strong>JERI ROTA</strong><small>'+esc(systemText[locale].branding)+'</small></div></div>'+
      '<div class="vc-company"><strong>JERI ROTA · AGÊNCIA DE TURISMO</strong>'+
      '<span>CNPJ / Cadastur 63.754.344/0001-06</span>'+
      '<span>+55 88 98227-4666 · contato@jerirota.com.br</span>'+
      '<span>www.jerirota.com.br · Ceará · Brasil</span></div></header>';
  }
  function footer(locale,model,index,total){
    const issued=date(model.issued_at,locale);
    return '<footer class="vc-footer vc-formal-footer"><span>www.jerirota.com.br &nbsp; v1.0</span><span class="vc-page-count">'+index+' de '+total+'</span><span>'+esc(issued)+'</span></footer>';
  }
  function serviceRow(service,locale,t,people){
    const details=[];
    if(service?.time)details.push(t.time+': '+service.time);
    if(service?.leg)details.push(t.leg+': '+systemTerm(service.leg,locale,'leg'));
    if(service?.modality)details.push(t.type+': '+systemTerm(service.modality,locale,'modality'));
    if(service?.vehicle)details.push(t.vehicle+': '+service.vehicle);
    if(service?.boarding)details.push(t.boarding+': '+service.boarding);
    if(service?.dropoff)details.push(t.dropoff+': '+service.dropoff);
    const check=date(service?.date,locale);
    return '<div class="vc-formal-service-row">'+
      '<div class="vc-formal-item"><strong>'+esc(title(service,locale))+'</strong>'+(service?.modality?'<small>'+esc(systemTerm(service.modality,locale,'modality'))+'</small>':'')+'</div>'+
      '<div>'+esc(check)+'</div><div>—</div><div>'+esc(details.join(' · ')||'—')+'</div><div class="vc-formal-pax">'+esc(people||1)+'</div></div>';
  }
  function passengerRows(model,locale,f){
    const passengers=Array.isArray(model.passengers)&&model.passengers.length?model.passengers:[model.client||'—'];
    return passengers.map((name,index)=>'<div class="vc-formal-passenger-row">'+
      '<div>'+esc(f.payer)+'</div><div>'+esc(name)+'</div><div>'+(index===0&&model.holder_cpf_masked?esc(model.holder_cpf_masked):'—')+'</div><div>—</div><div>—</div></div>').join('');
  }
  function firstPageClauseCount(serviceCount){
    if(serviceCount<=2)return 7;
    if(serviceCount<=4)return 5;
    if(serviceCount<=6)return 3;
    return 1;
  }
  function importantBlock(model,locale,f){
    const items=locale==='pt'?[
      'Confira todos os dados do voucher antes do serviço e comunique qualquer divergência à equipe Jeri Rota.',
      'Em serviços compartilhados ou privativos, horários, disponibilidade e modalidade seguem a confirmação específica da reserva.',
      'Informe previamente idades de crianças, quantidade de bagagens e itens especiais para validação da opção adequada ao grupo.',
      'Pontos de encontro, horários e orientações de embarque devem ser conferidos antes da execução do serviço.',
      'As condições de pagamento, parcelamento e eventuais taxas são informadas antes da confirmação e podem variar conforme o serviço.'
    ]:[
      'Check all voucher information before the service and report any discrepancy to Jeri Rota.',
      'Times, availability and service type follow the specific booking confirmation.',
      'Inform children ages, baggage quantity and special items in advance.',
      'Check meeting points, times and boarding instructions before the service.',
      'Payment conditions may vary according to the booked service.'
    ];
    const note=model.customer_notes?'<p class="vc-formal-customer-note"><strong>Observação:</strong> '+esc(model.customer_notes)+'</p>':'';
    return '<section class="vc-formal-important"><h2>'+esc(f.important)+'</h2>'+items.map((item,index)=>'<p><b>'+(index+1)+' - </b>'+esc(item)+'</p>').join('')+note+'</section>';
  }
  function firstPageTerms(model,locale,serviceCount){
    const terms=window.JeriVoucherTerms;
    const copy=terms?.translations?.[locale];
    if(!copy)return '';
    const count=Math.min(firstPageClauseCount(serviceCount),copy.clauses.length);
    const clauses=copy.clauses.slice(0,count);
    return '<section class="vc-formal-first-terms"><h2>TERMOS E CONDIÇÕES ESSENCIAIS</h2>'+
      clauses.map((item,index)=>'<div><b>'+(index+1)+' - '+esc(item[0])+':</b> '+esc(item[1])+'</div>').join('')+
      '<small>Continua na página seguinte.</small></section>';
  }
  function page1(model,locale,t,services,number,total,qrPage){
    const f=formalLabels[locale]||formalLabels.pt;
    const passengers=Array.isArray(model.passengers)&&model.passengers.length?model.passengers:[model.client||'—'];
    const period=model.period||{};
    const titular=passengers[0]||model.client||'—';
    const main=[];
    main.push('<section class="vc-formal-sale-bar">VOUCHER Nº ['+esc(model.voucher_number||'—')+'] &nbsp; - &nbsp; Data: '+esc(date(model.issued_at,locale))+'</section>');
    if(number===1){
      main.push('<section class="vc-formal-client">'+
        '<div><b>'+esc(f.doc)+':</b> '+esc(model.holder_cpf_masked||f.unknown)+'</div><div><b>'+esc(f.name)+':</b> '+esc(model.client||f.unknown)+'</div>'+
        '<div class="wide"><b>'+esc(f.address)+':</b> '+esc(model.boarding||f.unknown)+'</div>'+
        '<div><b>'+esc(f.holder)+':</b> '+esc(titular)+'</div><div><b>'+esc(f.email)+':</b> '+esc(model.email||f.unknown)+'</div>'+
        '<div><b>'+esc(f.phone)+':</b> '+esc(model.phone||f.unknown)+'</div><div><b>'+esc(f.language)+':</b> '+esc(f.portuguese)+'</div>'+
        '<div class="vc-formal-dates"><span><b>'+esc(f.checkin)+':</b> '+esc(date(period.start,locale))+'</span><span><b>'+esc(f.checkout)+':</b> '+esc(date(period.end,locale))+'</span><span><b>'+esc(f.pax)+':</b> '+esc(model.people||passengers.length)+'</span></div>'+
      '</section>');
    }
    main.push('<section class="vc-formal-services"><div class="vc-formal-table-head"><div>'+esc(f.item)+'</div><div>'+esc(f.check)+'</div><div>'+esc(f.out)+'</div><div>'+esc(f.observations)+'</div><div>'+esc(f.pax)+'</div></div>'+
      (services.length?services.map(item=>serviceRow(item,locale,t,model.people||passengers.length)).join(''):'<div class="vc-no-services">'+esc(t.noServices)+'</div>')+
      '</section>');
    if(number===1){
      main.push('<section class="vc-formal-passengers"><div class="vc-formal-passenger-head"><div>'+esc(f.type)+'</div><div>'+esc(f.passenger)+'</div><div>'+esc(f.document)+'</div><div>'+esc(f.birth)+'</div><div>'+esc(f.nationality)+'</div></div>'+passengerRows(model,locale,f)+'</section>');
    }
    if(qrPage){
      if(model.show_value){
        main.push('<section class="vc-formal-money"><div><span>'+esc(f.valueTotal)+'</span><strong>'+esc(cash(model.amount,model.currency,locale))+'</strong></div><div><span>'+esc(f.valuePaid)+'</span><strong>'+esc(cash(model.paid_amount,model.currency,locale))+'</strong></div><div><span>'+esc(f.valueBalance)+'</span><strong>'+esc(cash(model.balance,model.currency,locale))+'</strong></div></section>');
      }
      main.push(importantBlock(model,locale,f));
      main.push(firstPageTerms(model,locale,services.length));
      main.push('<section class="vc-formal-validation"><div><strong>'+esc(f.validation)+'</strong><p>'+esc(t.scan)+'</p><b>'+esc(model.voucher_number||'—')+'</b></div>'+
        (model.qr_data_url?'<img class="vc-qr vp-qr" src="'+esc(model.qr_data_url)+'" alt="QR de validação">':'<div class="vc-qr vp-qr vp-qr-pending">'+esc(t.noQr)+'</div>')+
        '<div><strong>Jeri Rota</strong><p>+55 88 98227-4666<br>contato@jerirota.com.br<br>www.jerirota.com.br</p></div></section>');
    }
    return '<section class="vc-page vc-document-page vc-formal-page" data-voucher-page>'+header(t,locale,model)+'<main class="vc-main vc-formal-main">'+main.join('')+'</main>'+footer(locale,model,number,total)+'</section>';
  }
  function termsPage(model,locale,t,number,total,serviceCount){
    const terms=window.JeriVoucherTerms;
    const copy=terms?.translations?.[locale];
    const f=formalLabels[locale]||formalLabels.pt;
    if(!copy)throw new Error('Política geral indisponível para o idioma selecionado.');
    const firstCount=Math.min(firstPageClauseCount(serviceCount),copy.clauses.length);
    const remaining=copy.clauses.slice(firstCount);
    const clauses=remaining.map((item,index)=>'<div class="vc-formal-condition"><h3>'+(firstCount+index+1)+' - '+esc(item[0])+'</h3><p>'+esc(item[1])+'</p></div>').join('');
    return '<section class="vc-page vc-terms-page vc-formal-page vc-formal-page-two" data-voucher-page>'+
      '<main class="vc-main vc-formal-main"><section class="vc-formal-terms-head vc-formal-terms-head-simple"><span>'+esc(model.voucher_number||'—')+' · '+esc(model.client||'')+'</span><h1>'+esc(f.terms)+' · JERI ROTA</h1><p>'+esc(copy.summary)+'</p></section>'+
      '<section class="vc-formal-terms-list">'+clauses+'</section>'+
      '<section class="vc-formal-terms-link"><strong>'+esc(copy.link)+':</strong> '+esc(terms.url)+'<br><small>Conteúdo consultado em '+esc(terms.version)+' · '+esc(copy.footer)+'</small></section>'+
      '<section class="vc-formal-responsible"><div><strong>'+esc(f.responsible)+': Equipe Jeri Rota</strong><br>E-mail: contato@jerirota.com.br<br>Celular/Whats: +55 88 98227-4666</div></section>'+
      '</main>'+footer(locale,model,number,total)+'</section>';
  }
  function render(model){
    const locale=lang(model.language),t=languages[locale],services=Array.isArray(model.services)?model.services:[];
    const groups=chunks(services);
    const total=groups.length+1;
    const result=groups.map((group,i)=>page1(model,locale,t,group,i+1,total,i===groups.length-1));
    result.push(termsPage(model,locale,t,total,total,services.length));
    return '<article class="vc-book" data-voucher-sheet lang="'+locale+'">'+result.join('')+'</article>';
  }
  window.JeriVoucherClean={render,languages,lang};
})();