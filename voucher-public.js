(async function(){
  'use strict';
  const out=document.getElementById('validationResult');
  const client=window.jeriSupabase;
  const token=new URLSearchParams(location.search).get('token')||location.pathname.split('/').filter(Boolean).at(-1);
  const esc=(v='')=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const translations={
    pt:{tag:'pt-BR',heading:'Validação de voucher',checking:'Validando documento...',invalid:'Link de validação inválido.',missing:'Voucher não encontrado.',cancelled:'VOUCHER CANCELADO',old:'VOUCHER SUBSTITUÍDO — existe uma versão mais recente',valid:'VOUCHER VÁLIDO',voucher:'Voucher',issued:'Emitido em',client:'Cliente',period:'Período'},
    en:{tag:'en-GB',heading:'Voucher validation',checking:'Validating voucher...',invalid:'Invalid validation link.',missing:'Voucher not found.',cancelled:'VOUCHER CANCELLED',old:'VOUCHER REPLACED — a newer version exists',valid:'VALID VOUCHER',voucher:'Voucher',issued:'Issued on',client:'Traveller',period:'Period'},
    fr:{tag:'fr-FR',heading:'Validation du voucher',checking:'Vérification du document...',invalid:'Lien de validation invalide.',missing:'Voucher introuvable.',cancelled:'VOUCHER ANNULÉ',old:'VOUCHER REMPLACÉ — une version plus récente existe',valid:'VOUCHER VALIDE',voucher:'Voucher',issued:'Émis le',client:'Voyageur',period:'Période'},
    es:{tag:'es-ES',heading:'Validación del voucher',checking:'Validando el documento...',invalid:'Enlace de validación no válido.',missing:'Voucher no encontrado.',cancelled:'VOUCHER CANCELADO',old:'VOUCHER SUSTITUIDO — existe una versión más reciente',valid:'VOUCHER VÁLIDO',voucher:'Voucher',issued:'Emitido el',client:'Viajero',period:'Período'}
  };
  const locale=key=>translations[key]||translations.pt;
  const date=(v,t)=>v?new Intl.DateTimeFormat(t.tag,{day:'2-digit',month:'short',year:'numeric'}).format(new Date(String(v).slice(0,10)+'T12:00:00')):'—';
  function setLanguage(key){const lang=locale(key);document.documentElement.lang=lang.tag;document.title=lang.heading+' | Jeri Rota';const heading=document.querySelector('.validation-card header span');if(heading)heading.textContent=lang.heading;return lang;}
  if(!client||!token){const t=setLanguage('pt');out.innerHTML='<p class="validation-status invalid">'+t.invalid+'</p>';return;}
  const {data,error}=await client.rpc('validate_voucher',{p_token:token});
  if(error||!data){const t=setLanguage('pt');out.innerHTML='<p class="validation-status invalid">'+t.missing+'</p>';return;}
  const s=data.snapshot||{},t=setLanguage(s.language);
  const cancelled=data.status==='cancelled',old=!data.is_latest||data.status==='superseded';
  out.innerHTML='<p class="validation-status '+(cancelled?'invalid':old?'old':'valid')+'">'+(cancelled?t.cancelled:old?t.old:t.valid)+'</p>'+
    '<div class="validation-grid">'+
      '<div><span>'+t.voucher+'</span><strong>'+esc(data.voucher_number)+' · V'+esc(data.version)+'</strong></div>'+
      '<div><span>'+t.issued+'</span><strong>'+esc(date(data.issued_at,t))+'</strong></div>'+
      '<div><span>'+t.client+'</span><strong>'+esc(s.client||'—')+'</strong></div>'+
      '<div><span>'+t.period+'</span><strong>'+esc(date(s.period?.start,t))+' – '+esc(date(s.period?.end,t))+'</strong></div>'+
    '</div>';
})();