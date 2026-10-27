(function(){
  'use strict';
  const client=window.jeriSupabase;
  const root=document.querySelector('.main-content');
  const nav=document.querySelector('.main-nav');
  if(!root||!nav||!client)return;
  const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>n==null?'—':fmt.format(Number(n));
  const num=value=>value===''||value==null?null:Number(value);
  const $=id=>document.getElementById(id);
  let partners=[],rates=[],editingPartner=null,ratePartner=null,editingRate=null,visible=[];

  const navBtn=document.createElement('button');
  navBtn.type='button';navBtn.className='nav-item';navBtn.dataset.section='hospedagens';
  navBtn.innerHTML='<span aria-hidden="true">▤</span> Hospedagens';
  nav.insertBefore(navBtn,nav.querySelector('[data-section="financeiro"]'));

  const section=document.createElement('section');
  section.id='hospedagens';section.className='content-section';
  section.innerHTML=`
  <div class="hp-header"><div><p class="eyebrow">FORNECEDORES E TARIFAS PRIVADAS</p><h2>Hospedagens parceiras</h2><p>Cadastre pousadas, negocie NET e consulte tarifários por período sem depender de plataformas de reserva.</p></div><div class="hp-top-actions"><button type="button" class="outline-button" id="hpExport">Exportar CSV</button><button type="button" class="primary-button" id="hpNew">+ Nova pousada</button></div></div>
  <div class="hp-stats"><div><span>Hospedagens cadastradas</span><strong id="hpTotal">0</strong></div><div><span>Parcerias ativas</span><strong id="hpActive">0</strong></div><div><span>Tarifas registradas</span><strong id="hpRatesTotal">0</strong></div></div>
  <div class="hp-filterbar">
    <label>Buscar pousada ou cidade<input type="search" id="hpSearch" placeholder="Nome, cidade ou bairro"></label>
    <label>Etapa da parceria<select id="hpStatus"><option value="">Todas</option><option value="contato">Primeiro contato</option><option value="negociacao">Em negociação</option><option value="ativo">Parceria ativa</option><option value="inativo">Pausada</option></select></label>
    <label>Check-in<input type="date" id="hpIn"></label><label>Check-out<input type="date" id="hpOut"></label>
    <button type="button" class="outline-button hp-maysa" id="hpMaysa">Consulta 19–23/11</button>
  </div>
  <p class="hp-explanation" id="hpFilterNote">As tarifas são condições comerciais. Disponibilidade e valor final precisam ser reconfirmados com a hospedagem antes da venda.</p>
  <article class="panel hp-list-panel"><div class="table-wrap"><table class="hp-table"><thead><tr><th>Hospedagem</th><th>Negociação</th><th>Contato</th><th>NET / Tarifas</th><th>Ações</th></tr></thead><tbody id="hpRows"></tbody></table></div></article>
  <div id="hpEditor" class="hp-overlay" hidden><div class="hp-dialog" role="dialog" aria-modal="true" aria-labelledby="hpEditorTitle"><div class="hp-dialog-head"><h3 id="hpEditorTitle">Nova pousada</h3><button class="hp-close" type="button" data-hp-close="hpEditor" aria-label="Fechar">×</button></div>
  <form id="hpForm"><div class="hp-formgrid">
    <label class="hp-wide">Nome da hospedagem *<input name="name" required maxlength="180"></label>
    <label>Cidade *<input name="city" required value="Jericoacoara" maxlength="120"></label>
    <label>Bairro / localização<input name="neighborhood" maxlength="160"></label>
    <label>Perfil / categoria<input name="category" placeholder="Charmosa, econômica, boutique..." maxlength="100"></label>
    <label>Status<select name="status"><option value="contato">Primeiro contato</option><option value="negociacao">Em negociação</option><option value="ativo">Parceria ativa</option><option value="inativo">Pausada</option></select></label>
    <label>Contato comercial<input name="contact_name" maxlength="160"></label>
    <label>WhatsApp<input name="whatsapp" placeholder="55 88 99999-9999"></label>
    <label>Telefone<input name="phone"></label>
    <label>E-mail<input name="email" type="email"></label>
    <label>Site<input name="website" type="url" placeholder="https://"></label>
    <label>Comissão padrão (%)<input name="standard_commission_pct" min="0" max="100" step="0.01" type="number"></label>
    <label>Ativa no catálogo?<select name="is_active"><option value="true">Sim</option><option value="false">Arquivada</option></select></label>
    <label class="hp-wide">Condições de pagamento<textarea name="payment_terms" rows="2"></textarea></label>
    <label class="hp-wide">Cancelamentos e alterações<textarea name="cancellation_terms" rows="2"></textarea></label>
    <label class="hp-wide">Cortesias / diferenciais<textarea name="benefits" rows="2"></textarea></label>
    <label class="hp-wide">Observações internas<textarea name="internal_notes" rows="3" placeholder="Histórico da conversa, responsável, próximos passos..."></textarea></label>
  </div><div class="hp-actions"><button type="button" class="outline-button" data-hp-close="hpEditor">Cancelar</button><button class="primary-button" type="submit" id="hpSavePartner">Salvar hospedagem</button></div></form></div></div>
  <div id="hpRatesEditor" class="hp-overlay" hidden><div class="hp-dialog hp-rate-dialog" role="dialog" aria-modal="true" aria-labelledby="hpRatesTitle"><div class="hp-dialog-head"><div><h3 id="hpRatesTitle">Tarifário</h3><p>Cadastre cada quarto e período de vigência. O último dia válido refere-se à noite da hospedagem, não ao checkout.</p></div><button class="hp-close" type="button" data-hp-close="hpRatesEditor" aria-label="Fechar">×</button></div>
  <form id="hpRateForm"><div class="hp-formgrid">
    <label>Tipo de quarto *<input name="room_name" required maxlength="150" placeholder="Standard, Superior..."></label>
    <label>Modelo comercial<select name="rate_type"><option value="net">Tarifa NET</option><option value="commission">Comissionada</option></select></label>
    <label>Primeira noite válida *<input name="valid_from" type="date" required></label><label>Última noite válida *<input name="valid_to" type="date" required></label>
    <label>NET por noite (R$)<input name="net_amount" type="number" step="0.01" min="0" placeholder="Custo para agência"></label>
    <label>Venda ao cliente por noite (R$)<input name="sale_amount" type="number" step="0.01" min="0" placeholder="Valor negociado de venda"></label>
    <label>Comissão da tarifa (%)<input name="commission_pct" type="number" min="0" max="100" step="0.01"></label>
    <label>Mínimo de noites<input name="min_nights" type="number" min="1" step="1" value="1"></label>
    <label>Café / regime alimentar<input name="meal_plan" placeholder="Café da manhã incluso"></label>
    <label>Origem da tarifa<input name="source" placeholder="WhatsApp comercial, tabela 2026..."></label>
    <label>Última reconfirmação<input name="last_confirmed_on" type="date"></label>
    <label class="hp-wide">Observações / feriados / restrições<textarea name="notes" rows="2"></textarea></label>
  </div><p class="hp-explanation">O NET é o custo para a agência. A venda é o preço ao cliente. O sistema não publica esses valores e não faz reservas automaticamente.</p>
  <div class="hp-actions"><button type="button" class="outline-button" id="hpCancelRate" hidden>Cancelar edição</button><button class="primary-button" type="submit" id="hpSaveRate">Salvar tarifa</button></div></form>
  <h4>Tarifas registradas</h4><div class="table-wrap"><table class="hp-table"><thead><tr><th>Quarto / vigência</th><th>Regime</th><th>NET</th><th>Venda / Comissão</th><th>Ações</th></tr></thead><tbody id="hpRatesRows"></tbody></table></div>
  </div></div>
  <p id="hpNotice" class="hp-toast" role="status" aria-live="polite" hidden></p>`;
  root.insertBefore(section,$('vouchers'));

  const statuses={contato:'Primeiro contato',negociacao:'Em negociação',ativo:'Parceria ativa',inativo:'Pausada'};
  const formatDate=iso=>iso?String(iso).split('-').reverse().join('/'):'—';
  const dateUtc=iso=>Date.parse(iso+'T00:00:00Z');
  const nightlyCount=()=>{const a=$('hpIn').value,b=$('hpOut').value;if(!a||!b)return null;const diff=(dateUtc(b)-dateUtc(a))/86400000;return Number.isInteger(diff)&&diff>0&&diff<=90?diff:null};
  const nightBeforeCheckout=()=>new Date(dateUtc($('hpOut').value)-86400000).toISOString().slice(0,10);
  const message=(value,fail=false)=>{const el=$('hpNotice');el.textContent=value;el.classList.toggle('hp-error',fail);el.hidden=false;setTimeout(()=>{el.hidden=true},4500)};
  const formData=form=>Object.fromEntries(new FormData(form).entries());
  const setForm=(form,item)=>{for(const [k,v] of Object.entries(item))if(form.elements.namedItem(k))form.elements.namedItem(k).value=v??''};
  const close=id=>{$(id).hidden=true;document.body.classList.remove('hp-modal-open')};
  const open=id=>{$(id).hidden=false;document.body.classList.add('hp-modal-open')};
  const percent=v=>v==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
  function whatsappUrl(value){let digits=String(value||'').replace(/\D/g,'');if(digits.length===10||digits.length===11)digits='55'+digits;return /^55\d{10,11}$/.test(digits)?'https://wa.me/'+digits:''}
  const link=(url,label)=>url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(label)+'</a>':'';
  const suitable=(rate,nights,last)=>rate.valid_from<=$('hpIn').value&&rate.valid_to>=last&&Number(rate.min_nights||1)<=nights;
  function rateSummary(p){
    const own=rates.filter(r=>r.partner_id===p.id);
    const nights=nightlyCount();
    if($('hpIn').value||$('hpOut').value){
      if(!nights)return '<small>Informe um período válido</small>';
      const last=nightBeforeCheckout();
      const found=own.filter(r=>suitable(r,nights,last)).sort((a,b)=>(b.last_confirmed_on||b.updated_at||'').localeCompare(a.last_confirmed_on||a.updated_at||''));
      if(!found.length)return '<small>Sem tarifa cobrindo todo o período</small>';
      const r=found[0];
      const daily=r.rate_type==='net'?r.net_amount:r.sale_amount;
      const caption=r.rate_type==='net'?'NET estimado':'Venda estimada';
      return '<strong>'+esc(money(Number(daily)*nights))+'</strong><small>'+esc(caption)+' · '+esc(r.room_name)+' · '+nights+' noites</small><small>Disponibilidade a confirmar</small>';
    }
    if(!own.length)return '<small>Sem tarifa cadastrada</small>';
    const latest=own.slice().sort((a,b)=>String(b.valid_to).localeCompare(String(a.valid_to)))[0];
    return '<strong>'+own.length+' tarifa(s)</strong><small>'+esc(latest.room_name)+' · NET '+esc(money(latest.net_amount))+'</small>';
  }
  function render(){
    $('hpTotal').textContent=partners.length;
    $('hpActive').textContent=partners.filter(p=>p.status==='ativo'&&p.is_active).length;
    $('hpRatesTotal').textContent=rates.length;
    const q=$('hpSearch').value.trim().toLocaleLowerCase('pt-BR');
    const s=$('hpStatus').value;
    visible=partners.filter(p=>(!s||p.status===s)&&(!q||[p.name,p.city,p.neighborhood,p.category].join(' ').toLocaleLowerCase('pt-BR').includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    $('hpRows').innerHTML=visible.map(p=>{
      const w=whatsappUrl(p.whatsapp||p.phone);
      const mail=p.email?'mailto:'+p.email:'';
      const contact=[p.contact_name,link(w,'WhatsApp'),link(mail,'E-mail')].filter(Boolean).join(' · ');
      return '<tr><td><strong>'+esc(p.name)+'</strong><small>'+esc([p.city,p.neighborhood,p.category].filter(Boolean).join(' · '))+'</small></td>'
        +'<td><span class="hp-status '+(p.is_active?'':'hp-muted')+'">'+esc(p.is_active?statuses[p.status]:'Arquivada')+'</span><small>Comissão padrão: '+esc(percent(p.standard_commission_pct))+'</small></td>'
        +'<td class="hp-contact">'+(contact||'—')+'</td><td>'+rateSummary(p)+'</td>'
        +'<td><div class="hp-rowbuttons"><button type="button" data-hp-edit="'+p.id+'">Editar</button><button type="button" data-hp-rates="'+p.id+'">Tarifas</button></div></td></tr>';
    }).join('')||'<tr><td colspan="5" class="hp-empty">Nenhuma pousada cadastrada. Clique em “Nova pousada” para iniciar sua rede de fornecedores.</td></tr>';
    const nights=nightlyCount();
    $('hpFilterNote').textContent=nights
      ?'Consulta de '+formatDate($('hpIn').value)+' a '+formatDate($('hpOut').value)+' ('+nights+' noites): valores indicativos da tarifa que cobre todo o período. Não são confirmação de vaga.'
      :'Tarifas e valores NET são informações internas. Reconfirme disponibilidade e condições antes de apresentar qualquer oferta.';
  }
  async function load(){
    const userResult=await client.auth.getUser();
    if(!userResult.data?.user){message('Faça login para consultar o catálogo.',true);return}
    const [p,r]=await Promise.all([
      client.from('hotel_partners').select('*').order('name'),
      client.from('hotel_partner_rates').select('*').order('valid_from',{ascending:false})
    ]);
    if(p.error||r.error){console.error('Hospedagens:',p.error||r.error);message('Não foi possível carregar o catálogo. Verifique se a estrutura do banco foi ativada.',true);return}
    partners=p.data||[];rates=r.data||[];render();
  }
  function openPartner(item=null){
    editingPartner=item?.id||null;
    $('hpForm').reset();
    $('hpForm').elements.city.value='Jericoacoara';
    $('hpEditorTitle').textContent=item?'Editar hospedagem':'Nova pousada';
    if(item)setForm($('hpForm'),item);
    open('hpEditor');
    $('hpForm').elements.name.focus();
  }
  async function savePartner(event){
    event.preventDefault();
    const form=$('hpForm'),v=formData(form),btn=$('hpSavePartner');
    const user=await client.auth.getUser();
    if(!user.data?.user){message('Sessão expirada. Faça login novamente.',true);return}
    const row={
      name:v.name.trim(),city:v.city.trim(),neighborhood:v.neighborhood.trim()||null,category:v.category.trim()||null,
      contact_name:v.contact_name.trim()||null,whatsapp:v.whatsapp.trim()||null,phone:v.phone.trim()||null,email:v.email.trim()||null,website:v.website.trim()||null,
      status:v.status,standard_commission_pct:num(v.standard_commission_pct),payment_terms:v.payment_terms.trim()||null,cancellation_terms:v.cancellation_terms.trim()||null,
      benefits:v.benefits.trim()||null,internal_notes:v.internal_notes.trim()||null,is_active:v.is_active==='true',updated_at:new Date().toISOString()
    };
    if(!row.name||!row.city){message('Informe nome e cidade.',true);return}
    btn.disabled=true;
    let req=editingPartner?client.from('hotel_partners').update(row).eq('id',editingPartner):client.from('hotel_partners').insert({...row,owner_id:user.data.user.id});
    const {error}=await req;
    btn.disabled=false;
    if(error){console.error(error);message('Não foi possível salvar a hospedagem.',true);return}
    close('hpEditor');editingPartner=null;await load();message('Hospedagem salva no catálogo.');
  }
  function resetRate(){
    editingRate=null;$('hpRateForm').reset();$('hpCancelRate').hidden=true;$('hpSaveRate').textContent='Salvar tarifa';
    $('hpRateForm').elements.min_nights.value=1;
  }
  function openRates(partner){
    ratePartner=partner.id;resetRate();
    $('hpRatesTitle').textContent='Tarifário · '+partner.name;
    renderRates();open('hpRatesEditor');
  }
  function renderRates(){
    const own=rates.filter(r=>r.partner_id===ratePartner).sort((a,b)=>String(b.valid_from).localeCompare(String(a.valid_from)));
    $('hpRatesRows').innerHTML=own.map(r=>'<tr>'
      +'<td><strong>'+esc(r.room_name)+'</strong><small>'+formatDate(r.valid_from)+' a '+formatDate(r.valid_to)+' · Mín. '+esc(r.min_nights||1)+' noite(s)</small></td>'
      +'<td>'+esc(r.rate_type==='net'?'NET':'Comissionada')+'<small>'+esc(r.meal_plan||'Não informado')+'</small></td>'
      +'<td>'+esc(money(r.net_amount))+'</td><td>'+esc(money(r.sale_amount))+'<small>'+esc(percent(r.commission_pct))+' de comissão</small></td>'
      +'<td><div class="hp-rowbuttons"><button type="button" data-hp-rate-edit="'+r.id+'">Editar</button><button type="button" data-hp-rate-del="'+r.id+'">Excluir</button></div></td></tr>').join('')
      ||'<tr><td colspan="5" class="hp-empty">Ainda não há tabelas NET ou comissionadas cadastradas.</td></tr>';
  }
  function editRate(item){
    editingRate=item.id;$('hpRateForm').reset();setForm($('hpRateForm'),item);
    $('hpCancelRate').hidden=false;$('hpSaveRate').textContent='Salvar alterações';
    $('hpRateForm').elements.room_name.focus();
  }
  async function saveRate(event){
    event.preventDefault();
    const v=formData($('hpRateForm')),btn=$('hpSaveRate');
    const row={
      partner_id:ratePartner,room_name:v.room_name.trim(),rate_type:v.rate_type,
      valid_from:v.valid_from,valid_to:v.valid_to,net_amount:num(v.net_amount),sale_amount:num(v.sale_amount),
      commission_pct:num(v.commission_pct),min_nights:Number(v.min_nights)||1,meal_plan:v.meal_plan.trim()||null,
      source:v.source.trim()||null,last_confirmed_on:v.last_confirmed_on||null,notes:v.notes.trim()||null,updated_at:new Date().toISOString()
    };
    if(!row.room_name||!row.valid_from||!row.valid_to||row.valid_to<row.valid_from){message('Revise o quarto e as datas da tarifa.',true);return}
    if(row.rate_type==='net'&&row.net_amount===null){message('Informe o NET por noite.',true);return}
    if(row.rate_type==='commission'&&row.sale_amount===null){message('Informe o valor de venda por noite.',true);return}
    btn.disabled=true;
    const req=editingRate?client.from('hotel_partner_rates').update(row).eq('id',editingRate):client.from('hotel_partner_rates').insert(row);
    const {error}=await req;btn.disabled=false;
    if(error){console.error(error);message('Não foi possível salvar a tarifa. Verifique os campos.',true);return}
    await load();renderRates();resetRate();message('Tarifa registrada. A disponibilidade continua sujeita à confirmação.');
  }
  async function removeRate(id){
    if(!confirm('Excluir esta tarifa? A exclusão não pode ser desfeita.'))return;
    const {error}=await client.from('hotel_partner_rates').delete().eq('id',id);
    if(error){console.error(error);message('Não foi possível excluir esta tarifa.',true);return}
    await load();renderRates();message('Tarifa excluída.');
  }
  function exportCsv(){
    const header=['Pousada','Cidade','Status','WhatsApp','Email','Quarto','Tipo','De','Até','NET por noite','Venda por noite','Comissão %','Condições','Observações'];
    const rows=visible.flatMap(p=>{
      const selected=rates.filter(r=>r.partner_id===p.id);
      return (selected.length?selected:[{}]).map(r=>[p.name,p.city,statuses[p.status],p.whatsapp,p.email,r.room_name,r.rate_type,r.valid_from,r.valid_to,r.net_amount,r.sale_amount,r.commission_pct,p.payment_terms,[p.internal_notes,r.notes].filter(Boolean).join(' | ')]);
    });
    // Impede que dados escritos por fornecedores sejam executados como fórmulas no Excel.
    const safe=v=>{let s=String(v??'');if(/^[\s]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
    const csv='\uFEFF'+[header,...rows].map(row=>row.map(safe).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='jeri-rota-hospedagens-parceiras.csv';
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  navBtn.addEventListener('click',()=>{if(typeof window.setSection==='function')window.setSection('hospedagens');$('pageTitle').textContent='Hospedagens parceiras';load()});
  $('hpNew').addEventListener('click',()=>openPartner());
  $('hpForm').addEventListener('submit',savePartner);
  $('hpRateForm').addEventListener('submit',saveRate);
  $('hpCancelRate').addEventListener('click',resetRate);
  $('hpExport').addEventListener('click',exportCsv);
  $('hpSearch').addEventListener('input',render);$('hpStatus').addEventListener('change',render);
  $('hpIn').addEventListener('change',render);$('hpOut').addEventListener('change',render);
  $('hpMaysa').addEventListener('click',()=>{$('hpIn').value='2026-11-19';$('hpOut').value='2026-11-23';render()});
  section.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.hpClose)close(target.dataset.hpClose);
    if(target.dataset.hpEdit){const p=partners.find(x=>x.id===target.dataset.hpEdit);if(p)openPartner(p)}
    if(target.dataset.hpRates){const p=partners.find(x=>x.id===target.dataset.hpRates);if(p)openRates(p)}
    if(target.dataset.hpRateEdit){const r=rates.find(x=>x.id===target.dataset.hpRateEdit);if(r)editRate(r)}
    if(target.dataset.hpRateDel)removeRate(target.dataset.hpRateDel);
  });
  $('hpEditor').addEventListener('click',e=>{if(e.target===$('hpEditor'))close('hpEditor')});
  $('hpRatesEditor').addEventListener('click',e=>{if(e.target===$('hpRatesEditor'))close('hpRatesEditor')});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('hpEditor').hidden)close('hpEditor');if(!$('hpRatesEditor').hidden)close('hpRatesEditor')}});
  window.JeriHotelPartners=Object.freeze({reload:load});
})();
