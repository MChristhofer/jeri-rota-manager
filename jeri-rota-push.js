(() => {
  'use strict';
  const button = document.getElementById('pushToggle');
  const testButton = document.getElementById('pushTest');
  const note = document.getElementById('pushStatus');
  const api = String(window.JERI_CENTRAL_API_URL || '').replace(/\/$/, '');
  const supabase = window.jeriSupabase;
  let busy = false;
  let config = null;

  function status(text) { note.textContent = text; }
  async function request(path, method='GET', body) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw Error('Entre novamente na Central antes de ativar notificações.');
    const response = await fetch(api + path, {
      method,
      headers: {'Authorization':'Bearer ' + data.session.access_token,'Content-Type':'application/json'},
      cache:'no-store',
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(result.detail || 'Não foi possível atualizar as notificações.');
    return result;
  }
  function supported() {
    return window.isSecureContext && 'serviceWorker' in navigator &&
      'PushManager' in window && 'Notification' in window;
  }
  function homeScreen() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }
  function toUint8(base64url) {
    const padded = base64url.padEnd(Math.ceil(base64url.length / 4) * 4, '=');
    const bytes = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bytes, c => c.charCodeAt(0));
  }
  async function ready() {
    if (!supported()) {
      status('Seu navegador não oferece Web Push. No iPhone, use iOS 16.4 ou posterior.');
      button.disabled = true;
      return;
    }
    if (!homeScreen() && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      status('No iPhone, abra a Central pelo ícone adicionado à Tela de Início para ativar alertas.');
      button.disabled = true;
      return;
    }
    if (!api || !supabase) { status('Central desconectada. Entre no Manager.'); button.disabled=true; return; }
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) { status('Entre na Central para ativar notificações.'); button.disabled=true; return; }
    config = await request('/central/push-config');
    if (!config.enabled || !config.public_key) { status('Notificações ainda não configuradas no servidor.'); button.disabled=true; return; }
    const reg = await navigator.serviceWorker.register('/jeri-rota-push-sw.js', {scope:'/'});
    const sub = await reg.pushManager.getSubscription();
    button.textContent = sub ? 'Desativar notificações' : 'Ativar notificações';
    testButton.hidden = !sub;
    status(sub ? 'Alertas cadastrados neste aparelho.' : 'Receba alertas quando um cliente enviar mensagem.');
  }
  button.addEventListener('click', async () => {
    if (busy || !config?.enabled) return;
    busy = true;
    button.disabled = true;
    try {
      // No iOS, solicitar a permissão diretamente no gesto do toque,
      // antes de qualquer await que possa consumir a ativação do usuário.
      const enabling = button.textContent.trim() === 'Ativar notificações';
      const permissionRequest = enabling ? Notification.requestPermission() : null;
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        await request('/central/push-unsubscribe','POST',{endpoint:sub.endpoint});
        await sub.unsubscribe();
        button.textContent='Ativar notificações';
        testButton.hidden=true;
        status('Notificações desativadas neste aparelho.');
      } else {
        // A permissão precisa ser solicitada diretamente após o toque do usuário.
        const permission = await permissionRequest;
        if (permission !== 'granted') throw Error('Permissão não concedida. Autorize as notificações nos Ajustes do iPhone.');
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:toUint8(config.public_key),
        });
        try {
          await request('/central/push-subscribe','POST',sub.toJSON());
        } catch (e) {
          await sub.unsubscribe();
          throw e;
        }
        button.textContent='Desativar notificações';
        testButton.hidden=false;
        status('Notificações ativadas! Toque em Testar para conferir.');
      }
    } catch(e) { status(e.message || 'Falha ao configurar notificações.'); }
    finally { busy=false; button.disabled=false; }
  });
  testButton.addEventListener('click', async () => {
    if (busy) return;
    busy=true; testButton.disabled=true;
    try {
      const result=await request('/central/push-test','POST');
      status(result.entregas_aceitas > 0 ? 'Teste solicitado ao serviço de notificações. Confira o iPhone.' :
        'Nenhum dispositivo ativo aceitou o teste. Verifique sua configuração.');
    } catch(e) { status(e.message || 'Erro ao testar notificações.'); }
    finally { busy=false; testButton.disabled=false; }
  });
  ready().catch(e => {status(e.message||'Não foi possível iniciar notificações.');button.disabled=true;});
})();
