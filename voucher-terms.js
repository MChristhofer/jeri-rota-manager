(function(){
  'use strict';
  // Resumo operacional da politica publicada pela Jeri Rota.
  // Não substituir contrato/versão aceita por termos atualizados.
  const url='https://www.jerirota.com.br/termos-e-condicoes/';
  const version='2026-09-11';
  const copies={
    pt:{
      title:'CONDIÇÕES GERAIS DE CONTRATAÇÃO', subtitle:'Resumo das condições operacionais da Jeri Rota',
      summary:'Este resumo acompanha o voucher para orientação. O contrato, suas condições específicas e a versão dos Termos aceita na contratação prevalecem, observados os direitos previstos na legislação.',
      clauses:[
        ['Confirmação e conferência','Confira nomes, serviços, quantidade, datas e locais do voucher e comunique divergências imediatamente. A reserva depende de confirmação escrita.'],
        ['Inclusões','Somente estão incluídos os serviços descritos na proposta confirmada, no voucher ou no comprovante. Despesas opcionais, ingressos e taxas não especificadas são extras.'],
        ['Embarque e no-show','Esteja pronto no local e horário confirmados com telefone acessível. Atrasos ou ausência podem inviabilizar a execução, sobretudo nos serviços compartilhados.'],
        ['Bagagens','Bagagem especial, excesso de volumes e equipamentos esportivos devem ser informados previamente; podem gerar custo adicional ou ser recusados por segurança.'],
        ['Transportes compartilhados','Pontos, horários, veículo e ordem das paradas podem variar conforme a logística, o trânsito e as condições operacionais.'],
        ['Transportes privativos','O veículo é reservado para o grupo contratado. Alterações de percurso, paradas ou horários dependem de viabilidade e eventual custo adicional.'],
        ['Alterações de reserva','Sujeitas à disponibilidade e às condições previamente informadas. Como referência geral, o site prevê taxas operacionais de até R$ 50 por passageiro no compartilhado e R$ 150 por reserva no privativo ou pacote.'],
        ['Cancelamento — política geral','Sem condição específica e ressalvados os direitos legais: mais de 30 dias até 10%; de 15 a 30 dias até 20%; de 7 a 14 dias até 30%; de 72 horas a 6 dias até 50%. A menos de 72 horas, no-show ou após o início, a retenção pode chegar a 100% somente nas condições previstas nos Termos.'],
        ['Condições especiais','Feriados, alta temporada, tarifas promocionais e prestadores podem ter regras próprias, desde que informadas ao cliente de forma válida.'],
        ['Clima e segurança','Condições naturais, trânsito, interdições ou segurança podem exigir ajustes de horários, veículos ou itinerários, preservando-se, quando possível, as características essenciais.'],
        ['Hospedagens e parceiros','Regras específicas de hotéis e outros prestadores podem integrar a contratação quando comunicadas. A intermediação não exclui responsabilidades previstas em lei.'],
        ['Dados e assistência','A documentação necessária pode ser solicitada para executar os serviços. Atendimento humano de segunda a sábado, 9h–19h (Fortaleza); suporte automático 24h.']
      ],
      link:'Íntegra oficial e versão aplicável', footer:'Condições gerais • Jeri Rota'
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