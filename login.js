(async function(){
  const client=window.jeriSupabase;
  const form=document.getElementById('loginForm');
  const email=document.getElementById('email');
  const password=document.getElementById('password');
  const passwordToggle=document.getElementById('passwordToggle');
  const button=document.getElementById('loginButton');
  const buttonLabel=button?.querySelector('.button-label');
  const message=document.getElementById('loginMessage');
  const loginPage=document.querySelector('.login-page');
  const next=new URLSearchParams(location.search).get('next')||'index.html';
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

  if(!reduceMotion.matches&&window.matchMedia('(min-width: 931px) and (pointer: fine)').matches){
    const decorativeElements=[...document.querySelectorAll('.brand-orbit,.route-line')];
    let frame=0;
    let targetX=0;
    let targetY=0;
    const renderParallax=()=>{
      frame=0;
      decorativeElements.forEach((element,index)=>{
        const depth=index===2?4:2.5+(index*1.5);
        element.style.setProperty('--parallax-x',`${targetX*depth}px`);
        element.style.setProperty('--parallax-y',`${targetY*depth}px`);
        if(element.classList.contains('route-line')) element.style.transform=`translate3d(${targetX*depth}px,${targetY*depth}px,0)`;
      });
    };
    document.querySelector('.brand-panel')?.addEventListener('pointermove',event=>{
      const panel=event.currentTarget.getBoundingClientRect();
      targetX=((event.clientX-panel.left)/panel.width-.5)*2;
      targetY=((event.clientY-panel.top)/panel.height-.5)*2;
      if(!frame) frame=requestAnimationFrame(renderParallax);
    },{passive:true});
  }

  passwordToggle?.addEventListener('click',()=>{
    const show=password.type==='password';
    password.type=show?'text':'password';
    passwordToggle.textContent=show?'Ocultar':'Mostrar';
    passwordToggle.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
    passwordToggle.setAttribute('aria-pressed',String(show));
    password.focus();
  });

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

    button.disabled=true;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy','true');
    if(buttonLabel) buttonLabel.textContent='Entrando...';
    const {error}=await client.auth.signInWithPassword({email:emailValue,password:passwordValue});
    if(error){
      message.textContent='E-mail ou senha inválidos.';
      button.disabled=false;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
      if(buttonLabel) buttonLabel.textContent='Entrar no Manager';
      return;
    }
    if(!reduceMotion.matches){
      loginPage?.classList.add('is-leaving');
      await new Promise(resolve=>setTimeout(resolve,280));
    }
    location.replace(next);
  });
})();
