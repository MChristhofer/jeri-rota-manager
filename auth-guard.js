(async function(){
  const client=window.jeriSupabase;
  const currentPage=location.pathname.split('/').pop()||'index.html';
  const loginUrl=`login.html?next=${encodeURIComponent(currentPage)}`;
  const reservationCacheKey='jeri-rota-manager-reservas-v1';

  if((currentPage==='index.html'||currentPage==='')&&!localStorage.getItem(reservationCacheKey))localStorage.setItem(reservationCacheKey,'[]');
  if(!client){console.error('Supabase não foi inicializado.');location.replace(loginUrl);return}

  try{
    const {data:{user},error}=await client.auth.getUser();if(error||!user){location.replace(loginUrl);return}

    async function loadCloudData(){
      if(!(currentPage==='index.html'||currentPage===''))return;
      if(!window.JeriCloudData){await new Promise((resolve,reject)=>{const existing=document.querySelector('script[src^="cloud-data-sync.js"]');if(existing){if(window.JeriCloudData){resolve();return}existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const script=document.createElement('script');script.src='cloud-data-sync.js?v=20260825-2';script.onload=resolve;script.onerror=reject;document.body.appendChild(script)})}
      if(window.JeriCloudData?.refresh)await window.JeriCloudData.refresh();
    }
    try{await loadCloudData()}catch(syncError){console.error('Falha ao carregar dados do Supabase:',syncError);const hasCache=(()=>{try{return JSON.parse(localStorage.getItem(reservationCacheKey)||'[]').length>0}catch{return false}})();if(!hasCache)alert('Não foi possível carregar os dados do sistema. Verifique sua conexão e atualize a página.')}

    document.body.style.visibility='visible';
    const button=document.getElementById('logoutSystemButton');const profile=document.querySelector('.profile-mini');
    if(button&&profile){profile.appendChild(button);button.style.margin='0 0 0 auto';button.style.padding='7px 9px';button.style.width='auto';button.style.flex='0 0 auto';button.style.border='1px solid rgba(255,255,255,.18)';button.style.background='rgba(255,255,255,.08)';button.style.borderRadius='8px';button.style.fontSize='12px';button.innerHTML='<span style="width:auto">↪</span> Sair'}
    if(button){button.addEventListener('click',async()=>{button.disabled=true;const original=button.innerHTML;button.innerHTML='<span style="width:auto">↪</span> Saindo...';const {error:logoutError}=await client.auth.signOut();if(logoutError){console.error('Erro ao sair:',logoutError);button.disabled=false;button.innerHTML=original;alert('Não foi possível encerrar a sessão. Tente novamente.');return}location.replace('login.html')})}

    const profileInfo=document.querySelector('.profile-mini > div:not(.avatar)');
    if(profileInfo&&user.email&&!profileInfo.querySelector('[data-user-email]')){const email=document.createElement('small');email.dataset.userEmail='true';email.textContent=user.email;email.style.marginTop='3px';email.style.maxWidth='105px';email.style.overflow='hidden';email.style.textOverflow='ellipsis';email.style.whiteSpace='nowrap';email.title=user.email;profileInfo.appendChild(email)}

    if(currentPage==='index.html'||currentPage===''){
      const openRequestedReservation=()=>{const id=new URLSearchParams(location.search).get('openReservation');if(!id)return;const tryOpen=()=>{if(typeof window.setSection==='function')window.setSection('reservas');else if(typeof setSection==='function')setSection('reservas');if(typeof window.openModal==='function')window.openModal(Number(id));else if(typeof openModal==='function')openModal(Number(id));else return false;return true};if(!tryOpen()){let attempts=0;const timer=setInterval(()=>{attempts+=1;if(tryOpen()||attempts>20)clearInterval(timer)},100)}};
      const loadCloudWriter=()=>{if(document.querySelector('script[src^="cloud-write-sync.js"]'))return;const script=document.createElement('script');script.src='cloud-write-sync.js?v=20260825-2';document.body.appendChild(script)};
      const loadUiPolish=()=>{
        if(!document.querySelector('link[href^="ui-polish.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='ui-polish.css?v=20260825-1';document.head.appendChild(link)}
        if(!document.querySelector('link[href^="sidebar-motion.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='sidebar-motion.css?v=20260826-1';document.head.appendChild(link)}
        if(!document.querySelector('link[href^="minimal-manager.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='minimal-manager.css?v=20260826-1';document.head.appendChild(link)}
        if(!document.querySelector('script[src^="nav-icons.js"]')){const script=document.createElement('script');script.src='nav-icons.js?v=20260825-1';document.body.appendChild(script)}
      };

      const initReservationModules=()=>{
        loadUiPolish();loadCloudWriter();
        ['reservation-flow.css','reservation-enhancements.css'].forEach(href=>{if(!document.querySelector(`link[href^="${href}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=`${href}?v=20260826-5`;document.head.appendChild(link)}});
        const loadLocationSuggestions=()=>{if(document.querySelector('script[src^="reservation-location-suggestions.js"]')){openRequestedReservation();return}const locations=document.createElement('script');locations.src='reservation-location-suggestions.js?v=20260825-4';locations.onload=openRequestedReservation;document.body.appendChild(locations)};
        const loadEnhancements=()=>{if(document.querySelector('script[src^="reservation-enhancements.js"]')){loadLocationSuggestions();return}const enhance=document.createElement('script');enhance.src='reservation-enhancements.js?v=20260826-7';enhance.onload=loadLocationSuggestions;document.body.appendChild(enhance)};
        const releaseCompatibilityRequired=()=>{const form=document.getElementById('reservationForm');['service','date','boarding','amount'].forEach(name=>form?.elements[name]?.removeAttribute('required'))};
        if(!document.querySelector('script[src^="reservation-flow.js"]')){const script=document.createElement('script');script.src='reservation-flow.js?v=20260826-6';script.onload=()=>{releaseCompatibilityRequired();loadEnhancements()};document.body.appendChild(script)}else{releaseCompatibilityRequired();loadEnhancements()}
      };
      if(document.readyState==='complete')initReservationModules();else window.addEventListener('load',initReservationModules,{once:true});
    }
  }catch(error){console.error('Erro ao validar sessão:',error);location.replace(loginUrl)}
})();
