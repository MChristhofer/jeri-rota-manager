(function(){
  'use strict';
  // Resumo operacional da politica publicada pela Jeri Rota.
  // Não substituir contrato/versão aceita por termos atualizados.
  const url='https://www.jerirota.com.br/';
  const version='2026-11-12';
  const copies={
    pt:{
      title:'CONDIÇÕES GERAIS DE CONTRATAÇÃO', subtitle:'Condições essenciais da reserva Jeri Rota',
      summary:'Estas condições resumem informações operacionais e comerciais publicadas pela Jeri Rota e acompanham o voucher para orientar a viagem. Permanecem válidas as condições específicas apresentadas na proposta, no serviço contratado e os direitos obrigatórios previstos na legislação brasileira.',
      clauses:[
        ['Conferência da reserva','Confira nomes, datas, quantidade de passageiros, serviços, modalidade e pontos de embarque. Qualquer divergência deve ser comunicada antes da execução do serviço.'],
        ['Confirmação por sinal','O pagamento do sinal confirma a reserva e cobre a organização inicial do serviço contratado.'],
        ['Formas de pagamento','A Jeri Rota trabalha com Pix e cartão. Condições de parcelamento e eventuais taxas são informadas antes da confirmação.'],
        ['Cancelamento pelo cliente','Após a confirmação, o sinal pago não é devolvido por desistência do cliente. O valor permanece registrado como crédito nominal para uma nova reserva.'],
        ['Uso do crédito','O crédito decorrente de cancelamento pelo cliente depende de disponibilidade, das condições aplicáveis aos parceiros e do pagamento de eventual diferença de valor ou tarifa.'],
        ['Alterações e remarcações','Pedidos de alteração devem ser feitos com a maior antecedência possível. Datas, horários, rotas, modalidades e fornecedores dependem de disponibilidade e podem gerar ajuste de valor.'],
        ['Não comparecimento e atraso','A ausência no local e horário informados, ou atraso que impeça a execução ou cause perda da reserva junto ao parceiro, pode ser considerada serviço utilizado, sem restituição.'],
        ['Cancelamento pela Jeri Rota','Quando o serviço não puder ser realizado por responsabilidade da Jeri Rota, o cliente poderá escolher entre reembolso dos valores pagos ou crédito integral.'],
        ['Direitos legais','Direitos obrigatórios previstos na legislação brasileira permanecem preservados, inclusive o direito de arrependimento quando legalmente aplicável.'],
        ['Condições específicas','Determinados serviços e parceiros podem ter regras próprias. As condições específicas aplicáveis devem ser apresentadas ao cliente antes do pagamento ou da confirmação.'],
        ['Serviços compartilhados e privativos','Passeios e transfers podem ser oferecidos em modalidade compartilhada ou privativa. A disponibilidade varia conforme destino, data e parceiro responsável.'],
        ['Horários e disponibilidade','Horários, duração, disponibilidade e formato de execução variam conforme o serviço e devem ser conferidos na confirmação da reserva e no voucher.'],
        ['Embarque','O cliente deve observar o ponto e o horário de embarque informados. Orientações complementares podem ser enviadas pela equipe antes da execução do serviço.'],
        ['Crianças e necessidades do grupo','Idades das crianças e necessidades específicas do grupo devem ser informadas previamente para que a opção adequada possa ser verificada.'],
        ['Bagagens e itens especiais','Quantidade de bagagens e itens especiais devem ser informados antes da viagem para conferência da capacidade e da opção de transporte adequada.'],
        ['Roteiros combinados','É possível combinar diferentes destinos na mesma viagem. A montagem do roteiro considera tempo disponível, perfil do grupo, disponibilidade e orçamento.'],
        ['Parceiros locais','A Jeri Rota pode utilizar parceiros locais na execução de serviços. A modalidade, o fornecedor responsável e condições específicas devem respeitar o que foi confirmado ao cliente.'],
        ['Contato e suporte','Mantenha telefone de contato acessível para receber orientações sobre serviços confirmados, embarque e eventuais atualizações operacionais.'],
        ['Dados fornecidos pelo cliente','O cliente é responsável por informar corretamente nomes, contatos, datas, quantidade de passageiros, bagagens e demais dados necessários à execução da reserva.'],
        ['Validação do voucher','O QR Code e o número do voucher permitem verificar a autenticidade e o status do documento emitido pela Jeri Rota.']
      ],
      link:'Informações institucionais e política publicada', footer:'Condições da reserva • Jeri Rota'
    },
    en:{
      title:'GENERAL BOOKING TERMS',subtitle:'Jeri Rota operational terms — summary',
      summary:'This is a practical summary. The signed agreement, specific conditions and terms accepted when booking apply, subject to mandatory consumer rights.',
      clauses:[
        ['Booking confirmation','Check passenger names, services, dates, quantities and meeting points. Report errors immediately. Bookings require written confirmation.'],
        ['Included services','Only services expressly confirmed are included. Unlisted entry fees, local taxes, optional activities and personal expenses are extra.'],
        ['Pick-up and no-show','Be ready at the confirmed place and time, with a reachable phone. Delays or absence may prevent service, especially on shared transfers.'],
        ['Luggage','Declare excess or bulky baggage and sports equipment in advance. Restrictions, additional costs or refusal for safety may apply.'],
        ['Shared transport','Pick-up sequence, times, vehicle type and stops may change for logistical, traffic or operational reasons.'],
        ['Private transport','The booked vehicle is reserved for the named group. Extra stops, routes or time extensions require approval and may incur costs.'],
        ['Booking changes','Subject to availability and previously informed terms. The published general reference allows operational charges of up to BRL 50 per person for shared and BRL 150 per booking for private services/packages.'],
        ['Cancellations — general policy','Unless specific conditions or statutory rights apply: over 30 days, up to 10%; 15–30 days, up to 20%; 7–14 days, up to 30%; 72 hours–6 days, up to 50%. Within 72 hours, no-show or after departure, retention may reach 100% only under the conditions detailed in the full terms.'],
        ['Special fares and dates','Holidays, high season, promotional products and providers may have duly disclosed specific conditions.'],
        ['Weather and safety','Natural conditions, traffic, restrictions or safety needs may require reasonable changes to vehicles, times or itineraries.'],
        ['Hotels and partners','Hotel/provider-specific conditions apply when properly communicated. The use of third parties does not override applicable rights.'],
        ['Documentation and support','Necessary personal details may be requested for service provision. Human assistance Monday–Saturday, 9am–7pm Fortaleza time; automated assistance 24h.']
      ],
      link:'Official full terms and applicable version',footer:'General conditions • Jeri Rota'
    },
    fr:{
      title:'CONDITIONS GÉNÉRALES DE RÉSERVATION',subtitle:'Résumé des conditions opérationnelles de Jeri Rota',
      summary:'Ce résumé est informatif. Le contrat signé, ses conditions particulières et la version des conditions acceptée lors de la réservation demeurent applicables, dans le respect des droits obligatoires.',
      clauses:[
        ['Confirmation de réservation','Vérifiez les noms, prestations, dates, quantités et lieux de rendez-vous. Signalez immédiatement toute erreur. La réservation exige une confirmation écrite.'],
        ['Prestations incluses','Seules les prestations expressément confirmées sont incluses. Entrées, taxes, activités facultatives et dépenses personnelles non précisées restent en supplément.'],
        ['Prise en charge et non-présentation','Soyez prêt au lieu et à l’heure confirmés et restez joignable. Un retard ou une absence peut empêcher la prestation, particulièrement en transport partagé.'],
        ['Bagages','Signalez à l’avance les bagages volumineux, supplémentaires ou le matériel sportif. Des restrictions ou frais peuvent s’appliquer.'],
        ['Transports partagés','L’ordre des prises en charge, les horaires, le véhicule et les arrêts peuvent varier pour des raisons logistiques ou opérationnelles.'],
        ['Transports privatifs','Le véhicule est destiné au groupe réservé. Tout arrêt ou changement d’itinéraire ou d’horaire dépend de la faisabilité et peut entraîner un supplément.'],
        ['Modifications','Selon disponibilités et conditions annoncées. À titre de référence générale, le site prévoit des frais opérationnels jusqu’à 50 BRL par personne en partagé et 150 BRL par réservation en privatif ou forfait.'],
        ['Annulation — règle générale','Sauf conditions particulières ou droits légaux : plus de 30 jours, retenue jusqu’à 10 % ; de 15 à 30 jours jusqu’à 20 % ; de 7 à 14 jours jusqu’à 30 % ; de 72 h à 6 jours jusqu’à 50 %. À moins de 72 h, en cas de non-présentation ou après le départ, elle peut atteindre 100 % uniquement dans les situations prévues par les conditions intégrales.'],
        ['Dates et tarifs particuliers','Fériés, haute saison, promotions et prestataires peuvent avoir des règles spéciales valablement communiquées.'],
        ['Météo et sécurité','Les conditions naturelles, la circulation ou la sécurité peuvent nécessiter des adaptations du véhicule, des horaires ou du parcours.'],
        ['Hôtels et partenaires','Les conditions spécifiques des établissements s’appliquent lorsqu’elles ont été communiquées. L’intervention de tiers n’écarte pas les responsabilités légales.'],
        ['Documents et assistance','Des données nécessaires à l’exécution peuvent être demandées. Assistance humaine du lundi au samedi, 9 h–19 h (Fortaleza) ; assistance automatisée 24 h/24.']
      ],
      link:'Texte officiel intégral et version applicable',footer:'Conditions générales • Jeri Rota'
    },
    es:{
      title:'CONDICIONES GENERALES DE CONTRATACIÓN',subtitle:'Resumen de las condiciones operativas de Jeri Rota',
      summary:'Este resumen es informativo. Se aplican el contrato firmado, las condiciones específicas y la versión de los términos aceptada al reservar, sin perjuicio de los derechos legales.',
      clauses:[
        ['Confirmación de reserva','Compruebe los nombres, servicios, fechas, cantidad de personas y puntos de encuentro. Comuníquenos inmediatamente cualquier error.'],
        ['Servicios incluidos','Solo se incluyen los servicios expresamente confirmados. Entradas, tasas, actividades opcionales y gastos no indicados son extras.'],
        ['Recogida y no presentación','Esté preparado en el lugar y la hora confirmados, con teléfono accesible. Un retraso o ausencia puede impedir la prestación, especialmente en servicios compartidos.'],
        ['Equipaje','Informe previamente sobre equipaje extra, voluminoso o deportivo. Pueden aplicarse restricciones o cargos.'],
        ['Transporte compartido','El orden de recogidas, los horarios, el vehículo y las paradas pueden cambiar por razones logísticas u operativas.'],
        ['Transporte privado','El vehículo está reservado para el grupo contratado. Cambios de ruta, paradas u horarios dependen de viabilidad y pueden tener costes adicionales.'],
        ['Cambios','Sujetos a disponibilidad y condiciones comunicadas. Como referencia general, el sitio prevé hasta BRL 50 por pasajero en servicios compartidos y BRL 150 por reserva en privados o paquetes.'],
        ['Cancelación — política general','Salvo condiciones especiales o derechos legales: más de 30 días hasta 10%; de 15 a 30 días hasta 20%; de 7 a 14 días hasta 30%; de 72 h a 6 días hasta 50%. En menos de 72 h, no-show o una vez iniciado el servicio, puede llegar al 100% solo bajo las condiciones completas.'],
        ['Fechas y tarifas especiales','Festivos, temporada alta, promociones y proveedores pueden tener condiciones específicas comunicadas debidamente.'],
        ['Clima y seguridad','El clima, el tráfico, las restricciones o la seguridad pueden requerir ajustes razonables de vehículos, horarios o recorridos.'],
        ['Hoteles y proveedores','Se aplican condiciones particulares comunicadas. Los terceros no eliminan las responsabilidades legales.'],
        ['Documentos y asistencia','Pueden solicitarse datos necesarios para prestar los servicios. Atención humana de lunes a sábado de 9 a 19 h (Fortaleza); atención automatizada 24 h.']
      ],
      link:'Términos oficiales completos y versión aplicable',footer:'Condiciones generales • Jeri Rota'
    }
  };
  window.JeriVoucherTerms={translations:copies,version,url};
})();