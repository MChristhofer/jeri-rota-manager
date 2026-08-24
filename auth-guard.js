(async function(){
  const client=window.jeriSupabase;
  const currentPage=location.pathname.split('/').pop()||'index.html';
  const loginUrl=`login.html?next=${encodeURIComponent(currentPage)}`;

  if(!client){
    console.error('Supabase não foi inicializado.');
    location.replace(loginUrl);
    return;
  }

  try{
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user){
      location.replace(loginUrl);
      return;
    }

    document.body.style.visibility='visible';

    const button=document.getElementById('logoutSystemButton');
    if(button){
      button.addEventListener('click',async()=>{
        button.disabled=true;
        const original=button.innerHTML;
        button.innerHTML='<span>↪</span> Saindo...';
        const {error:logoutError}=await client.auth.signOut();
        if(logoutError){
          console.error('Erro ao sair:',logoutError);
          button.disabled=false;
          button.innerHTML=original;
          alert('Não foi possível encerrar a sessão. Tente novamente.');
          return;
        }
        location.replace('login.html');
      });
    }

    const profile=document.querySelector('.profile-mini div:last-child');
    if(profile&&user.email){
      const email=document.createElement('small');
      email.textContent=user.email;
      email.style.marginTop='3px';
      email.style.maxWidth='150px';
      email.style.overflow='hidden';
      email.style.textOverflow='ellipsis';
      email.style.whiteSpace='nowrap';
      email.title=user.email;
      profile.appendChild(email);
    }
  }catch(error){
    console.error('Erro ao validar sessão:',error);
    location.replace(loginUrl);
  }
})();
