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
  function closeChatOptions() {
    $('chatActions').classList.remove('mobile-open');
    $('mobileChatOptions').setAttribute('aria-expanded', 'false');
  }
  function updateMobileView() {
    const active = chatView && selected;
    $('centralShell').dataset.mobileView = active ? 'chat' : 'list';
    document.body.classList.toggle('mobile-chat-active', Boolean(active && mobileMedia.matches));
    if (!active) closeChatOptions();
  }
  $('mobileChatOptions').addEventListener('click', () => {
    const open = !$('chatActions').classList.contains('mobile-open');
    $('chatActions').classList.toggle('mobile-open', open);
    $('mobileChatOptions').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#chatActions, #mobileChatOptions')) closeChatOptions();
  });
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

  // Navegação dedicada: só executa ações reais da Central.
  $('railConversations').addEventListener('click', () => {
    showConversations();
    $('search').focus();
  });
  function showPushSettings() {
    const settings = $('pushSettings');
    settings.open = !settings.open;
    $('showAlerts').setAttribute('aria-expanded', String(settings.open));
    $('railAlerts').setAttribute('aria-pressed', String(settings.open));
    if (settings.open) settings.scrollIntoView({block:'nearest'});
  }
  $('showAlerts').addEventListener('click', showPushSettings);
  $('railAlerts').addEventListener('click', showPushSettings);
  $('pushSettings').addEventListener('toggle', () => {
    const expanded = $('pushSettings').open;
    $('showAlerts').setAttribute('aria-expanded', String(expanded));
    $('railAlerts').setAttribute('aria-pressed', String(expanded));
  });

  // Iniciar conversa permanece acessível mesmo sem cliente previamente selecionado.
  const newChatDialog = $('newConversationDialog');
  function closeNewChat() { if (newChatDialog.open) newChatDialog.close(); }
  $('newConversation').addEventListener('click', () => {
    $('newConversationError').textContent = '';
    $('newConversationNumber').value = '';
    if (typeof newChatDialog.showModal === 'function') newChatDialog.showModal();
    else newChatDialog.setAttribute('open', '');
    $('newConversationNumber').focus();
  });
  $('closeNewConversation').addEventListener('click', closeNewChat);
  $('cancelNewConversation').addEventListener('click', closeNewChat);
  $('newConversationForm').addEventListener('submit', event => {
    event.preventDefault();
    const phone = $('newConversationNumber').value.replace(/\D/g,'');
    if (!validPhone(phone)) {
      $('newConversationError').textContent = 'Informe um telefone válido com DDI e DDD (10 a 15 dígitos).';
      return;
    }
    closeNewChat();
    open(phone);
    $('advancedTools').open = false;
  });

  function status(text, type = '') {
    $('status').textContent = text;
    $('status').className = 'status ' + type;
  }
  function validPhone(value) { return /^[0-9]{10,15}$/.test(value); }
  function setDisabled() {
    $('take').disabled = !selected || busy || human;
    $('take').hidden = !selected || human;
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
    const pendingHuman = Boolean(leads.find(l => String(l.telefone_whatsapp) === selected)?.aguardando);
    $('mode').textContent = human ? 'Humano ativo' : (pendingHuman ? 'Aguardando humano' : 'IA ativa');
    $('mobileModeLabel').textContent = !selected
      ? 'Selecione uma conversa para começar'
      : (human ? 'Humano ativo' : (pendingHuman ? 'Aguardando humano' : 'Recepção virtual'))
        + (windowOpen ? ' · Janela aberta' : ' · Janela fechada');
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
  // Fotos privadas: são baixadas somente por atendente autenticado.
  // Nunca usamos URLs públicas do Supabase nem expomos chaves no HTML.
  const contactPhotoCache = new Map();
  const contactPhotoPending = new Map();
  function contactForPhone(phone) {
    return leads.find(l => String(l.telefone_whatsapp || '') === String(phone)) || null;
  }
  function discardContactPhoto(phone) {
    const cached = contactPhotoCache.get(phone);
    if (cached) URL.revokeObjectURL(cached.url);
    contactPhotoCache.delete(phone);
    contactPhotoPending.delete(phone);
  }
  async function getContactPhoto(phone, revision) {
    const cached = contactPhotoCache.get(phone);
    if (cached?.revision === revision) return cached.url;
    const key = phone + '|' + revision;
    if (contactPhotoPending.has(key)) return contactPhotoPending.get(key);
    const promise = (async () => {
      const {data, error} = await supabase.auth.getSession();
      if (error || !data.session?.access_token) throw Error('Entre novamente na Central.');
      const result = await fetch(api + '/central/contatos/' + encodeURIComponent(phone) + '/foto', {
        headers: {'Authorization': 'Bearer ' + data.session.access_token},
        cache: 'no-store'
      });
      if (!result.ok) throw Error('Foto do cliente indisponível.');
      const blob = await result.blob();
      if (!blob.type.startsWith('image/jpeg') || !blob.size || blob.size > 100000)
        throw Error('Formato de foto inesperado.');
      // Uma edição mais recente pode ter invalidado este pedido enquanto ele carregava.
      if (contactPhotoPending.get(key) !== promise) return null;
      const old = contactPhotoCache.get(phone);
      if (old) URL.revokeObjectURL(old.url);
      const url = URL.createObjectURL(blob);
      contactPhotoCache.set(phone, {revision, url});
      return url;
    })().finally(() => {
      if (contactPhotoPending.get(key) === promise) contactPhotoPending.delete(key);
    });
    contactPhotoPending.set(key, promise);
    return promise;
  }
  function applyContactAvatar(element, contact) {
    const phone = String(contact?.telefone_whatsapp || '');
    const name = String(contact?.nome || '').trim();
    element.replaceChildren();
    element.textContent = name ? initials(name) : '+';
    element.classList.remove('has-contact-photo');
    const revision = String(contact?.foto_atualizada_em || '');
    if (!contact?.tem_foto || !revision || !phone) return;
    element.dataset.photoRevision = revision;
    function setImg(url) {
      if (!url || element.dataset.photoRevision !== revision) return;
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.decoding = 'async';
      element.replaceChildren(img);
      element.classList.add('has-contact-photo');
    }
    const cached = contactPhotoCache.get(phone);
    if (cached?.revision === revision) setImg(cached.url);
    else getContactPhoto(phone, revision).then(setImg).catch(() => {});
  }

  let editingContactPhone = '';
  let editingContactInitialName = '';
  let editingContactDeletePhoto = false;
  let editingContactFile = null;
  let contactPreviewUrl = '';
  let contactEditBusy = false;
  const editor = $('contactEditor');
  function photoEditStatus(message, error = false) {
    $('contactEditorStatus').textContent = message;
    $('contactEditorStatus').classList.toggle('error', error);
  }
  function releaseContactPreview() {
    if (contactPreviewUrl) URL.revokeObjectURL(contactPreviewUrl);
    contactPreviewUrl = '';
  }
  function showContactEditPreview(url) {
    const img = $('contactEditorPhoto');
    if (!url) {
      img.hidden = true;
      img.removeAttribute('src');
      $('contactEditorInitials').hidden = false;
      return;
    }
    img.src = url;
    img.hidden = false;
    $('contactEditorInitials').hidden = true;
  }
  function closeContactEditor() {
    if (contactEditBusy) return;
    releaseContactPreview();
    $('contactPhotoFile').value = '';
    editingContactFile = null;
    editingContactPhone = '';
    if (editor.open) editor.close();
  }
  $('editContact').addEventListener('click', async () => {
    if (!selected || contactEditBusy) return;
    const phone = selected;
    const contact = contactForPhone(phone);
    const name = String(contact?.nome || '').trim();
    editingContactPhone = phone;
    editingContactInitialName = name;
    editingContactFile = null;
    editingContactDeletePhoto = false;
    releaseContactPreview();
    $('contactPhotoFile').value = '';
    $('contactNameField').value = name;
    $('contactEditorInitials').textContent = name ? initials(name) : '+';
    photoEditStatus('');
    $('removeContactPhoto').disabled = !contact?.tem_foto;
    showContactEditPreview(null);
    editor.showModal();
    if (contact?.tem_foto) {
      try {
        const url = await getContactPhoto(phone, String(contact.foto_atualizada_em || ''));
        if (editingContactPhone === phone && editor.open && !editingContactFile && !editingContactDeletePhoto)
          showContactEditPreview(url);
      } catch (_) {
        if (editingContactPhone === phone && editor.open) photoEditStatus('Foto atual indisponível. Você pode substituí-la.', true);
      }
    }
  });
  $('closeContactEditor').addEventListener('click', closeContactEditor);
  $('cancelContactEdit').addEventListener('click', closeContactEditor);
  editor.addEventListener('cancel', event => { if (contactEditBusy) event.preventDefault(); });
  editor.addEventListener('close', () => {
    releaseContactPreview();
    editingContactFile = null;
    editingContactPhone = '';
  });
  $('contactPhotoFile').addEventListener('change', () => {
    const file = $('contactPhotoFile').files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024 || !file.size) {
      photoEditStatus('Escolha uma foto de até 20 MB. Ela será reduzida antes do envio.', true);
      $('contactPhotoFile').value = '';
      return;
    }
    releaseContactPreview();
    contactPreviewUrl = URL.createObjectURL(file);
    editingContactFile = file;
    editingContactDeletePhoto = false;
    showContactEditPreview(contactPreviewUrl);
    $('removeContactPhoto').disabled = false;
    photoEditStatus('Foto escolhida. Toque em Salvar alterações para confirmar.');
  });
  $('contactNameField').addEventListener('input', () => {
    const text = $('contactNameField').value.trim();
    $('contactEditorInitials').textContent = text ? initials(text) : '+';
  });
  $('removeContactPhoto').addEventListener('click', () => {
    editingContactDeletePhoto = true;
    editingContactFile = null;
    $('contactPhotoFile').value = '';
    releaseContactPreview();
    showContactEditPreview(null);
    $('removeContactPhoto').disabled = true;
    photoEditStatus('Foto será removida quando você salvar.');
  });
  async function imageFileToJpeg(file) {
    if (!file || !file.size || file.size > 20 * 1024 * 1024) throw Error('Escolha uma foto de até 20 MB.');
    const previewUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(Error('Não foi possível abrir esta foto. Tente JPG ou PNG.'));
        img.src = previewUrl;
      });
      if (!img.naturalWidth || !img.naturalHeight) throw Error('Foto inválida.');
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('O navegador não conseguiu preparar a foto.');
      const edge = Math.min(img.naturalWidth, img.naturalHeight);
      const x = Math.round((img.naturalWidth - edge) / 2);
      const y = Math.round((img.naturalHeight - edge) / 2);
      ctx.drawImage(img, x, y, edge, edge, 0, 0, size, size);
      const jpeg = canvas.toDataURL('image/jpeg', 0.8);
      if (!jpeg.startsWith('data:image/jpeg;base64,')) throw Error('Não foi possível converter a imagem para JPG.');
      return jpeg.slice('data:image/jpeg;base64,'.length);
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  }
  $('contactEditorForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (contactEditBusy || !editingContactPhone) return;
    const phone = editingContactPhone;
    const name = $('contactNameField').value.trim().replace(/\s+/g, ' ');
    const deletePhoto = editingContactDeletePhoto;
    const file = editingContactFile;
    contactEditBusy = true;
    $('saveContactEdit').disabled = true;
    $('cancelContactEdit').disabled = true;
    $('closeContactEditor').disabled = true;
    $('removeContactPhoto').disabled = true;
    photoEditStatus('Salvando informações...');
    try {
      if (file) {
        const jpeg = await imageFileToJpeg(file);
        await request('/central/contatos/' + phone + '/foto',
          {method:'POST', body:{foto_base64:jpeg}});
        discardContactPhoto(phone);
      } else if (deletePhoto) {
        await request('/central/contatos/' + phone + '/foto', {method:'DELETE'});
        discardContactPhoto(phone);
      }
      if (name !== editingContactInitialName) {
        await request('/central/contatos/' + phone + '/nome',
          {method:'PATCH', body:{nome:name}});
      }
      await refreshLeads();
      if (selected === phone) await open(phone, {silent:true});
      editor.close();
      status('Contato atualizado.', 'ok');
    } catch (error) {
      photoEditStatus(error.message || 'Não foi possível salvar o contato.', true);
    } finally {
      contactEditBusy = false;
      $('saveContactEdit').disabled = false;
      $('cancelContactEdit').disabled = false;
      $('closeContactEditor').disabled = false;
      $('removeContactPhoto').disabled = !editingContactFile && !contactForPhone(phone)?.tem_foto;
    }
  });
  function renderLeads() {
    const pending = leads.filter(l => l.aguardando).length;
    const chip = document.querySelector('.filter-chip[data-filter="waiting"]');
    if (chip) chip.textContent = pending ? 'Aguardando (' + pending + ')' : 'Aguardando';
    const filter = $('search').value.trim().toLocaleLowerCase('pt-BR');
    const root = $('leads');
    root.replaceChildren();
    const visible = leads.filter(l => {
      const name = String(l.nome || '').trim().toLocaleLowerCase('pt-BR');
      const phone = String(l.telefone_whatsapp || '');
      const numericFilter = filter.replace(/\D/g, '');
      const matches = !filter || name.includes(filter) || (numericFilter.length > 0 && phone.includes(numericFilter));
      return matches && (
        inboxFilter === 'all' ||
        (inboxFilter === 'human' && l.humano) ||
        (inboxFilter === 'waiting' && l.aguardando) ||
        (inboxFilter === 'ai' && !l.humano && !l.aguardando)
      );
    });
    if (!visible.length) {
      const p = document.createElement('div');
      p.className = 'empty';
      p.textContent = 'Nenhuma conversa encontrada.';
      root.append(p);
      return;
    }
    const fragment = document.createDocumentFragment();
    const ordered = [...visible].sort((a,b) => {
      if (Boolean(a.aguardando) !== Boolean(b.aguardando)) return a.aguardando ? -1 : 1;
      if (a.aguardando && b.aguardando && Number(a.fila_prioridade||0) !== Number(b.fila_prioridade||0))
        return Number(b.fila_prioridade||0) - Number(a.fila_prioridade||0);
      return new Date(b.ultima_mensagem_em || 0) - new Date(a.ultima_mensagem_em || 0);
    });
    ordered.forEach(l => {
      const phone = String(l.telefone_whatsapp || '');
      const name = String(l.nome || '').trim();
      const displayName = name || '+' + phone;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lead inbox-lead' + (phone === selected ? ' active' : '');
      btn.setAttribute('aria-label', 'Abrir conversa com ' + displayName);
      const avatar = document.createElement('span');
      avatar.className = 'inbox-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      applyContactAvatar(avatar, l);
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
      const readablePreview = last.replace(/^\[(RECEPÇÃO|HUMANO)\]\s*/i, '');
      const voicePreview = readablePreview.startsWith('[Áudio recebido');
      preview.textContent = voicePreview ? '♫ Mensagem de voz' :
        readablePreview ? (l.ultima_previa_papel === 'assistant' ? 'Jeri Rota: ' : '') + readablePreview : 'Sem mensagens recentes';
      const footer = document.createElement('span');
      footer.className = 'inbox-lead-footer';
      const sub = document.createElement('span');
      sub.className = 'inbox-lead-phone';
      sub.textContent = name ? '+' + phone : '';
      const mode = document.createElement('span');
      mode.className = 'inbox-mode ' + (l.humano ? 'human' : (l.aguardando ? 'waiting' : 'ai'));
      mode.textContent = l.humano ? 'Humano ativo' : (l.aguardando ? (Number(l.fila_prioridade||0)>0 ? 'Prioritário' : 'Aguardando') : 'IA');
      footer.append(sub, mode);
      body.append(head, preview, footer);
      btn.append(avatar, body);
      btn.addEventListener('click', () => open(phone));
      fragment.append(btn);
    });
    root.append(fragment);
  }
  async function refreshLeads() {
    try {
      const latest = await request('/central/conversas');
      leads = latest;
      renderLeads();
      $('inboxConnection').textContent = 'Central sincronizada · Atualização automática';
      document.querySelector('.inbox-footer-dot').className = 'inbox-footer-dot online';
    } catch (error) {
      $('inboxConnection').textContent = 'Falha na atualização. Tente novamente.';
      document.querySelector('.inbox-footer-dot').className = 'inbox-footer-dot offline';
      throw error;
    }
  }

  // Preserva controles de áudio durante atualização automática do chat.
  let visibleMessageKeys = [];
  const incomingAudioCache = new Map();
  function releaseIncomingAudio() {
    for (const url of incomingAudioCache.values()) URL.revokeObjectURL(url);
    incomingAudioCache.clear();
    visibleMessageKeys = [];
  }
  async function fetchIncomingAudio(phone, messageId) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw Error('Sessão expirada. Faça login novamente.');
    const url = api + '/central/conversas/' + encodeURIComponent(phone) +
      '/audios/' + encodeURIComponent(messageId);
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + data.session.access_token },
      cache: 'no-store'
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw Error(typeof result.detail === 'string' ? result.detail : 'Não foi possível abrir o áudio.');
    }
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith('audio/')) throw Error('Formato de áudio inválido.');
    return blob;
  }
  function messageSignature(row) {
    return [row.id || row.criado_em, row.papel, row.conteudo, row.audio_disponivel ? 1 : 0].join('|');
  }
  function bubbleFor(row, phone) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble' + (row.papel === 'assistant' ? ' out' : '');
    const raw = String(row.conteudo || '');
    const hasAudio = row.papel === 'user' && Boolean(row.audio_disponivel && row.id);
    let cleanText = raw;
    let origin = '';
    if (row.papel === 'assistant' && raw.startsWith('[RECEPÇÃO] ')) {
      cleanText = raw.slice('[RECEPÇÃO] '.length);
      origin = 'RECEPÇÃO VIRTUAL';
    } else if (row.papel === 'assistant' && raw.startsWith('[HUMANO] ')) {
      cleanText = raw.slice('[HUMANO] '.length);
      origin = 'ATENDENTE';
    }
    if (origin) {
      const label = document.createElement('span');
      label.className = 'bubble-origin';
      label.textContent = origin;
      bubble.append(label);
    }
    const content = document.createElement('div');
    content.className = 'bubble-text';
    content.textContent = hasAudio && raw.startsWith('[Áudio recebido')
      ? 'Mensagem de voz recebida' : cleanText;
    bubble.append(content);
    if (hasAudio) {
      const area = document.createElement('div');
      area.className = 'received-audio';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'received-audio-button';
      button.textContent = '▶ Ouvir áudio';
      button.setAttribute('aria-label', 'Ouvir áudio recebido do cliente');
      const player = document.createElement('audio');
      player.controls = true;
      player.preload = 'none';
      player.hidden = true;
      player.setAttribute('aria-label', 'Áudio recebido');
      const error = document.createElement('span');
      error.className = 'received-audio-error';
      error.hidden = true;
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Carregando áudio...';
        error.hidden = true;
        try {
          let url = incomingAudioCache.get(row.id);
          if (!url) {
            const audioBlob = await fetchIncomingAudio(phone, row.id);
            if (selected !== phone) return;
            url = URL.createObjectURL(audioBlob);
            incomingAudioCache.set(row.id, url);
          }
          if (selected !== phone) return;
          player.src = url;
          player.hidden = false;
          button.hidden = true;
          // Após o download, o Safari pode pedir um toque no controle de reprodução.
          player.play().catch(() => {});
        } catch (ex) {
          error.textContent = ex.message || 'Falha ao carregar o áudio.';
          error.hidden = false;
          button.disabled = false;
          button.textContent = '↻ Tentar ouvir áudio';
        }
      });
      area.append(button, player, error);
      bubble.append(area);
    } else if (row.papel === 'user' && raw.startsWith('[Áudio recebido')) {
      const legacy = document.createElement('div');
      legacy.className = 'received-audio-legacy';
      legacy.textContent = 'Este áudio foi recebido antes da atualização. Peça ao cliente para reenviar.';
      bubble.append(legacy);
    }
    const meta = document.createElement('small');
    meta.className = 'bubble-time';
    const created = new Date(row.criado_em);
    meta.textContent = Number.isNaN(created.getTime()) ? '' :
      created.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    bubble.append(meta);
    return bubble;
  }
  function dateCode(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [date.getFullYear(),date.getMonth()+1,date.getDate()].join('-');
  }
  function dayLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'HOJE';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'ONTEM';
    return date.toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'});
  }
  function renderMessages(rows, phone) {
    const root = $('messages');
    const keys = rows.map(messageSignature);
    const samePhone = displayedPhone === phone;
    const onlyAppend = samePhone && visibleMessageKeys.length <= keys.length &&
      visibleMessageKeys.every((key, i) => key === keys[i]);
    if (onlyAppend && visibleMessageKeys.length === keys.length) return;
    const atBottom = !samePhone || root.scrollHeight - root.clientHeight - root.scrollTop < 110;
    const previousTop = root.scrollTop;
    if (!samePhone) releaseIncomingAudio();
    displayedPhone = phone;
    const from = onlyAppend ? visibleMessageKeys.length : 0;
    if (!onlyAppend) root.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Ainda não há mensagens armazenadas para este telefone.';
      root.append(empty);
    } else {
      const fragment = document.createDocumentFragment();
      let previousDay = from > 0 ? dateCode(rows[from - 1].criado_em) : '';
      for (let i = from; i < rows.length; i++) {
        const currentDay = dateCode(rows[i].criado_em);
        if (currentDay && currentDay !== previousDay) {
          const label = document.createElement('div');
          label.className = 'message-day';
          label.textContent = dayLabel(rows[i].criado_em);
          fragment.append(label);
        }
        fragment.append(bubbleFor(rows[i], phone));
        previousDay = currentDay;
      }
      root.append(fragment);
    }
    visibleMessageKeys = keys;
    root.scrollTop = atBottom ? root.scrollHeight : previousTop;
  }
  async function open(phone, { silent = false } = {}) {
    if (!validPhone(phone)) { status('Informe o telefone com DDI e DDD, somente números.', 'error'); return; }
    const requestId = ++openRequestId;
    const changingConversation = selected !== phone;
    if (changingConversation) releaseIncomingAudio();
    if (changingConversation && pendingVoucher) clearVoucher();
    if (changingConversation) clearAudio();
    if (changingConversation) {
      $('attachmentOptions').hidden = true;
      $('attachmentMenu').setAttribute('aria-expanded', 'false');
    }
    selected = phone;
    if (!silent) showChat();
    $('phone').value = phone;
    const contact = leads.find(l => String(l.telefone_whatsapp) === phone);
    const contactName = String(contact?.nome || '').trim();
    $('title').textContent = contactName || '+' + phone;
    applyContactAvatar($('chatAvatar'), contact || {telefone_whatsapp:phone, nome:contactName});
    $('editContact').disabled = false;
    closeChatOptions();
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
  function toggleAdvancedTools() {
    const details = $('advancedTools');
    details.open = !details.open;
    closeAttachmentMenu();
    closeChatOptions();
    if (details.open) {
      details.closest('.composer').scrollTop = details.closest('.composer').scrollHeight;
      details.querySelector('summary').focus();
    }
  }
  $('advancedShortcut').addEventListener('click', toggleAdvancedTools);
  $('advancedHeader').addEventListener('click', toggleAdvancedTools);

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
  window.addEventListener('pagehide', () => {
    for (const item of contactPhotoCache.values()) URL.revokeObjectURL(item.url);
    contactPhotoCache.clear();
    releaseContactPreview();
  });
  setDisabled();
  updateMobileView();
  boot();
})();
