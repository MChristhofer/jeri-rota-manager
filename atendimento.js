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
  function renderMessages(rows) {
    const root = $('messages');
    root.replaceChildren();
    if (!rows.length) {
      const p = document.createElement('div'); p.className = 'empty';
      p.textContent = 'Ainda não há mensagens armazenadas para este telefone.'; root.append(p); return;
    }
    for (const row of rows) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble' + (row.papel === 'assistant' ? ' out' : '');
      const meta = document.createElement('small');
      meta.textContent = (row.papel === 'assistant' ? 'Jeri Rota' : 'Cliente') + ' · ' + new Date(row.criado_em).toLocaleString('pt-BR');
      const content = document.createElement('div');
      content.textContent = row.conteudo || '';
      bubble.append(meta, content); root.append(bubble);
    }
    root.scrollTop = root.scrollHeight;
  }
  async function open(phone) {
    if (!validPhone(phone)) { status('Informe o telefone com DDI e DDD, somente números.', 'error'); return; }
    selected = phone;
    $('phone').value = phone;
    $('title').textContent = '+' + phone;
    renderLeads();
    try {
      const data = await request('/central/conversas/' + phone);
      human = Boolean(data.humano);
      windowOpen = Boolean(data.janela_aberta);
      renderMessages(data.mensagens || []);
      setDisabled();
      status('Conversa carregada.', 'ok');
    } catch (error) { status(error.message, 'error'); }
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
  $('pdf').addEventListener('change', async () => {
    const file = $('pdf').files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024 || file.size < 5 || !/\.pdf$/i.test(file.name)) {
      $('pdf').value = ''; status('Escolha um PDF com até 8 MB.', 'error'); return;
    }
    await action(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i=0; i<bytes.length; i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
      await request('/central/documentos', { method:'POST', body: {
        telefone:selected, nome_arquivo:file.name, pdf_base64:btoa(binary)
      }});
    });
    $('pdf').value = '';
  });
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
        if (selected) open(selected);
      }
    }, 15000);
  }
  setDisabled();
  boot();
})();
