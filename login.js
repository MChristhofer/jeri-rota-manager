(async function(){
  const client=window.jeriSupabase;
  const form=document.getElementById('loginForm');
  const email=document.getElementById('email');
  const password=document.getElementById('password');
  const passwordToggle=document.getElementById('passwordToggle');
  const button=document.getElementById('loginButton');
  const message=document.getElementById('loginMessage');
  const brandPanel=document.querySelector('.brand-panel');
  const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const next=new URLSearchParams(location.search).get('next')||'index.html';

  passwordToggle?.addEventListener('click',()=>{
    const show=password.type==='password';
    password.type=show?'text':'password';
    passwordToggle.textContent=show?'Ocultar':'Mostrar';
    passwordToggle.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
    passwordToggle.setAttribute('aria-pressed',String(show));
    password.focus();
  });

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

  const setLoading=loading=>{
    button.disabled=loading;
    button.classList.toggle('is-loading',loading);
    button.textContent=loading?'Entrando...':'Entrar no Manager';
  };

  const {data:{user}}=await client.auth.getUser();
  if(user){location.replace(next);return}

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    message.textContent='';

    const emailValue=email.value.trim().toLowerCase();
    const passwordValue=password.value;
    const emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

    if(!emailOk){
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

    if(!prefersReducedMotion){
      document.body.classList.add('login-success');
      setTimeout(()=>location.replace(next),280);
      return;
    }
    location.replace(next);
  });
})();
