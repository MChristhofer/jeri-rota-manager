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
  let pendingAudio = null;
  let recorder = null;
  let recordingStream = null;
  let discardRecording = false;
  let audioPreviewUrl = '';
  let displayedPhone = '';
  let openRequestId = 0;
  const mobileMedia = window.matchMedia('(max-width: 750px)');
  let chatView = false;
  function updateMobileView() {
    $('centralShell').dataset.mobileView = chatView && selected ? 'chat' : 'list';
  }
  function showChat() {
    chatView = true;
    updateMobileView();
  }
  function showConversations() {
    chatView = false;
    updateMobileView();
    if (recorder && recorder.state === 'recording') clearAudio();
    $('attachmentOptions').hidden = true;
    $('attachmentMenu').setAttribute('aria-expanded', 'false');
  }
  $('mobileBack').addEventListener('click', showConversations);
  mobileMedia.addEventListener('change', updateMobileView);

  function status(text, type = '') {
    $('status').textContent = text;
    $('status').className = 'status ' + type;
  }
  function validPhone(value) { return /^[0-9]{10,15}$/.test(value); }
  function setDisabled() {
    $('take').disabled = !selected || busy || human;
    $('release').disabled = !selected || busy || !human;
    $('send').disabled = !selected || busy || !human || !windowOpen || Boolean(recorder);
    $('mic').disabled = !selected || busy || !human || !windowOpen || Boolean(pendingAudio);
    $('audioFile').disabled = !selected || busy || Boolean(recorder);
    $('sendAudio').disabled = !pendingAudio || !selected || busy || !human || !windowOpen;
    $('cancelAudio').disabled = busy;
    $('attachmentMenu').disabled = !selected || busy || Boolean(recorder);
    $('mic').classList.toggle('recording', Boolean(recorder));
    $('mic').textContent = recorder ? '■' : '🎙';
    $('mic').setAttribute('aria-label', recorder ? 'Parar gravação' : 'Gravar mensagem de voz');
    $('pdf').disabled = !selected || busy;
    $('confirmVoucher').disabled = !pendingVoucher || !selected || busy || !human || !windowOpen;
    $('cancelVoucher').disabled = busy;
    $('voucherCaption').disabled = busy;

    $('sendTemplate').disabled = !selected || busy || !human;
    $('mode').textContent = human ? 'Humano ativo' : 'IA ativa';
    $('windowInfo').textContent = windowOpen
      ? 'Janela aberta: mensagens livres e documentos permitidos.'
      : 'Janela de 24h fechada ou desconhecida: prepare anexos e aguarde resposta do cliente para enviar.';
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
  let inboxFilter = 'all';
  function inboxTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
  }
  function initials(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || '?').slice(0,2))
      .toLocaleUpperCase('pt-BR');
  }
  function renderLeads() {
    const filter = $('search').value.trim().toLocaleLowerCase('pt-BR');
    const root = $('leads');
    root.replaceChildren();
    const visible = leads.filter(l => {
      const name = String(l.nome || '').trim().toLocaleLowerCase('pt-BR');
      const phone = String(l.telefone_whatsapp || '');
      const matches = !filter || name.includes(filter) || phone.includes(filter.replace(/\D/g, ''));
      return matches && (inboxFilter === 'all' || (inboxFilter === 'human' ? l.humano : !l.humano));
    });
    if (!visible.length) {
      const p = document.createElement('div');
      p.className = 'empty';
      p.textContent = 'Nenhuma conversa encontrada.';
      root.append(p);
      return;
    }
    const fragment = document.createDocumentFragment();
    visible.forEach(l => {
      const phone = String(l.telefone_whatsapp || '');
      const name = String(l.nome || '').trim();
      const displayName = name || '+' + phone;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lead inbox-lead' + (phone === selected ? ' active' : '');
      btn.setAttribute('aria-label', 'Abrir conversa com ' + displayName);
      const avatar = document.createElement('span');
      avatar.className = 'inbox-avatar';
      avatar.textContent = name ? initials(name) : '+';
      avatar.setAttribute('aria-hidden', 'true');
      const body = document.createElement('span');
      body.className = 'inbox-lead-body';
      const head = document.createElement('span');
      head.className = 'inbox-lead-head';
      const title = document.createElement('strong');
      title.textContent = displayName;
      const time = document.createElement('time');
      time.className = 'inbox-lead-time';
      time.textContent = inboxTime(l.ultima_previa_em || l.ultima_mensagem_em);
      if (l.ultima_previa_em) time.dateTime = l.ultima_previa_em;
      head.append(title, time);
      const preview = document.createElement('span');
      preview.className = 'inbox-lead-preview';
      const last = String(l.ultima_previa || '').replace(/\s+/g, ' ').trim();
      preview.textContent = last ? (l.ultima_previa_papel === 'assistant' ? 'Jeri Rota: ' : '') + last : 'Sem mensagens recentes';
      const footer = document.createElement('span');
      footer.className = 'inbox-lead-footer';
      const sub = document.createElement('span');
      sub.className = 'inbox-lead-phone';
      sub.textContent = name ? '+' + phone : '';
      const mode = document.createElement('span');
      mode.className = 'inbox-mode ' + (l.humano ? 'human' : 'ai');
      mode.textContent = l.humano ? 'Humano' : 'IA';
      footer.append(sub, mode);
      body.append(head, preview, footer);
      btn.append(avatar, body);
      btn.addEventListener('click', () => open(phone));
      fragment.append(btn);
    });
    root.append(fragment);
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
    if (changingConversation && pendingVoucher) clearVoucher();
    if (changingConversation) clearAudio();
    if (changingConversation) {
      $('attachmentOptions').hidden = true;
      $('attachmentMenu').setAttribute('aria-expanded', 'false');
    }
    selected = phone;
    if (!silent) showChat();
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
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      inboxFilter = chip.dataset.filter;
      document.querySelectorAll('.filter-chip').forEach(other => {
        const active = other === chip;
        other.classList.toggle('active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      renderLeads();
    });
  });
  $('openPhone').addEventListener('click', () => open($('phone').value.trim().replace(/\D/g, '')));
  $('take').addEventListener('click', () => action(async () => {
    await request('/central/modo', { method:'POST', body: {telefone:selected, humano:true} });
    human = true;
  }));
  $('release').addEventListener('click', () => action(async () => {
    await request('/central/modo', { method:'POST', body: {telefone:selected, humano:false} });
    human = false;
  }));
  $('message').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!$('send').disabled && $('message').value.trim()) $('send').click();
    }
  });
  // O menu fica no document.body para não ser cortado pela área de digitação
  // (que possui overflow-y:auto). Também funciona enquanto o cliente não respondeu.
  const attachmentOptions = $('attachmentOptions');
  document.body.appendChild(attachmentOptions);
  function closeAttachmentMenu() {
    attachmentOptions.hidden = true;
    $('attachmentMenu').setAttribute('aria-expanded', 'false');
  }
  function placeAttachmentMenu() {
    const rect = $('attachmentMenu').getBoundingClientRect();
    const width = attachmentOptions.offsetWidth || 215;
    const height = attachmentOptions.offsetHeight || 102;
    attachmentOptions.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
    attachmentOptions.style.top = Math.max(8, rect.top - height - 8) + 'px';
  }
  $('attachmentMenu').addEventListener('click', () => {
    if ($('attachmentMenu').disabled) return;
    if (!attachmentOptions.hidden) {
      closeAttachmentMenu();
      return;
    }
    attachmentOptions.hidden = false;
    placeAttachmentMenu();
    $('attachmentMenu').setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('click', event => {
    if (!$('attachmentMenu').contains(event.target) && !attachmentOptions.contains(event.target))
      closeAttachmentMenu();
  });
  window.addEventListener('resize', () => { if (!attachmentOptions.hidden) placeAttachmentMenu(); });
  $('messages').addEventListener('scroll', closeAttachmentMenu);
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
    $('attachmentOptions').hidden = true;
    $('attachmentMenu').setAttribute('aria-expanded', 'false');
    const file = $('pdf').files?.[0];
    if (!file) return;
    if (!selected || busy) {
      clearVoucher();
      status('Selecione uma conversa antes de anexar o voucher.', 'error');
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
    status(windowOpen && human
      ? 'Revise a mensagem e confirme o envio do voucher.'
      : 'Voucher preparado. Para enviar, assuma a conversa e aguarde a janela de 24 horas abrir.');
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
  function clearAudio() {
    discardRecording = true;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder = null;
    if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
    pendingAudio = null;
    $('audioFile').value = '';
    $('audioPreview').hidden = true;
    $('audioPlayer').removeAttribute('src');
    $('audioPlayer').load();
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    audioPreviewUrl = '';
    $('recordingInfo').textContent = 'Ouça antes de enviar';
    setDisabled();
  }
  function showAudio(blob, name, gravado, phone) {
    if (phone !== selected) return;
    clearAudio();
    pendingAudio = { blob, name, gravado, telefone: phone };
    audioPreviewUrl = URL.createObjectURL(blob);
    $('audioPlayer').src = audioPreviewUrl;
    $('audioTitle').textContent = gravado ? 'Mensagem de voz' : name;
    $('audioPreview').hidden = false;
    setDisabled();
    status(windowOpen && human
      ? 'Ouça o áudio e confirme o envio para este cliente.'
      : 'Áudio preparado. Para enviar, assuma a conversa e aguarde a janela de 24 horas abrir.');
  }
  $('audioFile').addEventListener('change', () => {
    $('attachmentOptions').hidden = true;
    $('attachmentMenu').setAttribute('aria-expanded', 'false');
    const file = $('audioFile').files?.[0];
    if (!file) return;
    if (!selected || busy || file.size > 8 * 1024 * 1024 || !file.size) {
      $('audioFile').value = '';
      status('Selecione uma conversa e um áudio de até 8 MB.', 'error');
      return;
    }
    showAudio(file, file.name, false, selected);
  });
  $('mic').addEventListener('click', async () => {
    if (recorder) {
      if (recorder.state === 'recording') recorder.stop();
      recorder = null;
      setDisabled();
      return;
    }
    if (!selected || busy || !human || !windowOpen || pendingAudio) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      status('Este navegador não permite gravação de áudio. Use o anexo de áudio.', 'error');
      return;
    }
    const phone = selected;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (selected !== phone || busy || !human || !windowOpen) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      recordingStream = stream;
      discardRecording = false;
      const formats = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'];
      const supported = formats.find(t => MediaRecorder.isTypeSupported(t));
      const media = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
      const chunks = [];
      recorder = media;
      media.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      media.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        recordingStream = null;
        const discarded = discardRecording;
        if (recorder === media) recorder = null;
        if (!discarded && chunks.length) {
          const blob = new Blob(chunks, { type: media.mimeType || 'audio/webm' });
          if (blob.size > 8 * 1024 * 1024) {
            status('Gravação acima de 8 MB. Faça um áudio mais curto.', 'error');
          } else {
            showAudio(blob, 'mensagem-de-voz', true, phone);
          }
        }
        setDisabled();
      };
      media.onerror = () => {
        status('Falha na gravação de áudio.', 'error');
        clearAudio();
      };
      media.start(1000);
      setDisabled();
      status('Gravando áudio. Clique novamente no microfone para parar.');
    } catch (error) {
      status('Microfone indisponível ou sem permissão no navegador.', 'error');
      if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
      recordingStream = null;
      recorder = null;
      setDisabled();
    }
  });
  $('cancelAudio').addEventListener('click', clearAudio);
  $('sendAudio').addEventListener('click', () => action(async () => {
    if (!pendingAudio || pendingAudio.telefone !== selected)
      throw Error('Selecione o áudio novamente para este cliente.');
    const { blob, name, gravado } = pendingAudio;
    if (blob.size > 8 * 1024 * 1024 || !blob.size) throw Error('Áudio inválido ou maior que 8 MB.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    await request('/central/audios', { method:'POST', body: {
      telefone:selected, nome_arquivo:name, audio_base64:btoa(binary), gravado
    }});
    clearAudio();
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
  updateMobileView();
  boot();
})();
