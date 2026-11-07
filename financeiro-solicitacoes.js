(function(){
'use strict';
const api=window.jeriSupabase;if(!api)return;
const types={estorno:'Estorno',reembolso:'Reembolso',pagamento:'Pagamento',comprovante:'Comprovante',ajuste:'Ajuste financeiro',outros:'Outro pedido'};
const states={recebido:'Solicitação recebida',em_analise:'Em análise',aguardando_cliente:'Aguardando informações',em_processamento:'Em processamento',concluido:'Concluído',indeferido:'Não aprovado'};
const $=id=>document.getElementById(id);
const esc=(x='')=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>d?new Date(d).toLocaleDateString('pt-BR'):'—';
let rows=[],current=null;
function notify(msg,bad){const el=$('finpMsg');if(!el)return;el.textContent=msg;el.className=bad?'finp-msg finp-bad':'finp-msg';}
function link(row){return location.origin+location.pathname.replace(/[^/]*$/,'')+'protocolo/?token='+encodeURIComponent(row.access_token);}
function init(){
if($('protocolos'))return;
const nav=document.querySelector('.main-nav');const main=document.querySelector('.main-content');if(!nav||!main)return;
const btn=document.createElement('button');btn.type='button';btn.className='nav-item';btn.dataset.section='protocolos';btn.innerHTML='<span>▤</span> Protocolos financeiros';const fin=nav.querySelector('[data-section="financeiro"]');if(fin)fin.insertAdjacentElement('afterend',btn);else nav.appendChild(btn);
const sec=document.createElement('section');sec.id='protocolos';sec.className='content-section';
sec.innerHTML='<div class="finp-head"><div><p class="eyebrow">SETOR FINANCEIRO</p><h2>Protocolos de solicitações</h2><p>Cadastre os pedidos financeiros e envie um link individual para o cliente acompanhar a situação.</p></div></div>'+
'<div class="finp-grid"><article class="panel finp-panel"><h3>Novo pedido financeiro</h3><p class="finp-hint">O protocolo é criado pela Jeri Rota. Não altera pagamentos nem executa estornos.</p><form id="finpForm">'+
'<label>Cliente *<input name="client_name" required maxlength="180" placeholder="Nome do solicitante" autocomplete="off"></label>'+
'<label>WhatsApp do cliente<input name="client_phone" maxlength="50" placeholder="Ex.: 5588999999999"></label>'+
'<label>Número da reserva ou referência<input name="reservation_reference" maxlength="100" placeholder="Opcional"></label>'+
'<label>Tipo de solicitação *<select name="request_type" required>'+Object.entries(types).map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>'+
'<label>Descrição interna<textarea name="internal_description" maxlength="2000" rows="3" placeholder="Detalhes para o financeiro; não aparecem para o cliente"></textarea></label>'+
'<button class="primary-button" type="submit" id="finpCreate">Gerar protocolo financeiro</button></form></article>'+
'<article class="panel finp-panel"><h3>Consultar protocolos</h3><label>Buscar pedido<input id="finpSearch" type="search" placeholder="Nome, protocolo ou referência"></label><div id="finpList" class="finp-list"></div></article></div>'+
'<div id="finpEditor" class="panel finp-panel finp-editor" hidden><h3 id="finpEditorTitle">Atualização do protocolo</h3><p id="finpClient" class="finp-hint"></p><div class="finp-columns">'+
'<label>Situação do pedido<select id="finpStatus">'+Object.entries(states).map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>'+
'<label>Última atualização<input id="finpUpdated" disabled></label></div>'+
'<label>Mensagem pública ao cliente<textarea id="finpPublic" maxlength="600" rows="3" placeholder="Ex.: Sua solicitação está em análise pelo setor financeiro."></textarea></label>'+
'<label>Observações internas (não aparecem para o cliente)<textarea id="finpInternal" maxlength="2000" rows="3"></textarea></label>'+
'<div class="finp-actions"><button id="finpSave" class="primary-button" type="button">Salvar atualização</button><button id="finpCopy" class="outline-button" type="button">Copiar link privado</button><button id="finpShare" class="outline-button" type="button">WhatsApp</button></div>'+
'<p class="finp-hint">Só altere para “Concluído” após confirmar a solução do pedido. Um status não comprova transferência ou estorno.</p></div>'+
'<p id="finpMsg" class="finp-msg" role="status" aria-live="polite"></p>';
main.appendChild(sec);
btn.addEventListener('click',()=>{if(typeof setSection==='function')setSection('protocolos');else{document.querySelectorAll('.content-section').forEach(x=>x.classList.toggle('active',x===sec));document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===btn));}if($('pageTitle'))$('pageTitle').textContent='Protocolos financeiros';refresh();});
$('finpForm').addEventListener('submit',create);
$('finpSearch').addEventListener('input',renderList);
$('finpList').addEventListener('click',e=>{const b=e.target.closest('[data-open-protocol]');if(b)open(b.dataset.openProtocol)});
$('finpSave').addEventListener('click',save);
$('finpCopy').addEventListener('click',async()=>{if(!current)return;try{await navigator.clipboard.writeText(link(current));notify('Link privado copiado. Compartilhe somente com o cliente.')}catch{window.prompt('Copie o link privado:',link(current));}});
$('finpShare').addEventListener('click',()=>{if(!current)return;const digits=(current.client_phone||'').replace(/\D/g,'');const msg='Olá, '+current.client_name+'! Sua solicitação financeira foi registrada pela Jeri Rota. Protocolo: '+current.protocol+'. Acompanhe pelo link: '+link(current);window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(msg),'_blank','noopener');});
}
async function refresh(){notify('Carregando solicitações...');const {data,error}=await api.from('financial_requests').select('*').order('created_at',{ascending:false}).limit(300);if(error){notify('Não foi possível consultar os pedidos: '+error.message,true);return;}rows=data||[];renderList();notify('Selecione um protocolo para atualizá-lo ou registre uma nova solicitação.')}
function renderList(){const input=($('finpSearch')?.value||'').trim().toLowerCase();const list=rows.filter(x=>[x.protocol,x.client_name,x.reservation_reference].join(' ').toLowerCase().includes(input));$('finpList').innerHTML=list.length?list.map(x=>'<button class="finp-item" type="button" data-open-protocol="'+esc(x.id)+'"><span><strong>'+esc(x.protocol)+'</strong><small>'+esc(x.client_name)+' · '+esc(types[x.request_type]||x.request_type)+'</small></span><em>'+esc(states[x.status]||x.status)+'</em></button>').join(''):'<p class="finp-hint">Nenhum pedido encontrado.</p>';}
async function create(e){e.preventDefault();const form=$('finpForm');if(!form.reportValidity())return;const b=$('finpCreate');b.disabled=true;notify('Criando protocolo...');const data=Object.fromEntries(new FormData(form));try{const {data:row,error}=await api.rpc('create_financial_request',{p_client_name:data.client_name,p_client_phone:data.client_phone||'',p_reservation_reference:data.reservation_reference||'',p_request_type:data.request_type,p_internal_description:data.internal_description||''});if(error)throw error;rows.unshift(row);form.reset();renderList();open(row.id);notify('Protocolo '+row.protocol+' gerado. Atualize o status e compartilhe o link.');}catch(err){notify('Erro ao criar protocolo: '+err.message,true)}finally{b.disabled=false}}
function open(id){const row=rows.find(x=>x.id===id);if(!row)return;current=row;$('finpEditor').hidden=false;$('finpEditorTitle').textContent='Protocolo '+row.protocol;$('finpClient').textContent=row.client_name+' — '+(types[row.request_type]||row.request_type)+(row.reservation_reference?' · Referência: '+row.reservation_reference:'');$('finpStatus').value=row.status;$('finpUpdated').value=fmt(row.updated_at);$('finpPublic').value=row.public_message||'';$('finpInternal').value=row.internal_description||'';$('finpEditor').scrollIntoView({behavior:'smooth',block:'nearest'});}
async function save(){if(!current)return;const b=$('finpSave');b.disabled=true;notify('Atualizando protocolo...');try{const {data,error}=await api.rpc('update_financial_request',{p_id:current.id,p_status:$('finpStatus').value,p_public_message:$('finpPublic').value.trim(),p_internal_description:$('finpInternal').value.trim()});if(error)throw error;rows=rows.map(x=>x.id===data.id?data:x);open(data.id);renderList();notify('Solicitação atualizada. O cliente verá o status ao abrir o link.');}catch(err){notify('Falha ao atualizar: '+err.message,true)}finally{b.disabled=false}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();