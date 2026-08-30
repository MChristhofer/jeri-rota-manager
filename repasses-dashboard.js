(function () {
  const RESERVATIONS_KEY = 'jeri-rota-manager-reservas-v1';
  const SERVICES_KEY = 'jeri-rota-manager-reservation-services-v1';
  const REPASSES_KEY = 'jeri-rota-manager-repasses-v1';
  const byId = id => document.getElementById(id);
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  let selected = null;

  function read(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
  function brDate(value) { if (!value) return 'A definir'; const [year, month, day] = String(value).split('-'); return year && month && day ? `${day}/${month}/${year}` : value; }
  function phoneDigits(value) { let digits = String(value || '').replace(/\D/g, ''); if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`; return digits; }
  function title(service) { return service.title || service.service || service.tour || 'Serviço da reserva'; }
  function phones(reservation) {
    const all = Array.isArray(reservation.phones) ? reservation.phones.map(item => item.phone || item.phoneE164).filter(Boolean) : [];
    if (!all.length && reservation.phone) all.push(reservation.phone);
    return [...new Set(all)];
  }
  function toast(message) {
    const element = byId('toast'); element.textContent = message; element.classList.add('show');
    clearTimeout(window.__repasseToast); window.__repasseToast = setTimeout(() => element.classList.remove('show'), 2400);
  }
  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    const area = document.createElement('textarea'); area.value = text; area.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(area); area.select();
    const copied = document.execCommand('copy'); area.remove(); return copied;
  }

  function serviceData(service, leg) {
    const returning = leg === 'return';
    return {
      date: returning ? service.returnDate : service.date,
      service: returning ? (service.returnService || service.service || title(service)) : title(service),
      route: returning ? (service.returnRoute || service.route || '') : (service.route || ''),
      boarding: returning ? service.dropoff : service.boarding,
      dropoff: returning ? service.boarding : service.dropoff,
      apartment: service.apartment || '',
      amount: returning ? (service.returnRepasseAmount ?? service.repasseAmount) : service.repasseAmount
    };
  }
  function reservationMessage(reservation, service = null, leg = 'outbound', repasseCode = '') {
    const data = service ? serviceData(service, leg) : null;
    const lines = ['*JERI ROTA — DADOS DA RESERVA*'];
    if (reservation.reservationCode) lines.push(`Reserva: ${reservation.reservationCode}`);
    if (repasseCode) lines.push(`Repasse: ${repasseCode}`);
    lines.push(`Passageiro(s): ${reservation.client || 'Não informado'}`);
    const contact = phones(reservation); if (contact.length) lines.push(`${contact.length > 1 ? 'Telefones' : 'Telefone'}: ${contact.join(' / ')}`);
    if (reservation.people) lines.push(`Quantidade: ${reservation.people} pessoa${Number(reservation.people) === 1 ? '' : 's'}`);
    if (data) {
      lines.push(`Trecho: ${leg === 'return' ? 'VOLTA' : 'IDA'}`);
      lines.push(`Data: ${brDate(data.date)}`);
      lines.push(`Serviço: ${data.service}`);
      if (data.route) lines.push(`Rota: ${data.route}`);
      if (data.boarding) lines.push(`Embarque: ${data.boarding}`);
      if (data.dropoff) lines.push(`Desembarque: ${data.dropoff}`);
      if (data.apartment) lines.push(`AP / Quarto: ${data.apartment}`);
      if (data.amount !== null && data.amount !== undefined && data.amount !== '') lines.push(`Valor do repasse: ${currency.format(Number(data.amount) || 0)}`);
    } else {
      if (reservation.date) lines.push(`Data: ${brDate(reservation.date)}`);
      if (reservation.service) lines.push(`Serviço: ${reservation.service}`);
      if (reservation.notes) lines.push(`Observações: ${reservation.notes}`);
    }
    return lines.join('\n');
  }
  function decision(service, leg) { return leg === 'return' ? (service.returnExecutionMode || 'undecided') : (service.executionMode || 'undecided'); }
  function decisionLabel(mode) { return mode === 'repassed' ? 'Repassado' : mode === 'own' ? 'Não repassar' : 'Aguardando decisão'; }
  function reservationServices(reservation) { return read(SERVICES_KEY).filter(service => String(service.reservationId) === String(reservation.id)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)); }
  function legs(service) { return service.returnDate ? ['outbound', 'return'] : ['outbound']; }

  function render() {
    const reservations = read(RESERVATIONS_KEY).filter(item => item.status !== 'Cancelada');
    const search = (byId('repasseSearch').value || '').trim().toLowerCase();
    const date = byId('repasseDate').value;
    const filter = byId('repasseDecisionFilter').value;
    const cards = reservations.map(reservation => ({ reservation, services: reservationServices(reservation) })).filter(({ reservation, services }) => {
      const searchable = [reservation.reservationCode, reservation.client, reservation.phone, reservation.notes, ...services.flatMap(service => [service.title, service.service, service.tour, service.route, service.boarding, service.dropoff])].filter(Boolean).join(' ').toLowerCase();
      const rows = services.flatMap(service => legs(service).map(leg => ({ service, leg, mode: decision(service, leg), date: serviceData(service, leg).date })));
      return (!search || searchable.includes(search)) && (!date || rows.some(row => row.date === date)) && (!filter || rows.some(row => row.mode === filter));
    });
    const allRows = reservations.flatMap(reservation => reservationServices(reservation).flatMap(service => legs(service).map(leg => decision(service, leg))));
    byId('repassePendingCount').textContent = allRows.filter(mode => mode === 'undecided').length;
    byId('repasseSentCount').textContent = allRows.filter(mode => mode === 'repassed').length;
    byId('repasseOwnCount').textContent = allRows.filter(mode => mode === 'own').length;
    const host = byId('repasseReservationList');
    if (!cards.length) { host.innerHTML = '<div class="repasse-empty-state">Nenhuma reserva encontrada com os filtros informados.</div>'; return; }
    host.innerHTML = cards.map(({ reservation, services }) => {
      const contact = phones(reservation).join(' / ') || 'Sem telefone';
      const rows = services.length ? services.flatMap(service => legs(service).map(leg => {
        const data = serviceData(service, leg); const mode = decision(service, leg);
        return `<div class="reservation-service-row"><div><div class="service-row-title"><strong>${escapeHtml(data.service)}</strong><span class="leg-badge">${leg === 'return' ? 'VOLTA' : 'IDA'}</span><span class="decision-badge ${mode === 'undecided' ? 'pending' : mode}">${decisionLabel(mode)}</span></div><div class="service-row-meta"><span>${brDate(data.date)}</span>${data.route ? `<span>${escapeHtml(data.route)}</span>` : ''}${data.amount !== null && data.amount !== undefined && data.amount !== '' ? `<span>Repasse ${currency.format(Number(data.amount) || 0)}</span>` : ''}</div>${data.boarding || data.dropoff ? `<div class="service-row-path"><strong>Operação:</strong> ${escapeHtml(data.boarding || 'A definir')} → ${escapeHtml(data.dropoff || 'A definir')}</div>` : ''}</div><div class="service-row-actions"><button class="outline-button" data-copy-service="${escapeHtml(service.id)}" data-leg="${leg}" data-reservation="${escapeHtml(reservation.id)}" type="button">Copiar</button><button class="primary-button" data-send-service="${escapeHtml(service.id)}" data-leg="${leg}" data-reservation="${escapeHtml(reservation.id)}" type="button">Repassar no WhatsApp</button><button class="text-button" data-own-service="${escapeHtml(service.id)}" data-leg="${leg}" type="button">Não repassar</button></div></div>`;
      })).join('') : '<div class="repasse-empty-state compact">Esta reserva ainda não possui serviços cadastrados.</div>';
      return `<article class="reservation-repasse-card"><header class="reservation-repasse-head"><div><span class="reservation-code">${escapeHtml(reservation.reservationCode || 'RESERVA')}</span><strong>${escapeHtml(reservation.client || 'Passageiro não informado')}</strong><small>${escapeHtml(contact)} · ${Number(reservation.people) || 1} pessoa${Number(reservation.people) === 1 ? '' : 's'}</small>${reservation.notes ? `<small class="reservation-note">${escapeHtml(reservation.notes)}</small>` : ''}</div><div class="reservation-head-actions"><button class="outline-button" data-copy-reservation="${escapeHtml(reservation.id)}" type="button">Copiar reserva</button><button class="outline-button whatsapp" data-share-reservation="${escapeHtml(reservation.id)}" type="button">Enviar reserva pelo WhatsApp</button></div></header>${rows}</article>`;
    }).join('');
  }

  function openModal(reservation, service, leg) {
    selected = { reservation, service, leg };
    byId('repasseRecipientName').value = leg === 'return' ? (service.returnExecutionPartnerName || '') : (service.executionPartnerName || service.responsible || '');
    byId('repasseRecipientPhone').value = leg === 'return' ? (service.returnExecutionPartnerPhone || '') : (service.executionPartnerPhone || '');
    byId('repasseMessagePreview').textContent = reservationMessage(reservation, service, leg);
    byId('repasseModal').classList.add('open'); byId('repasseModal').setAttribute('aria-hidden', 'false');
  }
  function closeModal() { byId('repasseModal').classList.remove('open'); byId('repasseModal').setAttribute('aria-hidden', 'true'); selected = null; }
  function setDecision(serviceId, leg, mode, partner = {}) {
    const services = read(SERVICES_KEY); const index = services.findIndex(item => String(item.id) === String(serviceId)); if (index < 0) return;
    const prefix = leg === 'return' ? 'returnExecution' : 'execution';
    services[index][`${prefix}Mode`] = mode; services[index][`${prefix}DecidedAt`] = new Date().toISOString();
    services[index][`${prefix}PartnerName`] = partner.name || (mode === 'own' ? 'Jeri Rota' : ''); services[index][`${prefix}PartnerPhone`] = partner.phone || '';
    write(SERVICES_KEY, services); render();
  }
  function nextRepasseCode() { const current = read(REPASSES_KEY).reduce((max, item) => Math.max(max, Number(String(item.code || '').replace(/\D/g, '')) || 0), 0); return `REP-${String(current + 1).padStart(5, '0')}`; }

  byId('repasseReservationList').addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    const reservationId = button.dataset.reservation || button.dataset.copyReservation || button.dataset.shareReservation;
    const reservation = read(RESERVATIONS_KEY).find(item => String(item.id) === String(reservationId));
    if (button.dataset.copyReservation) { await copyText(reservationMessage(reservation)); toast('Informações da reserva copiadas.'); return; }
    if (button.dataset.shareReservation) { const text = reservationMessage(reservation); await copyText(text); window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); toast('Reserva copiada e aberta no WhatsApp.'); return; }
    const serviceId = button.dataset.copyService || button.dataset.sendService || button.dataset.ownService;
    const service = read(SERVICES_KEY).find(item => String(item.id) === String(serviceId)); const leg = button.dataset.leg || 'outbound';
    if (button.dataset.copyService) { await copyText(reservationMessage(reservation, service, leg)); toast('Serviço e reserva copiados.'); }
    if (button.dataset.sendService) openModal(reservation, service, leg);
    if (button.dataset.ownService) setDecision(service.id, leg, 'own');
  });
  byId('copyRepasseMessage').addEventListener('click', async () => { await copyText(byId('repasseMessagePreview').textContent); toast('Mensagem copiada.'); });
  byId('sendRepasseWhatsapp').addEventListener('click', () => {
    if (!selected) return; const recipientName = byId('repasseRecipientName').value.trim(); const recipientPhone = byId('repasseRecipientPhone').value.trim(); const digits = phoneDigits(recipientPhone);
    if (!digits) { byId('repasseRecipientPhone').focus(); toast('Informe o WhatsApp do parceiro ou motorista.'); return; }
    const code = nextRepasseCode(); const message = reservationMessage(selected.reservation, selected.service, selected.leg, code); const data = serviceData(selected.service, selected.leg); const repasses = read(REPASSES_KEY);
    repasses.push({ id: `rep-${Date.now()}`, code, number: Number(code.replace(/\D/g, '')), reservationId: selected.reservation.id, reservationCode: selected.reservation.reservationCode || '', reservationServiceId: selected.service.id, reservationLeg: selected.leg, date: data.date || '', service: data.service, route: data.route, boarding: data.boarding, dropoff: data.dropoff, names: selected.reservation.client || '', people: selected.reservation.people || 1, amount: data.amount ?? null, recipientName, recipientPhone, messageSnapshot: message, status: 'Enviado', createdAt: new Date().toISOString() });
    write(REPASSES_KEY, repasses); setDecision(selected.service.id, selected.leg, 'repassed', { name: recipientName, phone: recipientPhone }); window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener'); closeModal(); renderHistory();
  });
  function renderHistory() {
    const search = (byId('historySearch').value || '').trim().toLowerCase(); const date = byId('historyDate').value;
    const items = read(REPASSES_KEY).filter(item => (!search || [item.code, item.reservationCode, item.names, item.service, item.recipientName].join(' ').toLowerCase().includes(search)) && (!date || item.date === date)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    byId('repasseHistoryBody').innerHTML = items.map(item => `<tr><td><strong>${escapeHtml(item.code || '—')}</strong></td><td>${escapeHtml(item.reservationCode || '—')}</td><td>${brDate(item.date)}</td><td>${escapeHtml(item.service || '—')}</td><td>${escapeHtml(item.names || '—')}</td><td>${escapeHtml(item.recipientName || '—')}<small>${escapeHtml(item.recipientPhone || '')}</small></td><td>${item.amount === null || item.amount === undefined ? '—' : currency.format(Number(item.amount) || 0)}</td><td>${item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '—'}</td></tr>`).join('');
    byId('repasseHistoryEmpty').hidden = Boolean(items.length);
  }
  function activateTab(tab) { document.querySelectorAll('.repasse-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab)); document.querySelectorAll('.repasse-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`)); if (tab === 'historico') renderHistory(); }

  document.querySelectorAll('.repasse-tab').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.tab)));
  ['repasseSearch', 'repasseDate', 'repasseDecisionFilter'].forEach(id => { byId(id).addEventListener('input', render); byId(id).addEventListener('change', render); });
  byId('clearRepasseFilters').addEventListener('click', () => { byId('repasseSearch').value = ''; byId('repasseDate').value = ''; byId('repasseDecisionFilter').value = ''; render(); });
  ['historySearch', 'historyDate'].forEach(id => { byId(id).addEventListener('input', renderHistory); byId(id).addEventListener('change', renderHistory); });
  byId('clearHistoryFilters').addEventListener('click', () => { byId('historySearch').value = ''; byId('historyDate').value = ''; renderHistory(); });
  byId('refreshRepassePanel').addEventListener('click', render); byId('closeRepasseModal').addEventListener('click', closeModal); byId('cancelRepasseModal').addEventListener('click', closeModal);
  byId('menuButton').addEventListener('click', () => byId('sidebar').classList.toggle('open'));
  byId('todayLabel').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date()).replace('.', '');
  window.addEventListener('jeri:cloud-ready', () => { render(); renderHistory(); }); window.addEventListener('storage', () => { render(); renderHistory(); });
  render(); renderHistory();
})();
