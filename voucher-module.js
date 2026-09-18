(function(){
  'use strict';
  const client=window.jeriSupabase;
  if(!client)return;
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtDate=v=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(String(v).length===10?`${v}T12:00:00`:v)):'A definir';
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  let vouchers=[];
  function ensureVoucherNav(){
    const navRoot=document.querySelector('.main-nav');if(!navRoot)return;
    let item=[...navRoot.querySelectorAll('.nav-item')].find(x=>x.dataset.section==='vouchers');
    if(!item){item=document.createElement('button');item.type='button';item.className='nav-item';item.dataset.section='vouchers';item.innerHTML='<span>◇</span> Vouchers';item.addEventListener('click',()=>setSection('vouchers'))}
    const services=[...navRoot.querySelectorAll('.nav-item')].find(x=>x.dataset.section==='servicos');
    if(services){if(services.nextSibling!==item)navRoot.insertBefore(item,services.nextSibling)}else if(!item.isConnected){navRoot.appendChild(item)}
  }
  ensureVoucherNav();
  const voucherNavObserver=new MutationObserver(()=>ensureVoucherNav());
  const voucherNavRoot=document.querySelector('.main-nav');if(voucherNavRoot)voucherNavObserver.observe(voucherNavRoot,{childList:true});
  const reservationsList=()=>{try{return reservations}catch{return JSON.parse(localStorage.getItem('jeri-rota-manager-reservas-v1')||'[]')}};
  const servicesList=()=>JSON.parse(localStorage.getItem('jeri-rota-manager-reservation-services-v1')||'[]');

  function paymentLabel(r){const total=Number(r.amount)||0,paid=Number(r.paidAmount)||0;if(paid<=0)return'Aguardando sinal';if(paid>=total)return'Pago';return`Sinal recebido (${money(paid)})`}
  function snapshot(r,notes){
    const services=servicesList().filter(s=>String(s.reservationId)===String(r.id)).map(s=>({title:s.title||s.service||s.tour||r.service,date:s.date||r.date,return_date:s.returnDate||null,route:s.route||'',boarding:s.boarding||'',dropoff:s.dropoff||'',responsible:s.responsible||''}));
    return{reservation_code:r.reservationCode||String(r.id),client:r.client,phone:r.phone||'',email:r.email||'',period:{start:r.date,end:services.map(s=>s.return_date||s.date).filter(Boolean).sort().at(-1)||r.date},people:Number(r.people)||1,passengers:String(r.client||'').split(/\s*[/,;]\s*/).filter(Boolean),services:services.length?services:[{title:r.service,date:r.date,boarding:r.boarding||'',responsible:r.responsible||''}],boarding:r.boarding||services[0]?.boarding||'A definir',lodging:r.lodging||'',customer_notes:notes||'',payment_status:paymentLabel(r),amount:Number(r.amount)||0};
  }
  function sameSnapshot(a,b){const clean=x=>JSON.stringify(x||{});return clean(a)===clean(b)}
  function snapshotChanges(current,previous){const labels={client:'Cliente',period:'Período',people:'Quantidade de passageiros',passengers:'Nomes dos passageiros',services:'Serviços',boarding:'Embarque',lodging:'Hospedagem',payment_status:'Pagamento',amount:'Valor'};return Object.keys(labels).filter(key=>JSON.stringify(current?.[key])!==JSON.stringify(previous?.[key])).map(key=>labels[key])}
  function publicUrl(v){return`${location.origin}${location.pathname.replace(/[^/]*$/,'')}v/${encodeURIComponent(v.validation_token)}`}

  function ensureDialog(){if(document.getElementById('voucherModal'))return;document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="voucherModal" aria-hidden="true"><div class="modal voucher-dialog" role="dialog" aria-modal="true" aria-labelledby="voucherModalTitle"><button class="close-button" data-voucher-close aria-label="Fechar">×</button><p class="eyebrow">DOCUMENTO DO CLIENTE</p><h2 id="voucherModalTitle">Pré-visualizar voucher</h2><div id="voucherModalBody"></div></div></div>`);document.querySelector('[data-voucher-close]').onclick=closeDialog}
  function closeDialog(){const m=document.getElementById('voucherModal');m?.classList.remove('open');m?.setAttribute('aria-hidden','true')}
  function openDialog(){ensureDialog();const m=document.getElementById('voucherModal');m.classList.add('open');m.setAttribute('aria-hidden','false')}
  function detail(label,value,full=false){return`<div class="voucher-detail${full?' full':''}"><span>${esc(label)}</span><strong>${esc(value||'A definir')}</strong></div>`}

  async function previewReservation(id){
    const r=reservationsList().find(x=>String(x.id)===String(id));if(!r)return alert('Reserva não encontrada.');if(!r.cloudId)return alert('Aguarde a sincronização da reserva com o Supabase antes de emitir o voucher.');
    const current=vouchers.find(v=>v.reservation_id===r.cloudId&&v.status==='issued');const base=snapshot(r,current?.snapshot_data?.customer_notes||'');
    openDialog();document.getElementById('voucherModalTitle').textContent=current?'Reemitir voucher':'Pré-visualizar voucher';
    const changes=current?snapshotChanges(base,current.snapshot_data):[];
    document.getElementById('voucherModalBody').innerHTML=`<div class="voucher-preview-head"><img src="jeri-rota-mark.svg" alt=""><div><strong>Jeri Rota</strong><small>${current?`${esc(current.voucher_number)} · versão ${current.version}`:'Número oficial gerado somente na emissão'}</small></div></div>${changes.length?`<p class="voucher-change-warning">A reserva mudou desde a última emissão: ${esc(changes.join(', '))}. A confirmação criará uma nova versão.</p>`:''}<div class="voucher-grid">${detail('Cliente',base.client)}${detail('Período',`${fmtDate(base.period.start)} a ${fmtDate(base.period.end)}`)}${detail('Passageiros',`${base.people} · ${base.passengers.join(', ')}`)}${detail('Pagamento',base.payment_status)}${detail('Serviços',base.services.map(s=>`${s.title} — ${fmtDate(s.date)}`).join(' | '),true)}${detail('Embarque',base.boarding,true)}</div><label class="voucher-field">Observações para o cliente<textarea id="voucherCustomerNotes">${esc(base.customer_notes)}</textarea></label><label class="voucher-check"><input id="voucherShowValue" type="checkbox" ${current?.show_value?'checked':''}> Exibir valor no voucher</label><div class="voucher-dialog-actions"><button class="outline-button" data-voucher-close-action>Voltar</button><button class="primary-button" id="issueVoucherButton">${current?'Reemitir Voucher':'Emitir Voucher'}</button></div>`;
    document.querySelector('[data-voucher-close-action]').onclick=closeDialog;document.getElementById('issueVoucherButton').onclick=()=>issue(r);
  }
  async function issue(r){
    if(r.status!=='Confirmada')return alert('Confirme a reserva antes de emitir o voucher.');
    const body=document.getElementById('voucherModalBody');body.classList.add('voucher-loading');
    const data=snapshot(r,document.getElementById('voucherCustomerNotes').value.trim());const show=document.getElementById('voucherShowValue').checked;
    const {data:issued,error}=await client.rpc('issue_voucher',{p_reservation_id:r.cloudId,p_snapshot:data,p_show_value:show});
    if(error){body.classList.remove('voucher-loading');alert(`Não foi possível emitir: ${error.message}`);return}
    await loadVouchers();closeDialog();await makePdf(issued,true);setSection('vouchers');
  }
  async function qrData(url){if(!window.QRCode)return null;return QRCode.toDataURL(url,{width:240,margin:1,color:{dark:'#08263e',light:'#ffffff'}})}
  let voucherLogoPromise;
  async function logoDataUrl(){
    if(voucherLogoPromise)return voucherLogoPromise;
    voucherLogoPromise=(async()=>{try{const response=await fetch('jeri-rota-mark.svg');if(!response.ok)return null;const svg=await response.text();const blob=new Blob([svg],{type:'image/svg+xml'});const url=URL.createObjectURL(blob);try{return await new Promise(resolve=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=648;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,512,648);resolve(canvas.toDataURL('image/png'))};img.onerror=()=>resolve(null);img.src=url})}finally{URL.revokeObjectURL(url)}}catch(error){console.warn('Logo indisponível para o PDF:',error);return null}})();
    return voucherLogoPromise;
  }
  async function makePdf(v,upload=false){
    const {jsPDF}=window.jspdf||{};if(!jsPDF)return alert('Gerador de PDF indisponível. Atualize a página.');const s=v.snapshot_data||{};const doc=new jsPDF({unit:'mm',format:'a4'}),navy=[8,38,62],gold=[217,163,60];
    doc.setFillColor(...navy);doc.rect(0,0,210,38,'F');const logo=await logoDataUrl();if(logo)doc.addImage(logo,'PNG',18,6,16,20);doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('JERI ROTA',logo?40:18,18);doc.setTextColor(...gold);doc.setFontSize(10);doc.text('VOUCHER OFICIAL',logo?40:18,26);doc.setTextColor(20,32,42);doc.setFontSize(15);doc.text(`${v.voucher_number}  |  V${v.version}`,18,52);
    let y=64;const line=(label,value)=>{doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...navy);doc.text(label.toUpperCase(),18,y);doc.setFont('helvetica','normal');doc.setTextColor(45,55,62);const lines=doc.splitTextToSize(String(value||'A definir'),165);doc.text(lines,18,y+6);y+=11+(lines.length-1)*5};line('Cliente',s.client);line('Período',`${fmtDate(s.period?.start)} a ${fmtDate(s.period?.end)}`);line('Passageiros',`${s.people||1} · ${(s.passengers||[]).join(', ')}`);line('Serviços',(s.services||[]).map(x=>`${x.title} — ${fmtDate(x.date)}${x.route?` — ${x.route}`:''}`).join('\n'));line('Embarque',s.boarding);line('Pagamento',s.payment_status);if(v.show_value)line('Valor',money(s.amount));if(s.customer_notes)line('Observações',s.customer_notes);
    const url=publicUrl(v),qr=await qrData(url);if(qr){doc.addImage(qr,'PNG',18,230,36,36);doc.setFontSize(8);doc.setTextColor(80,90,96);doc.text('Escaneie para validar',18,271)}doc.setFontSize(8);doc.text(url,60,248,{maxWidth:125});doc.setDrawColor(...gold);doc.line(18,282,192,282);doc.text(`Emitido em ${fmtDate(v.issued_at)} · Documento verificável por QR Code`,18,289);
    const blob=doc.output('blob'),filename=`${v.voucher_number}-V${v.version}.pdf`;
    if(upload){const path=`${v.voucher_number.slice(3,7)}/${v.voucher_number}/v${v.version}.pdf`;const up=await client.storage.from('vouchers').upload(path,blob,{contentType:'application/pdf',upsert:true});if(!up.error){await client.from('vouchers').update({pdf_path:path}).eq('id',v.id);v.pdf_path=path}else console.error('Falha ao armazenar PDF:',up.error)}
    doc.save(filename);
  }
  async function downloadStored(v){if(!v.pdf_path)return makePdf(v);const {data,error}=await client.storage.from('vouchers').createSignedUrl(v.pdf_path,300);if(error)return makePdf(v);window.open(data.signedUrl,'_blank','noopener')}
  async function cancel(v){const reason=prompt(`Motivo do cancelamento de ${v.voucher_number}:`);if(reason===null)return;if(reason.trim().length<3)return alert('Informe um motivo com pelo menos 3 caracteres.');const {error}=await client.rpc('cancel_voucher',{p_voucher_id:v.id,p_reason:reason.trim()});if(error)return alert(error.message);await loadVouchers()}
  function share(v){const s=v.snapshot_data||{},text=`Olá, ${s.client||''}! Segue o voucher ${v.voucher_number}, período de ${fmtDate(s.period?.start)} a ${fmtDate(s.period?.end)}: ${publicUrl(v)}`;window.open(`https://wa.me/${String(s.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`,'_blank','noopener')}
  function email(v){const s=v.snapshot_data||{},subject=`Voucher ${v.voucher_number} - Jeri Rota`,body=`Olá, ${s.client||''}!\n\nSua reserva com a Jeri Rota está confirmada. Consulte seu voucher oficial: ${publicUrl(v)}\n\nAtenciosamente,\nEquipe Jeri Rota`;location.href=`mailto:${encodeURIComponent(s.email||'')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
  function render(){const host=document.getElementById('voucherTable');if(!host)return;const q=(document.getElementById('voucherSearch')?.value||'').toLowerCase(),status=document.getElementById('voucherStatus')?.value||'all';const rows=vouchers.filter(v=>(status==='all'||v.status===status)&&[v.voucher_number,v.snapshot_data?.client,v.snapshot_data?.reservation_code,v.snapshot_data?.phone].join(' ').toLowerCase().includes(q));host.innerHTML=rows.map(v=>`<tr><td><strong>${esc(v.voucher_number)}</strong></td><td>${esc(v.snapshot_data?.client)}</td><td>${esc(v.snapshot_data?.reservation_code)}</td><td>${esc(fmtDate(v.snapshot_data?.period?.start))}</td><td>V${v.version}</td><td><span class="voucher-status ${v.status}">${({issued:'Emitido',superseded:'Substituído',cancelled:'Cancelado'})[v.status]}</span></td><td>${esc(fmtDate(v.issued_at))}</td><td><div class="voucher-actions"><button data-voucher-view="${v.id}">PDF</button><button data-voucher-open-reservation="${v.reservation_id}">Abrir reserva</button><button data-voucher-share="${v.id}">WhatsApp</button><button data-voucher-email="${v.id}">E-mail</button>${v.status==='issued'?`<button data-voucher-reissue="${v.reservation_id}">Reemitir</button><button class="danger" data-voucher-cancel="${v.id}">Cancelar</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="8"><div class="empty-state"><strong>Nenhum voucher encontrado.</strong><p>Emita um voucher pelo menu de ações de uma reserva.</p></div></td></tr>'}
  async function loadVouchers(){const {data,error}=await client.from('vouchers').select('*').order('issued_at',{ascending:false});if(error){console.error(error);return}vouchers=data||[];render()}
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.voucherReservation)previewReservation(b.dataset.voucherReservation);const find=id=>vouchers.find(v=>v.id===id);if(b.dataset.voucherView)downloadStored(find(b.dataset.voucherView));if(b.dataset.voucherShare)share(find(b.dataset.voucherShare));if(b.dataset.voucherEmail)email(find(b.dataset.voucherEmail));if(b.dataset.voucherCancel)cancel(find(b.dataset.voucherCancel));if(b.dataset.voucherOpenReservation){const r=reservationsList().find(x=>x.cloudId===b.dataset.voucherOpenReservation);if(r){setSection('reservas');openModal(r.id)}}if(b.dataset.voucherReissue){const r=reservationsList().find(x=>x.cloudId===b.dataset.voucherReissue);if(r)previewReservation(r.id)}});
  document.getElementById('voucherSearch')?.addEventListener('input',render);document.getElementById('voucherStatus')?.addEventListener('change',render);window.addEventListener('jeri:cloud-ready',loadVouchers);loadVouchers();
  window.JeriVouchers={load:loadVouchers,preview:previewReservation};
})();
