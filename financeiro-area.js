(async function(){'use strict';
const api=window.jeriSupabase,financeEmail='financeiro@jerirota.com.br';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={estorno:'Estorno',reembolso:'Reembolso',pagamento:'Pagamento',comprovante:'Comprovante',ajuste:'Ajuste financeiro',outros:'Outro pedido'};
const status={recebido:'Solicitação recebida',em_analise:'Em análise',aguardando_cliente:'Aguardando informações',em_processamento:'Em processamento',concluido:'Concluído',indeferido:'Não aprovado'};
let rows=[],selected=null;
function notice(s,bad=false){$('financeNotice').textContent=s;$('financeNotice').classList.toggle('bad',bad)}
function url(row){return location.origin+location.pathname.replace(/[^/]*$/,'')+'protocolo/?token='+encodeURIComponent(row.access_token)}
async function start(){
 if(!api){notice('Não foi possível iniciar o acesso seguro.',true);return}
 const {data:{user},error}=await api.auth.getUser();
 if(error||!user){location.replace('login.html?next=financeiro-area.html');return}
 if((user.email||'').toLowerCase()!==financeEmail){location.replace('index.html');return}
 $('financeEmail').textContent=user.email;
 $('financeLogout').onclick=async()=>{await api.auth.signOut();location.replace('login.html?next=financeiro-area.html')};
 $('financeSearch').oninput=render;
 $('financeList').onclick=e=>{const b=e.target.closest('[data-protocol-id]');if(b)open(b.dataset.protocolId)};
 $('financeSave').onclick=save;
 $('financeCopy').onclick=async()=>{if(!selected)return;try{await navigator.clipboard.writeText(url(selected));notice('Link do cliente copiado.')}catch{window.prompt('Copie o link:',url(selected))}};
 $('financeWhatsapp').onclick=()=>{if(!selected)return;const tel=String(selected.client_phone||'').replace(/\D/g,'');const msg='Olá, '+selected.client_name+'! Sua solicitação financeira está sendo acompanhada pela Jeri Rota. Protocolo: '+selected.protocol+'. Consulte: '+url(selected);window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(msg),'_blank','noopener')};
 await refresh();
}
async function refresh(){
 const {data,error}=await api.from('financial_requests').select('*').order('created_at',{ascending:false}).limit(300);
 if(error){$('financeList').textContent='Não foi possível consultar os pedidos.';notice(error.message,true);return}
 rows=data||[];render();notice(rows.length+' solicitação(ões) encontrada(s).');
}
function render(){
 const search=$('financeSearch').value.trim().toLowerCase();
 const found=rows.filter(r=>[r.client_name,r.protocol,r.reservation_reference].join(' ').toLowerCase().includes(search));
 $('financeList').innerHTML=found.length?found.map(r=>'<button class="item" data-protocol-id="'+esc(r.id)+'" type="button"><span><strong>'+esc(r.protocol)+'</strong><small>'+esc(r.client_name)+' • '+esc(names[r.request_type]||'Solicitação')+'</small></span><em>'+esc(status[r.status]||r.status)+'</em></button>').join(''):'<p>Nenhuma solicitação encontrada.</p>';
}
function open(id){
 selected=rows.find(r=>r.id===id)||null;if(!selected)return;
 $('financeEditor').hidden=false;
 $('financeProtocol').textContent=selected.protocol;
 $('financeClient').textContent=selected.client_name+' • '+(names[selected.request_type]||'Solicitação');
 $('financeStatus').value=selected.status;
 $('financeUpdated').value=new Date(selected.updated_at).toLocaleString('pt-BR');
 $('financePublic').value=selected.public_message||'';
 $('financeInternal').value=selected.internal_description||'';
 $('financeEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function save(){
 if(!selected)return;const b=$('financeSave');b.disabled=true;notice('Salvando...');
 try{
 const {data,error}=await api.rpc('update_financial_request',{p_id:selected.id,p_status:$('financeStatus').value,p_public_message:$('financePublic').value.trim(),p_internal_description:$('financeInternal').value.trim()});
 if(error)throw error;
 rows=rows.map(x=>x.id===data.id?data:x);selected=data;open(data.id);render();notice('Protocolo atualizado com sucesso.');
 }catch(e){notice('Erro ao salvar: '+e.message,true)}finally{b.disabled=false}
}
await start();
})();