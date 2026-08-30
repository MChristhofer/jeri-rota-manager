(function () {
  const form = document.getElementById('reservationForm');
  if (!form) return;

  const value = name => String(form.elements[name]?.value || '').trim();
  const fieldValue = (card, name) => String(card?.querySelector(`[data-field="${name}"]`)?.value || '').trim();
  const formatDate = raw => {
    if (!raw) return '';
    const date = new Date(`${raw.slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat('pt-BR').format(date);
  };

  function firstServiceCard() {
    return document.querySelector('#reservationServiceDrafts .reservation-service-draft');
  }

  function serviceName(card) {
    const catalog = card?.querySelector('[data-service-catalog-select]');
    return String(
      catalog?.selectedOptions?.[0]?.textContent ||
      catalog?.value ||
      fieldValue(card, 'title') ||
      fieldValue(card, 'service') ||
      fieldValue(card, 'tour') ||
      value('service') ||
      'Não informado'
    ).trim();
  }

  function buildMessage() {
    const card = firstServiceCard();
    const date = fieldValue(card, 'date') || value('date');
    const time = fieldValue(card, 'time') || value('time') || value('serviceTime');
    const boarding = fieldValue(card, 'boarding') || value('boarding');
    const dropoff = fieldValue(card, 'dropoff') || value('dropoff');
    const notes = value('notes');
    const lines = [
      '*REPASSE DE RESERVA*',
      '',
      `Cliente: ${value('client') || 'Não informado'}`,
      `Serviço: ${serviceName(card)}`,
      `Data: ${formatDate(date) || 'Não informada'}`
    ];

    if (time) lines.push(`Horário: ${time}`);
    lines.push(
      `Embarque: ${boarding || 'Não informado'}`,
      `Desembarque: ${dropoff || 'Não informado'}`,
      `Passageiros: ${value('people') || '1'}`
    );
    if (notes) lines.push(`Observações importantes: ${notes}`);
    return lines.join('\n');
  }

  function ensureSection() {
    let section = document.getElementById('reservationRepasseMessage');
    if (section) return section;

    section = document.createElement('details');
    section.id = 'reservationRepasseMessage';
    section.className = 'reservation-repasse-message';
    section.innerHTML = `
      <summary><span>Repasse</span><small>Mensagem pronta para a operação</small></summary>
      <div class="reservation-repasse-content">
        <textarea id="reservationRepassePreview" readonly aria-label="Mensagem de repasse"></textarea>
        <div class="reservation-repasse-actions">
          <button class="outline-button" id="copyReservationRepasse" type="button">Copiar mensagem</button>
          <button class="primary-button" id="whatsappReservationRepasse" type="button">Enviar no WhatsApp</button>
        </div>
        <small class="reservation-repasse-feedback" id="reservationRepasseFeedback" aria-live="polite"></small>
      </div>`;

    const notes = form.elements.notes?.closest('label');
    if (notes) notes.insertAdjacentElement('afterend', section);
    else form.querySelector('#submitReservation')?.insertAdjacentElement('beforebegin', section);

    section.querySelector('#copyReservationRepasse').addEventListener('click', copyMessage);
    section.querySelector('#whatsappReservationRepasse').addEventListener('click', openWhatsApp);
    section.addEventListener('toggle', refresh);
    return section;
  }

  function feedback(message) {
    const output = document.getElementById('reservationRepasseFeedback');
    if (!output) return;
    output.textContent = message;
    window.clearTimeout(feedback.timer);
    feedback.timer = window.setTimeout(() => { output.textContent = ''; }, 2500);
  }

  function refresh() {
    ensureSection();
    const preview = document.getElementById('reservationRepassePreview');
    if (preview) preview.value = buildMessage();
  }

  async function copyMessage() {
    const message = buildMessage();
    try {
      await navigator.clipboard.writeText(message);
    } catch (_) {
      const preview = document.getElementById('reservationRepassePreview');
      preview.value = message;
      preview.select();
      document.execCommand('copy');
      preview.setSelectionRange(0, 0);
    }
    feedback('Mensagem copiada.');
  }

  function openWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  const observer = new MutationObserver(refresh);
  const watchServices = () => {
    const host = document.getElementById('reservationServiceDrafts');
    if (!host) return false;
    observer.observe(host, { childList: true, subtree: true });
    refresh();
    return true;
  };

  ensureSection();
  refresh();
  if (!watchServices()) {
    const timer = window.setInterval(() => {
      if (watchServices()) window.clearInterval(timer);
    }, 100);
  }
})();
