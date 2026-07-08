const STORAGE_KEY = 'jeri-rota-manager-reservas-v1';

const seedReservations = [
  { id: 1, client: 'Marina Carvalho', phone: '(85) 99999-1111', service: 'Transfer Fortaleza → Jericoacoara', date: dateOffset(1), people: 4, amount: 1000, paidAmount: 300, collectedBy: 'Jeri Rota', status: 'Confirmada', responsible: 'Motorista a confirmar', notes: 'Sinal recebido. Saldo no embarque.', partnerOperation: 'propria', partner: '', netAmount: 0, settledAmount: 0, settlementDate: '' },
  { id: 2, client: 'João Mendes', phone: '(11) 98888-2222', service: 'Passeio Lado Leste', date: dateOffset(0), people: 2, amount: 400, paidAmount: 400, collectedBy: 'Agência Sol Nascente', status: 'Confirmada', responsible: 'Jardineira 03', notes: 'Cliente quitado pela parceira. Aguardar prestação quinzenal.', partnerOperation: 'recebida', partner: 'Agência Sol Nascente', netAmount: 180, settledAmount: 0, settlementDate: dateOffset(8) },
  { id: 3, client: 'Camila Andrade', phone: '(21) 97777-3333', service: 'Hospedagem + Transfer Jeri', date: dateOffset(3), people: 3, amount: 1850, paidAmount: 200, collectedBy: 'Agência Ceará Turismo', status: 'Pendente', responsible: 'Operacional', notes: 'Sinal recebido pela parceira. Aguardar confirmação da hospedagem.', partnerOperation: 'recebida', partner: 'Agência Ceará Turismo', netAmount: 270, settledAmount: 0, settlementDate: dateOffset(11) },
  { id: 4, client: 'Ricardo Oliveira', phone: '(85) 96666-4444', service: '3 Praias: Canoa, Fontes e Morro Branco', date: dateOffset(5), people: 5, amount: 625, paidAmount: 625, collectedBy: 'Jeri Rota', status: 'Confirmada', responsible: 'Micro-ônibus', notes: 'Ponto: Hotel Praia Centro', partnerOperation: 'propria', partner: '', netAmount: 0, settledAmount: 0, settlementDate: '' },
  { id: 5, client: 'Helena Torres', phone: '(31) 95555-5555', service: 'Transfer privativo Jeri → Fortaleza', date: dateOffset(2), people: 2, amount: 1200, paidAmount: 0, collectedBy: 'Não recebido', status: 'Pendente', responsible: 'SW4', notes: 'Parceira executará o serviço. Aguardar sinal para garantir o veículo.', partnerOperation: 'enviada', partner: 'Agência Litoral', netAmount: 800, settledAmount: 0, settlementDate: dateOffset(9) }
];

function dateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function number(value) { return Math.max(0, Number(value) || 0); }

function normalizeReservation(reservation) {
  const amount = number(reservation.amount);
  const hasPaidAmount = Object.prototype.hasOwnProperty.call(reservation, 'paidAmount');
  // Migração dos registros iniciais: o status Confirmada era usado como pagamento integral.
  const legacyPaidAmount = reservation.status === 'Confirmada' ? amount : 0;
  const paidAmount = clamp(Number(hasPaidAmount ? reservation.paidAmount : legacyPaidAmount) || 0, 0, amount);
  const allowedOperations = ['propria', 'recebida', 'enviada'];
  const partnerOperation = allowedOperations.includes(reservation.partnerOperation) ? reservation.partnerOperation : 'propria';
  const netAmount = number(reservation.netAmount);
  const settledAmount = clamp(Number(reservation.settledAmount) || 0, 0, netAmount);
  const collectedBy = reservation.collectedBy || 'Jeri Rota';
  const partner = partnerOperation === 'propria' ? '' : (reservation.partner || 'Parceira a informar');

  return {
    ...reservation,
    amount,
    paidAmount,
    collectedBy,
    people: Math.max(1, Number(reservation.people) || 1),
    responsible: reservation.responsible || 'Responsável a definir',
    notes: reservation.notes || '',
    partnerOperation,
    partner,
    netAmount,
    settledAmount,
    settlementDate: reservation.settlementDate || ''
  };
}

function getReservations() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedReservations));
    return seedReservations.map(normalizeReservation);
  }
  try {
    const parsed = JSON.parse(saved).map(normalizeReservation);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    return seedReservations.map(normalizeReservation);
  }
}

let reservations = getReservations();
let editingReservationId = null;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

function parseLocalDate(value) {
  const [year, month, day] = String(value || dateOffset(0)).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
function saveReservations() { localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations)); }
function statusClass(status) { return String(status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function isToday(date) { return date === dateOffset(0); }
function receivedAmount(reservation) { return clamp(Number(reservation.paidAmount) || 0, 0, Number(reservation.amount) || 0); }
function cashReceivedByJeri(reservation) { return reservation.collectedBy === 'Jeri Rota' ? receivedAmount(reservation) : 0; }
function remainingAmount(reservation) { return Math.max(0, Number(reservation.amount || 0) - receivedAmount(reservation)); }
function isPartnerReservation(reservation) { return reservation.partnerOperation !== 'propria' && Boolean(reservation.partner) && Number(reservation.netAmount) > 0; }
function settlementRemaining(reservation) { return Math.max(0, Number(reservation.netAmount || 0) - Number(reservation.settledAmount || 0)); }
function operationLabel(reservation) {
  if (reservation.partnerOperation === 'recebida') return 'Parceira vendeu · Jeri Rota executa';
  if (reservation.partnerOperation === 'enviada') return 'Jeri Rota vendeu · Parceira executa';
  return 'Venda e operação próprias';
}
function settlementDirection(reservation) {
  if (reservation.partnerOperation === 'recebida') return { label: 'A receber da parceira', className: 'a-receber' };
  if (reservation.partnerOperation === 'enviada') return { label: 'A pagar à parceira', className: 'a-pagar' };
  return { label: 'Sem parceiro', className: 'sem-valor' };
}
function paymentStatus(reservation) {
  const total = Number(reservation.amount) || 0;
  const paid = receivedAmount(reservation);
  if (!total) return { label: 'Sem valor', className: 'sem-valor' };
  if (paid >= total) return { label: 'Cliente quitou', className: 'pago' };
  if (paid > 0) return { label: 'Sinal recebido', className: 'parcial' };
  return { label: 'Sem pagamento', className: 'sem-pagamento' };
}
function settlementStatus(reservation) {
  if (!isPartnerReservation(reservation)) return { label: 'Sem prestação', className: 'sem-valor' };
  const remaining = settlementRemaining(reservation);
  if (!remaining) return { label: 'Quitado', className: 'pago' };
  if (Number(reservation.settledAmount) > 0) return { label: 'Parcial', className: 'parcial' };
  if (remainingAmount(reservation) > 0) return { label: 'Fiado / aguardar cliente', className: 'sem-pagamento' };
  return { label: 'Aguardando repasse', className: 'pendente' };
}
function collectionHolderLabel(reservation) {
  const holder = reservation.collectedBy || 'Jeri Rota';
  return holder === 'Parceira' ? (reservation.partner || 'Parceira') : holder;
}

function renderDashboard() {
  const active = reservations.filter(r => r.status !== 'Cancelada');
  const confirmed = reservations.filter(r => r.status === 'Confirmada');
  const received = active.reduce((sum, r) => sum + cashReceivedByJeri(r), 0);
  const open = active.reduce((sum, r) => sum + remainingAmount(r), 0);
  const total = active.reduce((sum, r) => sum + Number(r.amount), 0);
  const today = active.filter(r => isToday(r.date)).length;
  const upcoming = [...active].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const percent = total ? Math.round((received / total) * 100) : 0;

  document.getElementById('confirmedMetric').textContent = confirmed.length;
  document.getElementById('todayMetric').textContent = today;
  document.getElementById('revenueMetric').textContent = currency.format(received);
  document.getElementById('pendingMetric').textContent = currency.format(open);
  document.getElementById('nextTripCount').textContent = upcoming.length;
  document.getElementById('paymentPercent').textContent = `${percent}%`;
  document.getElementById('receivedValue').textContent = currency.format(received);
  document.getElementById('openValue').textContent = currency.format(open);
  document.getElementById('paymentDonut').style.background = `conic-gradient(var(--green) 0deg ${percent * 3.6}deg, #efece6 ${percent * 3.6}deg 360deg)`;

  const agenda = document.getElementById('upcomingReservations');
  if (!upcoming.length) {
    agenda.innerHTML = `<div class="empty-state"><strong>Sem saídas programadas.</strong><p>Cadastre uma reserva para montar sua agenda.</p></div>`;
  } else {
    agenda.innerHTML = upcoming.map(r => {
      const d = parseLocalDate(r.date);
      const openBalance = remainingAmount(r);
      const partnerNote = isPartnerReservation(r) ? ` · ${escapeHtml(r.partner)}` : '';
      return `<div class="agenda-row"><div class="agenda-date"><strong>${String(d.getDate()).padStart(2, '0')}</strong><small>${monthFormat.format(d).replace('.', '')}</small></div><div><h4>${escapeHtml(r.client)} · ${escapeHtml(r.service)}</h4><p>${r.people} pessoa${r.people > 1 ? 's' : ''} · ${escapeHtml(r.responsible || 'Responsável a definir')}${openBalance ? ` · saldo: ${currency.format(openBalance)}` : ''}${partnerNote}</p></div><div class="agenda-price">${currency.format(r.amount)}</div></div>`;
    }).join('');
  }
}

function renderReservations() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const filter = document.getElementById('statusFilter').value;
  const filtered = reservations.filter(r => {
    const fullText = `${r.client} ${r.service} ${r.phone} ${r.partner || ''}`.toLowerCase();
    return (!query || fullText.includes(query)) && (filter === 'todos' || r.status === filter);
  }).sort((a, b) => a.date.localeCompare(b.date));
  const tbody = document.getElementById('reservationsTable');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><strong>Nenhuma reserva encontrada.</strong><p>Ajuste os filtros ou cadastre uma nova venda.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(r => {
    const payment = paymentStatus(r);
    const balance = remainingAmount(r);
    return `<tr>
      <td><strong>${escapeHtml(r.client)}</strong><small>${escapeHtml(r.phone)}</small></td>
      <td>${escapeHtml(r.service)}${isPartnerReservation(r) ? `<small>${escapeHtml(r.partner)}</small>` : ''}</td>
      <td>${dateFormat.format(parseLocalDate(r.date))}</td>
      <td>${r.people}</td>
      <td><strong>${currency.format(r.amount)}</strong></td>
      <td>${currency.format(receivedAmount(r))}<small>${escapeHtml(collectionHolderLabel(r))}</small></td>
      <td><strong class="balance-value">${currency.format(balance)}</strong><small>${balance ? 'pendente do cliente' : 'quitado'}</small></td>
      <td><span class="status ${payment.className}">${payment.label}</span></td>
      <td><span class="status ${statusClass(r.status)}">${r.status}</span></td>
      <td class="row-actions"><button class="edit-button" data-edit="${r.id}">Editar</button><button class="delete-button" data-delete="${r.id}" aria-label="Excluir reserva">Excluir</button></td>
    </tr>`;
  }).join('');
}

function renderOperation() {
  const today = dateOffset(0);
  const buckets = [
    { title: 'Hoje', subtitle: 'embarques e passeios', reservations: reservations.filter(r => r.date === today && r.status !== 'Cancelada') },
    { title: 'Próximas 48h', subtitle: 'preparar logística', reservations: reservations.filter(r => {
      const diff = (parseLocalDate(r.date) - parseLocalDate(today)) / 86400000;
      return diff > 0 && diff <= 2 && r.status !== 'Cancelada';
    }) },
    { title: 'Saldos no embarque', subtitle: 'cobranças pendentes', reservations: reservations.filter(r => r.status !== 'Cancelada' && remainingAmount(r) > 0) }
  ];
  document.getElementById('operationBoard').innerHTML = buckets.map(bucket => `<article class="operation-card"><div><p class="eyebrow">${bucket.subtitle}</p><h3>${bucket.title}</h3></div>${bucket.reservations.length ? bucket.reservations.map(r => `<div class="op-item"><strong>${escapeHtml(r.client)} — ${escapeHtml(r.service)}</strong><span>${dateFormat.format(parseLocalDate(r.date))} · ${r.people} pessoa${r.people > 1 ? 's' : ''} · ${escapeHtml(r.responsible || 'Responsável a definir')}${remainingAmount(r) ? ` · cobrar ${currency.format(remainingAmount(r))}` : ''}${isPartnerReservation(r) ? ` · ${escapeHtml(r.partner)}` : ''}</span></div>`).join('') : `<div class="op-empty">Nenhuma ação prevista nesta coluna.</div>`}</article>`).join('');
}

function renderFinance() {
  const active = reservations.filter(r => r.status !== 'Cancelada');
  const received = active.reduce((sum, r) => sum + cashReceivedByJeri(r), 0);
  const pending = active.reduce((sum, r) => sum + remainingAmount(r), 0);
  const total = active.reduce((sum, r) => sum + Number(r.amount), 0);
  document.getElementById('financeReceived').textContent = currency.format(received);
  document.getElementById('financePending').textContent = currency.format(pending);
  document.getElementById('financeTotal').textContent = currency.format(total);
  const tbody = document.getElementById('financeTable');
  tbody.innerHTML = [...active].sort((a, b) => a.date.localeCompare(b.date)).map(r => {
    const balance = remainingAmount(r);
    return `<tr><td><strong>${escapeHtml(r.client)}</strong><small>${escapeHtml(r.service)}</small></td><td>${dateFormat.format(parseLocalDate(r.date))}</td><td>${currency.format(r.amount)}</td><td>${currency.format(receivedAmount(r))}<small>${escapeHtml(collectionHolderLabel(r))}</small></td><td><strong class="balance-value">${currency.format(balance)}</strong><small>${balance ? 'pendente do cliente' : 'quitado'}</small></td></tr>`;
  }).join('') || `<tr><td colspan="5"><div class="empty-state"><strong>Sem lançamentos.</strong></div></td></tr>`;
}

function renderPartnerFilters() {
  const select = document.getElementById('partnerFilter');
  const current = select.value;
  const partners = [...new Set(reservations.filter(isPartnerReservation).map(r => r.partner).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = `<option value="todos">Todas as empresas</option>${partners.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}`;
  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function renderSettlement() {
  renderPartnerFilters();
  const selectedPartner = document.getElementById('partnerFilter').value;
  const selectedStatus = document.getElementById('partnerStatusFilter').value;
  const entries = reservations.filter(r => r.status !== 'Cancelada' && isPartnerReservation(r)).filter(r => {
    const matchesPartner = selectedPartner === 'todos' || r.partner === selectedPartner;
    const status = settlementStatus(r);
    const matchesStatus = selectedStatus === 'todos' || (selectedStatus === 'abertos' && settlementRemaining(r) > 0) || (selectedStatus === 'quitados' && settlementRemaining(r) === 0) || (selectedStatus === 'fiados' && remainingAmount(r) > 0);
    return matchesPartner && matchesStatus && status;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const allPartnerEntries = reservations.filter(r => r.status !== 'Cancelada' && isPartnerReservation(r)).filter(r => selectedPartner === 'todos' || r.partner === selectedPartner);
  const receivable = allPartnerEntries.filter(r => r.partnerOperation === 'recebida').reduce((sum, r) => sum + settlementRemaining(r), 0);
  const payable = allPartnerEntries.filter(r => r.partnerOperation === 'enviada').reduce((sum, r) => sum + settlementRemaining(r), 0);
  const fiado = allPartnerEntries.reduce((sum, r) => sum + remainingAmount(r), 0);
  const settled = allPartnerEntries.reduce((sum, r) => sum + Number(r.settledAmount || 0), 0);

  document.getElementById('partnerReceivable').textContent = currency.format(receivable);
  document.getElementById('partnerPayable').textContent = currency.format(payable);
  document.getElementById('partnerFiado').textContent = currency.format(fiado);
  document.getElementById('partnerSettled').textContent = currency.format(settled);
  document.getElementById('partnerStatementTitle').textContent = selectedPartner === 'todos' ? 'Extrato de todas as empresas' : `Extrato — ${selectedPartner}`;

  const tbody = document.getElementById('settlementTable');
  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><strong>Nenhum lançamento de prestação encontrado.</strong><p>Cadastre uma reserva e selecione uma empresa parceira para iniciar este extrato.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = entries.map(r => {
    const direction = settlementDirection(r);
    const status = settlementStatus(r);
    const netRemaining = settlementRemaining(r);
    const deadline = r.settlementDate ? dateFormat.format(parseLocalDate(r.settlementDate)) : 'A definir';
    return `<tr>
      <td><strong>${escapeHtml(r.partner)}</strong><small>${escapeHtml(operationLabel(r))}</small></td>
      <td><strong>${escapeHtml(r.client)}</strong><small>${escapeHtml(r.service)} · ${r.people} pax</small></td>
      <td>${dateFormat.format(parseLocalDate(r.date))}<small>Prestação: ${deadline}</small></td>
      <td><span class="status ${direction.className}">${direction.label}</span></td>
      <td><strong>${currency.format(r.netAmount)}</strong><small>NET da reserva</small></td>
      <td>${currency.format(r.settledAmount)}<small>repasse lançado</small></td>
      <td><strong class="balance-value">${currency.format(netRemaining)}</strong><small>saldo da prestação</small></td>
      <td>${currency.format(receivedAmount(r))}<small>${escapeHtml(collectionHolderLabel(r))}</small></td>
      <td><span class="status ${status.className}">${status.label}</span></td>
      <td class="row-actions"><button class="edit-button" data-settlement-edit="${r.id}">Prestar contas</button></td>
    </tr>`;
  }).join('');
}

function renderAll() { renderDashboard(); renderReservations(); renderOperation(); renderFinance(); renderSettlement(); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

function setSection(section) {
  document.querySelectorAll('.content-section').forEach(el => el.classList.toggle('active', el.id === section));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === section));
  const titles = { dashboard: 'Olá, Jeri Rota', reservas: 'Reservas e clientes', operacao: 'Operação diária', financeiro: 'Controle financeiro', prestacao: 'Prestação de contas' };
  document.getElementById('pageTitle').textContent = titles[section];
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const modal = document.getElementById('modalBackdrop');
const reservationForm = document.getElementById('reservationForm');
const amountInput = reservationForm.querySelector('[name="amount"]');
const paidAmountInput = reservationForm.querySelector('[name="paidAmount"]');
const balancePreview = document.getElementById('balancePreview');
const paymentPreview = document.getElementById('paymentPreview');
const partnerOperationInput = reservationForm.querySelector('[name="partnerOperation"]');
const partnerInput = reservationForm.querySelector('[name="partner"]');
const netAmountInput = reservationForm.querySelector('[name="netAmount"]');
const settledAmountInput = reservationForm.querySelector('[name="settledAmount"]');
const partnerPreview = document.getElementById('partnerPreview');
const partnerFields = document.getElementById('partnerFields');

function updatePaymentPreview() {
  const total = Math.max(0, Number(amountInput.value) || 0);
  const received = clamp(Number(paidAmountInput.value) || 0, 0, total);
  if (Number(paidAmountInput.value) > total && total > 0) paidAmountInput.value = total;
  const balance = Math.max(0, total - received);
  balancePreview.textContent = currency.format(balance);
  paymentPreview.textContent = balance ? 'Saldo pendente do cliente.' : 'Cliente quitou a reserva.';
}

function updatePartnerPreview() {
  const operation = partnerOperationInput.value;
  const net = Math.max(0, Number(netAmountInput.value) || 0);
  const settled = clamp(Number(settledAmountInput.value) || 0, 0, net);
  if (Number(settledAmountInput.value) > net && net > 0) settledAmountInput.value = net;
  const isOwn = operation === 'propria';
  partnerFields.classList.toggle('is-disabled', isOwn);
  partnerFields.querySelectorAll('input, select').forEach(input => {
    if (input.name !== 'partnerOperation') input.disabled = isOwn;
  });
  if (isOwn) {
    partnerPreview.innerHTML = '<span>Prestação de contas</span><strong>Venda própria</strong><small>Sem lançamento para parceiro.</small>';
    return;
  }
  const direction = operation === 'recebida' ? 'A receber da parceira' : 'A pagar à parceira';
  const balance = Math.max(0, net - settled);
  const company = partnerInput.value.trim() || 'Empresa parceira';
  partnerPreview.innerHTML = `<span>${direction}</span><strong>${currency.format(balance)}</strong><small>${escapeHtml(company)} · NET ${currency.format(net)} · repasse registrado ${currency.format(settled)}</small>`;
}

function resetForm() {
  reservationForm.reset();
  reservationForm.querySelector('[name="people"]').value = 2;
  reservationForm.querySelector('[name="collectedBy"]').value = 'Jeri Rota';
  partnerOperationInput.value = 'propria';
  amountInput.value = '';
  paidAmountInput.value = 0;
  netAmountInput.value = 0;
  settledAmountInput.value = 0;
  editingReservationId = null;
  document.getElementById('modalTitle').textContent = 'Cadastrar reserva';
  document.getElementById('submitReservation').textContent = 'Salvar reserva';
  updatePaymentPreview();
  updatePartnerPreview();
}

function openModal(id = null) {
  resetForm();
  if (id) {
    const reservation = reservations.find(item => item.id === id);
    if (!reservation) return;
    editingReservationId = id;
    reservationForm.querySelector('[name="client"]').value = reservation.client;
    reservationForm.querySelector('[name="phone"]').value = reservation.phone;
    reservationForm.querySelector('[name="service"]').value = reservation.service;
    reservationForm.querySelector('[name="date"]').value = reservation.date;
    reservationForm.querySelector('[name="people"]').value = reservation.people;
    amountInput.value = reservation.amount;
    paidAmountInput.value = receivedAmount(reservation);
    reservationForm.querySelector('[name="collectedBy"]').value = reservation.collectedBy || 'Jeri Rota';
    reservationForm.querySelector('[name="status"]').value = reservation.status;
    reservationForm.querySelector('[name="responsible"]').value = reservation.responsible || '';
    reservationForm.querySelector('[name="notes"]').value = reservation.notes || '';
    partnerOperationInput.value = reservation.partnerOperation || 'propria';
    partnerInput.value = reservation.partner || '';
    netAmountInput.value = reservation.netAmount || 0;
    settledAmountInput.value = reservation.settledAmount || 0;
    reservationForm.querySelector('[name="settlementDate"]').value = reservation.settlementDate || '';
    document.getElementById('modalTitle').textContent = 'Editar reserva e prestação';
    document.getElementById('submitReservation').textContent = 'Salvar alterações';
    updatePaymentPreview();
    updatePartnerPreview();
  }
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => modal.querySelector('input[name="client"]').focus(), 50);
}
function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date()).replace('.', '');
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => setSection(button.dataset.section)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => setSection(button.dataset.go)));
document.querySelectorAll('[data-open-modal]').forEach(button => button.addEventListener('click', () => openModal()));
document.getElementById('newReservationButton').addEventListener('click', () => openModal());
document.getElementById('closeModal').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
document.getElementById('menuButton').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('searchInput').addEventListener('input', renderReservations);
document.getElementById('statusFilter').addEventListener('change', renderReservations);
document.getElementById('partnerFilter').addEventListener('change', renderSettlement);
document.getElementById('partnerStatusFilter').addEventListener('change', renderSettlement);
amountInput.addEventListener('input', updatePaymentPreview);
paidAmountInput.addEventListener('input', updatePaymentPreview);
partnerOperationInput.addEventListener('change', updatePartnerPreview);
partnerInput.addEventListener('input', updatePartnerPreview);
netAmountInput.addEventListener('input', updatePartnerPreview);
settledAmountInput.addEventListener('input', updatePartnerPreview);

reservationForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  const amount = Math.max(0, Number(data.amount));
  const paidAmount = clamp(Number(data.paidAmount) || 0, 0, amount);
  const partnerOperation = data.partnerOperation || 'propria';
  const netAmount = partnerOperation === 'propria' ? 0 : Math.max(0, Number(data.netAmount) || 0);
  const settledAmount = partnerOperation === 'propria' ? 0 : clamp(Number(data.settledAmount) || 0, 0, netAmount);
  const reservation = normalizeReservation({
    id: editingReservationId || Date.now(),
    client: data.client.trim(),
    phone: data.phone.trim(),
    service: data.service.trim(),
    date: data.date || dateOffset(0),
    people: Math.max(1, Number(data.people)),
    amount,
    paidAmount,
    collectedBy: data.collectedBy || 'Jeri Rota',
    status: data.status,
    responsible: data.responsible.trim() || 'Responsável a definir',
    notes: data.notes.trim(),
    partnerOperation,
    partner: partnerOperation === 'propria' ? '' : (data.partner.trim() || 'Parceira a informar'),
    netAmount,
    settledAmount,
    settlementDate: partnerOperation === 'propria' ? '' : data.settlementDate
  });

  if (editingReservationId) {
    reservations = reservations.map(item => item.id === editingReservationId ? reservation : item);
  } else {
    reservations.push(reservation);
  }
  saveReservations();
  closeModal();
  renderAll();
  setSection('reservas');
});

document.getElementById('reservationsTable').addEventListener('click', event => {
  const editId = Number(event.target.dataset.edit);
  if (editId) {
    openModal(editId);
    return;
  }
  const id = Number(event.target.dataset.delete);
  if (!id) return;
  const reservation = reservations.find(r => r.id === id);
  if (reservation && confirm(`Excluir a reserva de ${reservation.client}?`)) {
    reservations = reservations.filter(r => r.id !== id);
    saveReservations();
    renderAll();
  }
});

document.getElementById('settlementTable').addEventListener('click', event => {
  const id = Number(event.target.dataset.settlementEdit);
  if (id) openModal(id);
});

document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
renderAll();
