(async function(){
  const client=window.jeriSupabase;
  const form=document.getElementById('loginForm');
  const email=document.getElementById('email');
  const password=document.getElementById('password');
  const button=document.getElementById('loginButton');
  const message=document.getElementById('loginMessage');
  const next=new URLSearchParams(location.search).get('next')||'index.html';

  const {data:{user}}=await client.auth.getUser();
  if(user){location.replace(next);return}

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    message.textContent='';
    button.disabled=true;
    button.textContent='Entrando...';
    const {error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});
    if(error){
      message.textContent='E-mail ou senha inválidos.';
      button.disabled=false;
      button.textContent='Entrar';
      return;
    }
    location.replace(next);
  });
})();
