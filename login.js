(async function(){
  const client=window.jeriSupabase;
  const form=document.getElementById('loginForm');
  const email=document.getElementById('email');
  const password=document.getElementById('password');
  const passwordToggle=document.getElementById('passwordToggle');
  const button=document.getElementById('loginButton');
  const message=document.getElementById('loginMessage');
  const next=new URLSearchParams(location.search).get('next')||'index.html';

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
    button.textContent='Entrando...';
    const {error}=await client.auth.signInWithPassword({email:emailValue,password:passwordValue});
    if(error){
      message.textContent='E-mail ou senha inválidos.';
      button.disabled=false;
      button.textContent='Entrar no Manager';
      return;
    }
    location.replace(next);
  });
})();
