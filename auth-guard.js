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
      const loadManagerRepasses=()=>{if(document.querySelector('script[src^="manager-repasses-section.js"]'))return;const script=document.createElement('script');script.src='manager-repasses-section.js?v=20260825-3';document.body.appendChild(script)};
      const loadManagerServices=()=>{if(document.querySelector('script[src^="manager-services-section.js"]'))return;const script=document.createElement('script');script.src='manager-services-section.js?v=20260825-3';document.body.appendChild(script)};
      const loadCloudWriter=()=>{if(document.querySelector('script[src^="cloud-write-sync.js"]'))return;const script=document.createElement('script');script.src='cloud-write-sync.js?v=20260825-2';document.body.appendChild(script)};
      const loadManagerFinance=()=>{if(!document.querySelector('link[href^="manager-finance-enhancements.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='manager-finance-enhancements.css?v=20260825-1';document.head.appendChild(link)}if(document.querySelector('script[src^="manager-finance-enhancements.js"]'))return;const script=document.createElement('script');script.src='manager-finance-enhancements.js?v=20260825-1';document.body.appendChild(script)};

      const initReservationModules=()=>{
        loadManagerRepasses();loadManagerServices();loadCloudWriter();loadManagerFinance();
        ['reservation-flow.css','reservation-enhancements.css','reservation-service-catalog.css','reservation-roundtrip.css'].forEach(href=>{if(!document.querySelector(`link[href^="${href}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=`${href}?v=20260825-4`;document.head.appendChild(link)}});
        const loadLocationSuggestions=()=>{if(document.querySelector('script[src^="reservation-location-suggestions.js"]')){openRequestedReservation();return}const locations=document.createElement('script');locations.src='reservation-location-suggestions.js?v=20260825-4';locations.onload=openRequestedReservation;document.body.appendChild(locations)};
        const loadRoundTrip=()=>{if(document.querySelector('script[src^="reservation-roundtrip.js"]')){loadLocationSuggestions();return}const rt=document.createElement('script');rt.src='reservation-roundtrip.js?v=20260825-4';rt.onload=loadLocationSuggestions;document.body.appendChild(rt)};
        const loadNetCatalog=()=>{if(document.querySelector('script[src^="reservation-service-catalog.js"]')){loadRoundTrip();return}const net=document.createElement('script');net.src='reservation-service-catalog.js?v=20260825-4';net.onload=loadRoundTrip;document.body.appendChild(net)};
        const loadEnhancements=()=>{if(document.querySelector('script[src^="reservation-enhancements.js"]')){loadNetCatalog();return}const enhance=document.createElement('script');enhance.src='reservation-enhancements.js?v=20260825-4';enhance.onload=loadNetCatalog;document.body.appendChild(enhance)};
        if(!document.querySelector('script[src^="reservation-flow.js"]')){const script=document.createElement('script');script.src='reservation-flow.js?v=20260825-4';script.onload=()=>{const form=document.getElementById('reservationForm');form?.querySelector('[name="service"]')?.removeAttribute('required');form?.querySelector('[name="date"]')?.removeAttribute('required');loadEnhancements()};document.body.appendChild(script)}else{const form=document.getElementById('reservationForm');form?.querySelector('[name="service"]')?.removeAttribute('required');form?.querySelector('[name="date"]')?.removeAttribute('required');loadEnhancements()}
      };
      if(document.readyState==='complete')initReservationModules();else window.addEventListener('load',initReservationModules,{once:true});
    }
  }catch(error){console.error('Erro ao validar sessão:',error);location.replace(loginUrl)}
})();