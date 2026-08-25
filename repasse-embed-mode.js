(function(){
  if(new URLSearchParams(location.search).get('embed')!=='1')return;
  document.documentElement.classList.add('repasse-embed-mode');
  const style=document.createElement('style');
  style.textContent=`
    html.repasse-embed-mode,html.repasse-embed-mode body{background:transparent!important}
    html.repasse-embed-mode .app-shell{display:block!important;min-height:auto!important}
    html.repasse-embed-mode .sidebar,html.repasse-embed-mode .topbar{display:none!important}
    html.repasse-embed-mode .main-content{margin:0!important;width:100%!important;max-width:none!important;padding:22px 24px 40px!important;min-height:auto!important}
    html.repasse-embed-mode .repasse-tabs{margin-top:0!important}
    @media(max-width:760px){html.repasse-embed-mode .main-content{padding:14px 12px 28px!important}}
  `;
  document.head.appendChild(style);
})();