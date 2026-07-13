const STORAGE_KEY = 'jeri-rota-calculadora-pacotes-v1';
const form = document.getElementById('packageForm');
const copyStatus = document.getElementById('copyStatus');
const warningCard = document.getElementById('warningCard');
const warningText = document.getElementById('warningText');
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const costFields = ['lodging', 'transfer', 'tours', 'tickets', 'commission', 'cardFee', 'otherCosts'];

function number(value) {
  return Math.max(0, Number(value) || 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundUp(value, increment) {
  if (!value) return 0;
  return Math.ceil((value - Number.EPSILON) / increment) * increment;
}

function getFormData() {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    ...data,
    people: Math.max(1, Math.floor(number(data.people) || 1)),
    nights: Math.floor(number(data.nights)),
    margin: clamp(number(data.margin), 0, 95),
    negotiation: clamp(number(data.negotiation), 0, 90),
    rounding: Math.max(1, number(data.rounding) || 1),
    costs: Object.fromEntries(costFields.map(field => [field, number(data[field])]))
  };
}

function calculate() {
  const data = getFormData();
  const totalCost = Object.values(data.costs).reduce((sum, value) => sum + value, 0);
  const marginRate = data.margin / 100;
  const negotiationRate = data.negotiation / 100;

  let rawMinimumPrice = 0;
  let validationMessage = '';

  if (data.pricingMode === 'margin') {
    if (marginRate >= 1) {
      validationMessage = 'A margem real precisa ser menor que 100%.';
    } else {
      rawMinimumPrice = totalCost / (1 - marginRate);
    }
  } else {
    rawMinimumPrice = totalCost * (1 + marginRate);
  }

  if (negotiationRate >= 1) {
    validationMessage = 'O espaço para negociação precisa ser menor que 100%.';
  }

  const minimumPrice = roundUp(rawMinimumPrice, data.rounding);
  const rawTablePrice = negotiationRate < 1 ? minimumPrice / (1 - negotiationRate) : minimumPrice;
  const tablePrice = roundUp(rawTablePrice, data.rounding);
  const minimumProfit = Math.max(0, minimumPrice - totalCost);
  const actualMargin = minimumPrice ? (minimumProfit / minimumPrice) * 100 : 0;
  const safeDiscount = Math.max(0, tablePrice - minimumPrice);
  const safeDiscountPercent = tablePrice ? (safeDiscount / tablePrice) * 100 : 0;

  const result = {
    data,
    totalCost,
    minimumPrice,
    tablePrice,
    minimumProfit,
    actualMargin,
    safeDiscount,
    safeDiscountPercent,
    costPerPerson: totalCost / data.people,
    minimumPricePerPerson: minimumPrice / data.people,
    tablePricePerPerson: tablePrice / data.people,
    validationMessage
  };

  render(result);
  saveForm();
  return result;
}

function render(result) {
  document.getElementById('totalCost').textContent = currency.format(result.totalCost);
  document.getElementById('costPerPerson').textContent = currency.format(result.costPerPerson);
  document.getElementById('minimumPrice').textContent = currency.format(result.minimumPrice);
  document.getElementById('minimumPricePerPerson').textContent = `${currency.format(result.minimumPricePerPerson)} por pessoa`;
  document.getElementById('tablePrice').textContent = currency.format(result.tablePrice);
  document.getElementById('tablePricePerPerson').textContent = `${currency.format(result.tablePricePerPerson)} por pessoa`;
  document.getElementById('minimumProfit').textContent = currency.format(result.minimumProfit);
  document.getElementById('actualMargin').textContent = `${percent.format(result.actualMargin)}%`;
  document.getElementById('safeDiscount').textContent = currency.format(result.safeDiscount);

  const hasCost = result.totalCost > 0;
  document.getElementById('negotiationText').textContent = hasCost
    ? `Você pode apresentar ${currency.format(result.tablePrice)} e negociar até aproximadamente ${percent.format(result.safeDiscountPercent)}%, sem fechar abaixo de ${currency.format(result.minimumPrice)}.`
    : 'Você ainda não adicionou custos ao pacote.';

  warningCard.hidden = !result.validationMessage;
  warningText.textContent = result.validationMessage;

  const modeHelp = document.getElementById('modeHelp');
  modeHelp.textContent = result.data.pricingMode === 'margin'
    ? 'Na margem real, preço = custo ÷ (1 − margem). Uma margem de 20% sobre R$ 1.000 gera preço mínimo de R$ 1.250.'
    : 'No acréscimo, preço = custo × (1 + percentual). Um acréscimo de 20% sobre R$ 1.000 gera R$ 1.200, equivalente a 16,67% de margem real.';
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function buildSummary(result) {
  const { data } = result;
  const period = data.startDate && data.endDate
    ? `${formatDate(data.startDate)} a ${formatDate(data.endDate)}`
    : data.startDate
      ? formatDate(data.startDate)
      : 'a definir';

  return [
    `COTAÇÃO — ${data.destination || 'Pacote de viagem'}`,
    `Período: ${period}`,
    `Pessoas: ${data.people}`,
    data.nights ? `Diárias: ${data.nights}` : null,
    '',
    `Custo total: ${currency.format(result.totalCost)}`,
    `Preço para apresentar: ${currency.format(result.tablePrice)}`,
    `Valor por pessoa: ${currency.format(result.tablePricePerPerson)}`,
    `Preço mínimo para fechar: ${currency.format(result.minimumPrice)}`,
    `Desconto seguro: até ${currency.format(result.safeDiscount)}`,
    `Lucro mínimo estimado: ${currency.format(result.minimumProfit)}`,
    `Margem real estimada: ${percent.format(result.actualMargin)}%`
  ].filter(line => line !== null).join('\n');
}

async function copySummary() {
  const result = calculate();
  if (!result.totalCost) {
    copyStatus.textContent = 'Adicione pelo menos um custo antes de copiar.';
    return;
  }

  const text = buildSummary(result);
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = 'Resumo copiado para a área de transferência.';
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    copyStatus.textContent = 'Resumo copiado para a área de transferência.';
  }
  setTimeout(() => { copyStatus.textContent = ''; }, 3500);
}

function saveForm() {
  const data = Object.fromEntries(new FormData(form).entries());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreForm() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    Object.entries(saved).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearForm() {
  form.reset();
  form.elements.namedItem('destination').value = 'Jericoacoara';
  form.elements.namedItem('people').value = 2;
  form.elements.namedItem('nights').value = 2;
  form.elements.namedItem('margin').value = 20;
  form.elements.namedItem('negotiation').value = 10;
  form.elements.namedItem('rounding').value = 10;
  localStorage.removeItem(STORAGE_KEY);
  copyStatus.textContent = '';
  calculate();
}

form.addEventListener('input', calculate);
form.addEventListener('change', calculate);
document.getElementById('copyButton').addEventListener('click', copySummary);
document.getElementById('clearButton').addEventListener('click', clearForm);

restoreForm();
calculate();
