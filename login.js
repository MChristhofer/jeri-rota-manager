(async function(){
  const client=window.jeriSupabase;
  const form=document.getElementById('loginForm');
  const email=document.getElementById('email');
  const password=document.getElementById('password');
  const passwordToggle=document.getElementById('passwordToggle');
  const forgotPassword=document.getElementById('forgotPassword');
  const capsLockMessage=document.getElementById('capsLockMessage');
  const button=document.getElementById('loginButton');
  const message=document.getElementById('loginMessage');
  const brandPanel=document.querySelector('.brand-panel');
  const authTitle=document.querySelector('.auth-wrap h2');
  const authIntro=document.querySelector('.auth-intro');
  const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params=new URLSearchParams(location.search);
  const next=params.get('next')||'index.html';
  const recoveryMode=params.get('recovery')==='1';

  passwordToggle?.addEventListener('click',()=>{
    const show=password.type==='password';
    password.type=show?'text':'password';
    passwordToggle.textContent=show?'Ocultar':'Mostrar';
    passwordToggle.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
    passwordToggle.setAttribute('aria-pressed',String(show));
    password.focus();
  });

  const updateCapsLock=event=>{
    if(!capsLockMessage)return;
    capsLockMessage.hidden=!event.getModifierState?.('CapsLock');
  };
  password?.addEventListener('keydown',updateCapsLock);
  password?.addEventListener('keyup',updateCapsLock);
  password?.addEventListener('blur',()=>{if(capsLockMessage)capsLockMessage.hidden=true});

  if(brandPanel&&!prefersReducedMotion&&window.matchMedia('(pointer:fine)').matches){
    let frame=0;
    let targetX=77;
    let targetY=18;
    const renderSpot=()=>{
      frame=0;
      brandPanel.style.setProperty('--spot-x',`${targetX}%`);
      brandPanel.style.setProperty('--spot-y',`${targetY}%`);
    };
    brandPanel.addEventListener('pointermove',event=>{
      const rect=brandPanel.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width;
      const y=(event.clientY-rect.top)/rect.height;
      targetX=Math.max(58,Math.min(88,68+x*18));
      targetY=Math.max(10,Math.min(38,10+y*24));
      if(!frame)frame=requestAnimationFrame(renderSpot);
    });
    brandPanel.addEventListener('pointerleave',()=>{
      targetX=77;
      targetY=18;
      if(!frame)frame=requestAnimationFrame(renderSpot);
    });
  }

  const setLoading=(loading,label)=>{
    button.disabled=loading;
    button.classList.toggle('is-loading',loading);
    if(label)button.textContent=label;
    else button.textContent=loading?'Entrando...':'Entrar no Manager';
  };

  const showSuccess=(text='Acesso autorizado ✓')=>{
    button.classList.remove('is-loading');
    button.classList.add('is-success');
    button.textContent=text;
  };

  const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  if(forgotPassword){
    forgotPassword.addEventListener('click',async()=>{
      message.textContent='';
      const emailValue=email.value.trim().toLowerCase();
      if(!validEmail(emailValue)){
        message.textContent='Digite seu e-mail acima para receber o link de recuperação.';
        email.focus();
        return;
      }
      forgotPassword.disabled=true;
      forgotPassword.textContent='Enviando...';
      const redirectTo=`${location.origin}${location.pathname}?recovery=1&next=${encodeURIComponent(next)}`;
      const {error}=await client.auth.resetPasswordForEmail(emailValue,{redirectTo});
      forgotPassword.disabled=false;
      forgotPassword.textContent='Esqueci minha senha';
      message.textContent=error?'Não foi possível enviar o link agora. Tente novamente.':'Link de recuperação enviado. Confira seu e-mail.';
    });
  }

  if(recoveryMode){
    if(authTitle)authTitle.textContent='Crie uma nova senha';
    if(authIntro)authIntro.textContent='Defina uma nova senha para voltar ao Jeri Rota Manager.';
    const emailField=email.closest('.field');
    if(emailField)emailField.hidden=true;
    if(forgotPassword)forgotPassword.hidden=true;
    if(capsLockMessage)capsLockMessage.hidden=true;
    const passwordLabel=password.closest('.field')?.querySelector('.field-label > span');
    if(passwordLabel)passwordLabel.textContent='Nova senha';
    password.placeholder='Mínimo de 8 caracteres';
    password.autocomplete='new-password';

    const confirmLabel=document.createElement('label');
    confirmLabel.className='field';
    confirmLabel.innerHTML='<span class="field-label">Confirmar nova senha</span><span class="field-input"><input id="confirmPassword" type="password" autocomplete="new-password" placeholder="Repita a nova senha" required></span>';
    button.before(confirmLabel);
    const confirmPassword=confirmLabel.querySelector('#confirmPassword');
    button.textContent='Salvar nova senha';

    form.addEventListener('submit',async event=>{
      event.preventDefault();
      message.textContent='';
      const value=password.value;
      if(value.length<8){message.textContent='Use uma senha com pelo menos 8 caracteres.';password.focus();return}
      if(value!==confirmPassword.value){message.textContent='As senhas não conferem.';confirmPassword.focus();return}
      setLoading(true,'Salvando...');
      const {error}=await client.auth.updateUser({password:value});
      if(error){message.textContent='Não foi possível alterar a senha. Abra novamente o link recebido por e-mail.';setLoading(false,'Salvar nova senha');return}
      showSuccess('Senha atualizada ✓');
      setTimeout(()=>location.replace(next),prefersReducedMotion?0:550);
    });
    return;
  }

  const {data:{user}}=await client.auth.getUser();
  if(user){location.replace(next);return}

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    message.textContent='';

    const emailValue=email.value.trim().toLowerCase();
    const passwordValue=password.value;

    if(!validEmail(emailValue)){
      message.textContent='Digite um e-mail válido. Ex.: admin@jerirota.com.br';
      email.focus();
      return;
    }
    if(!passwordValue){
      message.textContent='Digite sua senha.';
      password.focus();
      return;
    }

    setLoading(true);
    const {error}=await client.auth.signInWithPassword({email:emailValue,password:passwordValue});
    if(error){
      message.textContent='E-mail ou senha inválidos.';
      setLoading(false);
      return;
    }

    showSuccess();
    if(!prefersReducedMotion){
      setTimeout(()=>document.body.classList.add('login-success'),180);
      setTimeout(()=>location.replace(next),520);
      return;
    }
    location.replace(next);
  });
})();
