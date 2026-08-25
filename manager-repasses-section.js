(function(){
  const nav=[...document.querySelectorAll('.main-nav .nav-item')].find(el=>el.getAttribute('href')==='repasses.html'||/Repasses/i.test(el.textContent||''));
  const main=document.querySelector('.main-content');
  if(!nav||!main)return;

  nav.dataset.section='repasses';
  nav.removeAttribute('href');
  nav.setAttribute('role','button');
  nav.setAttribute('tabindex','0');
  nav.style.cursor='pointer';

  let section=document.getElementById('repasses');
  if(!section){
    section=document.createElement('section');
    section.className='content-section manager-repasses-section';
    section.id='repasses';
    section.innerHTML=`<div class="manager-embed-frame-wrap"><iframe id="managerRepassesFrame" title="Central de repasses" src="repasses.html?embed=1" loading="eager"></iframe></div>`;
    main.appendChild(section);
  }

  if(!document.getElementById('managerRepassesSectionStyle')){
    const style=document.createElement('style');
    style.id='managerRepassesSectionStyle';
    style.textContent=`
      .manager-repasses-section{padding:0!important;margin:0!important}
      .manager-embed-frame-wrap{width:100%;min-height:calc(100vh - 110px);border-radius:18px;overflow:hidden;background:transparent}
      #managerRepassesFrame{display:block;width:100%;min-height:calc(100vh - 110px);height:calc(100vh - 110px);border:0;background:transparent}
      @media(max-width:760px){#managerRepassesFrame,.manager-embed-frame-wrap{min-height:calc(100vh - 88px);height:calc(100vh - 88px)}}
    `;
    document.head.appendChild(style);
  }

  function openRepasses(event){
    event?.preventDefault?.();
    if(typeof setSection==='function')setSection('repasses');
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el===nav));
    const title=document.getElementById('pageTitle');if(title)title.textContent='Central de repasses';
    const button=document.getElementById('newReservationButton');if(button)button.style.display='none';
    document.getElementById('sidebar')?.classList.remove('open');
  }

  nav.addEventListener('click',openRepasses,true);
  nav.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openRepasses(e)}});

  document.querySelectorAll('.nav-item[data-section]:not([data-section="repasses"])').forEach(el=>el.addEventListener('click',()=>{
    const button=document.getElementById('newReservationButton');if(button)button.style.display='';
  }));
})();