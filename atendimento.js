(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const api = String(window.JERI_CENTRAL_API_URL || '').replace(/\/$/, '');
  const supabase = window.jeriSupabase;
  let selected = '';
  let leads = [];
  let busy = false;
  let human = false;
  let windowOpen = false;
  let pendingVoucher = null;
  let displayedPhone = '';
  let openRequestId = 0;

  function status(text, type = '') {
    $('status').textContent = text;
    $('status').className = 'status ' + type;
  }
  function validPhone(value) { return /^[0-9]{10,15}$/.test(value); }
  function setDisabled() {
    $('take').disabled = !selected || busy || human;
    $('release').disabled = !selected || busy || !human;
    $('send').disabled = !selected || busy || !human || !windowOpen;
    $('pdf').disabled = !selected || busy || !human || !windowOpen;
    $('confirmVoucher').disabled = !pendingVoucher || !selected || busy || !human || !windowOpen;
    $('cancelVoucher').disabled = busy;
    $('voucherCaption').disabled = busy;

    $('sendTemplate').disabled = !selected || busy || !human;
    $('mode').textContent = human ? 'Humano ativo' : 'IA ativa';
    $('windowInfo').textContent = windowOpen
      ? 'Janela aberta: mensagens livres e documentos permitidos.'
      : 'Janela de 24h fechada ou desconhecida: inicie com modelo aprovado da Meta.';
  }
  async function request(path, opts = {}) {
    if (!api || !/^https:\/\//.test(api)) throw Error('Central não configurada. Falta URL HTTPS do servidor.');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      location.replace('login.html?next=atendimento.html');
      throw Error('Sessão expirada. Faça login novamente.');
    }
    const response = await fetch(api + path, {
      method: opts.method || 'GET',
      headers: { 'Authorization': 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    });
    const parsed = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(typeof parsed.detail === 'string' ? parsed.detail : 'Operação falhou (HTTP ' + response.status + ').');
    return parsed;
  }
  function renderLeads() {
    const filter = $('search').value.trim().replace(/\D/g, '');
    const root = $('leads');
    root.replaceChildren();
    const visible = leads.filter(l => !filter || l.telefone_whatsapp.includes(filter));
    if (!visible.length) {
      const p = document.createElement('div'); p.className = 'empty'; p.textContent = 'Nenhuma conversa nesta lista.'; root.append(p); return;
    }
    visible.forEach(l => {
      const btn = document.createElement('button');
      btn.className = 'lead' + (l.telefone_whatsapp === selected ? ' active' : '');
      const title = document.createElement('strong');
      title.textContent = '+' + l.telefone_whatsapp;
      const detail = document.createElement('span');
      detail.textContent = (l.humano ? 'Atendimento humano' : 'IA disponível') + (l.ultima_mensagem_em ? ' · ' + new Date(l.ultima_mensagem_em).toLocaleString('pt-BR') : '');
      btn.append(title, detail);
      btn.addEventListener('click', () => open(l.telefone_whatsapp));
      root.append(btn);
    });
  }
  async function refreshLeads() {
    leads = await request('/central/conversas');
    renderLeads();
  }
  function renderMessages(rows, phone) {
    const root = $('messages');
    const newConversation = displayedPhone !== phone;
    const nearBottom = newConversation || (root.scrollHeight - root.clientHeight - root.scrollTop < 110);
    const previousTop = root.scrollTop;
    displayedPhone = phone;
    root.replaceChildren();
    if (!rows.length) {
      const p = document.createElement('div'); p.className = 'empty';
      p.textContent = 'Ainda não há mensagens armazenadas para este telefone.'; root.append(p);
    } else {
      const fragment = document.createDocumentFragment();
      for (const row of rows) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble' + (row.papel === 'assistant' ? ' out' : '');
        const meta = document.createElement('small');
        meta.textContent = (row.papel === 'assistant' ? 'Jeri Rota' : 'Cliente') + ' · ' + new Date(row.criado_em).toLocaleString('pt-BR');
        const content = document.createElement('div');
        content.textContent = row.conteudo || '';
        bubble.append(meta, content); fragment.append(bubble);
      }
      root.append(fragment);
    }
    // Seleção de cliente abre na última mensagem. Se o atendente estiver
    // lendo mensagens antigas, a atualização automática não o interrompe.
    root.scrollTop = nearBottom ? root.scrollHeight : previousTop;
  }
  async function open(phone, { silent = false } = {}) {
    if (!validPhone(phone)) { status('Informe o telefone com DDI e DDD, somente números.', 'error'); return; }
    const requestId = ++openRequestId;
    const changingConversation = selected !== phone;
    selected = phone;
    $('phone').value = phone;
    $('title').textContent = '+' + phone;
    if (changingConversation) {
      displayedPhone = '';
      $('messages').replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'empty'; loading.textContent = 'Carregando conversa...';
      $('messages').append(loading);
    }
    renderLeads();
    try {
      const data = await request('/central/conversas/' + phone);
      if (requestId !== openRequestId || selected !== phone) return;
      human = Boolean(data.humano);
      windowOpen = Boolean(data.janela_aberta);
      renderMessages(data.mensagens || [], phone);
      setDisabled();
      if (!silent) status('Conversa carregada.', 'ok');
    } catch (error) {
      if (requestId === openRequestId && !silent) status(error.message, 'error');
    }
  }
  async function action(fn) {
    if (busy || !selected) return;
    busy = true; setDisabled();
    try { await fn(); status('Operação concluída e confirmada pelo servidor.', 'ok'); await open(selected); await refreshLeads(); }
    catch (error) { status(error.message, 'error'); }
    finally { busy = false; setDisabled(); }
  }
  $('reload').addEventListener('click', () => refreshLeads().catch(e => status(e.message, 'error')));
  $('search').addEventListener('input', renderLeads);
  $('openPhone').addEventListener('click', () => open($('phone').value.trim().replace(/\D/g, '')));
  $('take').addEventListener('click', () => action(async () => {
    await request('/central/modo', { method:'POST', body: {telefone:selected, humano:true} });
    human = true;
  }));
  $('release').addEventListener('click', () => action(async () => {
    await request('/central/modo', { method:'POST', body: {telefone:selected, humano:false} });
    human = false;
  }));
  $('send').addEventListener('click', () => action(async () => {
    const texto = $('message').value.trim();
    if (!texto) throw Error('Escreva uma mensagem.');
    await request('/central/mensagens', { method:'POST', body: {telefone:selected, texto} });
    $('message').value = '';
  }));
  $('sendTemplate').addEventListener('click', () => action(async () => {
    const nome = $('templateName').value.trim();
    if (!/^[a-z0-9_]{1,100}$/.test(nome)) throw Error('Informe o nome exato do modelo aprovado.');
    if (!$('consent').checked) throw Error('Confirme o consentimento do cliente para iniciar contato.');
    await request('/central/modelos', { method:'POST', body: {telefone:selected, nome, idioma:'pt_BR', consentimento_confirmado:true} });
    $('consent').checked = false;
  }));
  function clearVoucher() {
    pendingVoucher = null;
    $('pdf').value = '';
    $('voucherCaption').value = '';
    $('voucherPreview').hidden = true;
    $('voucherFileName').textContent = '';
    $('voucherCaptionLength').textContent = '0';
    setDisabled();
  }
  $('pdf').addEventListener('change', () => {
    const file = $('pdf').files?.[0];
    if (!file) return;
    if (!selected || busy || !human || !windowOpen) {
      clearVoucher();
      status('Para enviar PDF, assuma uma conversa com janela de 24 horas aberta.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024 || file.size < 5 || !/\.pdf$/i.test(file.name)) {
      clearVoucher();
      status('Escolha um PDF de até 8 MB.', 'error');
      return;
    }
    pendingVoucher = {file, telefone: selected};
    $('voucherFileName').textContent = file.name;
    $('voucherCaption').value =
      'Olá! Segue em anexo seu voucher da Jeri Rota.\n\n' +
      'Por favor, confira os dados da reserva, a data, o horário e os locais de embarque e desembarque.\n\n' +
      'Em caso de dúvidas, estamos à disposição.\n\nEquipe Jeri Rota';
    $('voucherCaptionLength').textContent = String($('voucherCaption').value.length);
    $('voucherPreview').hidden = false;
    setDisabled();
    $('voucherCaption').focus();
    status('Revise a mensagem antes de enviar o voucher.');
  });
  $('voucherCaption').addEventListener('input', () => {
    $('voucherCaptionLength').textContent = String($('voucherCaption').value.length);
  });
  $('cancelVoucher').addEventListener('click', clearVoucher);
  $('confirmVoucher').addEventListener('click', () => action(async () => {
    if (!pendingVoucher || pendingVoucher.telefone !== selected)
      throw Error('Selecione novamente o voucher para este cliente.');
    const file = pendingVoucher.file;
    const legenda = $('voucherCaption').value.trim();
    if (legenda.length > 1024) throw Error('A legenda deve ter até 1024 caracteres.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i=0; i<bytes.length; i+=8192)
      binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    await request('/central/documentos', { method:'POST', body: {
      telefone:selected, nome_arquivo:file.name, legenda, pdf_base64:btoa(binary)
    }});
    clearVoucher();
  }));
  async function boot() {
    if (!supabase) { status('Configuração de login indisponível.', 'error'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { location.replace('login.html?next=atendimento.html'); return; }
    if (!api) { status('Central em preparação: configure o endereço do servidor após os testes.', 'error'); $('leads').textContent = 'Módulo ainda não conectado.'; return; }
    try { await refreshLeads(); status('Central pronta para consulta.', 'ok'); }
    catch (e) { status(e.message, 'error'); }
    setInterval(() => {
      if (document.visibilityState === 'visible' && !busy) {
        refreshLeads().catch(() => {});
        if (selected) open(selected, { silent: true });
      }
    }, 15000);
  }
  setDisabled();
  boot();
})();
