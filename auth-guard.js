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
    const profile=document.querySelector('.profile-mini');
    if(button&&profile){
      profile.appendChild(button);
      button.style.margin='0 0 0 auto';
      button.style.padding='7px 9px';
      button.style.width='auto';
      button.style.flex='0 0 auto';
      button.style.border='1px solid rgba(255,255,255,.18)';
      button.style.background='rgba(255,255,255,.08)';
      button.style.borderRadius='8px';
      button.style.fontSize='12px';
      button.innerHTML='<span style="width:auto">↪</span> Sair';
    }

    if(button){
      button.addEventListener('click',async()=>{
        button.disabled=true;
        const original=button.innerHTML;
        button.innerHTML='<span style="width:auto">↪</span> Saindo...';
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

    const profileInfo=document.querySelector('.profile-mini > div:not(.avatar)');
    if(profileInfo&&user.email&&!profileInfo.querySelector('[data-user-email]')){
      const email=document.createElement('small');
      email.dataset.userEmail='true';
      email.textContent=user.email;
      email.style.marginTop='3px';
      email.style.maxWidth='105px';
      email.style.overflow='hidden';
      email.style.textOverflow='ellipsis';
      email.style.whiteSpace='nowrap';
      email.title=user.email;
      profileInfo.appendChild(email);
    }

    if(currentPage==='index.html'||currentPage===''){
      window.addEventListener('load',()=>{
        ['reservation-flow.css','reservation-enhancements.css'].forEach(href=>{
          if(!document.querySelector(`link[href="${href}"]`)){
            const link=document.createElement('link');
            link.rel='stylesheet';
            link.href=href;
            document.head.appendChild(link);
          }
        });

        const loadEnhancements=()=>{
          if(document.querySelector('script[src="reservation-enhancements.js"]'))return;
          const enhance=document.createElement('script');
          enhance.src='reservation-enhancements.js';
          document.body.appendChild(enhance);
        };

        if(!document.querySelector('script[src="reservation-flow.js"]')){
          const script=document.createElement('script');
          script.src='reservation-flow.js';
          script.onload=()=>{
            const form=document.getElementById('reservationForm');
            form?.querySelector('[name="service"]')?.removeAttribute('required');
            form?.querySelector('[name="date"]')?.removeAttribute('required');
            loadEnhancements();
          };
          document.body.appendChild(script);
        }else loadEnhancements();
      },{once:true});
    }
  }catch(error){
    console.error('Erro ao validar sessão:',error);
    location.replace(loginUrl);
  }
})();
