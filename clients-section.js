(function(){
  'use strict';

  const KEY='jeri-rota-manager-reservas-v1';
  const section=document.getElementById('clientes');
  if(!section)return;

  const search=document.getElementById('clientSearch');
  const list=document.getElementById('clientsList');
  const total=document.getElementById('clientsTotal');
  const count=document.getElementById('clientsCount');
  let visible=[];

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
  const normalizePhone=value=>{
    const digits=String(value??'').replace(/\D/g,'');
    return /^55\d{10,11}$/.test(digits)?digits.slice(2):digits;
  };
  const phoneOf=reservation=>String(reservation.phone||reservation.phones?.find(p=>p?.phone||p?.phoneE164)?.phone||reservation.phones?.[0]?.phoneE164||'').trim();
  const eligible=reservation=>{
    const status=normalize(reservation?.status);
    return status==='finalizada'||(status==='confirmada'&&Number(reservation?.paidAmount)>0);
  };
  const timestamp=reservation=>String(reservation.createdAt||reservation.updatedAt||reservation.date||'');
  const getReservations=()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||'[]');
      if(Array.isArray(saved))return saved;
    }catch(error){console.warn('Não foi possível ler as reservas salvas.',error)}
    try{
      if(typeof reservations!=='undefined'&&Array.isArray(reservations))return reservations;
    }catch(error){console.warn('Não foi possível ler as reservas em memória.',error)}
    return[];
  };

  function buildClients(source){
    const byPhone=new Map(),byEmail=new Map(),groups=[];
    (Array.isArray(source)?source:[])
      .filter(row=>row&&eligible(row)&&String(row.client||'').trim())
      .sort((a,b)=>timestamp(b).localeCompare(timestamp(a)))
      .forEach(reservation=>{
        const name=String(reservation.client).trim();
        const nameKey=normalize(name);
        const phone=phoneOf(reservation);
        const phoneKey=normalizePhone(phone);
        const email=String(reservation.email||'').trim();
        const emailKey=normalize(email);
        const existing=(phoneKey&&byPhone.get(nameKey+'|'+phoneKey))||(emailKey&&byEmail.get(nameKey+'|'+emailKey));
        const group=existing||{name,phone:'',email:'',count:0,finished:false,sortDate:''};
        if(!existing)groups.push(group);
        group.count+=1;
        group.finished=group.finished||normalize(reservation.status)==='finalizada';
        if(!group.phone&&phone)group.phone=phone;
        if(!group.email&&email)group.email=email;
        if(timestamp(reservation)>group.sortDate)group.sortDate=timestamp(reservation);
        if(phoneKey)byPhone.set(nameKey+'|'+phoneKey,group);
        if(emailKey)byEmail.set(nameKey+'|'+emailKey,group);
        if(group.phone)byPhone.set(nameKey+'|'+normalizePhone(group.phone),group);
        if(group.email)byEmail.set(nameKey+'|'+normalize(group.email),group);
      });
    return groups
      .sort((a,b)=>b.sortDate.localeCompare(a.sortDate)||a.name.localeCompare(b.name,'pt-BR'))
      .map(({sortDate,...client})=>client);
  }

  function render(){
    if(!list)return;
    if(!window.JERI_CLOUD_READY){
      if(total)total.textContent='—';
      if(count)count.textContent='Carregando dados oficiais...';
      list.innerHTML='<tr><td colspan="4" class="clients-empty">Carregando clientes...</td></tr>';
      return;
    }
    const all=buildClients(getReservations());
    const query=normalize(search?.value||'');
    const digits=String(search?.value||'').replace(/\D/g,'');
    visible=all.filter(client=>{
      const haystack=normalize([client.name,client.phone,client.email].join(' '));
      return !query||haystack.includes(query)||(digits&&normalizePhone(client.phone).includes(digits));
    });
    if(total)total.textContent=String(all.length);
    if(count)count.textContent=visible.length===all.length
      ?(all.length===1?'1 cliente disponível':all.length+' clientes disponíveis')
      :visible.length+' de '+all.length+' clientes';
    if(!visible.length){
      list.innerHTML='<tr><td colspan="4" class="clients-empty">'+(all.length?'Nenhum cliente corresponde à busca.':'Nenhum cliente confirmado com sinal pago ou finalizado até o momento.')+'</td></tr>';
      return;
    }
    list.innerHTML=visible.map((client,index)=>{
      const phone=escapeHtml(client.phone||'Não informado');
      const email=escapeHtml(client.email||'Não informado');
      const name=escapeHtml(client.name);
      const label=client.finished?'Já viajou':'Sinal pago';
      const contact=(kind,value)=>'<div class="clients-contact"><span>'+escapeHtml(value||'Não informado')+'</span>'+(value?'<button type="button" class="clients-copy" data-copy-client="'+index+'" data-copy-kind="'+kind+'" aria-label="Copiar '+(kind==='phone'?'telefone':'e-mail')+' de '+name+'">Copiar</button>':'')+'</div>';
      return '<tr><td data-label="Cliente"><strong class="clients-name">'+name+'</strong><small>'+client.count+' '+(client.count===1?'reserva':'reservas')+'</small></td>'
        +'<td data-label="Telefone / WhatsApp">'+contact('phone',client.phone)+'</td>'
        +'<td data-label="E-mail">'+contact('email',client.email)+'</td>'
        +'<td data-label="Situação"><span class="clients-status '+(client.finished?'clients-status-finished':'')+'">'+label+'</span></td></tr>';
    }).join('');
  }

  async function copyText(value,button){
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
      else{
        const input=document.createElement('textarea');
        input.value=value;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';
        document.body.appendChild(input);input.select();
        const ok=document.execCommand('copy');input.remove();
        if(!ok)throw new Error('Falha na cópia');
      }
      button.textContent='Copiado!';
      window.setTimeout(()=>{if(button.isConnected)button.textContent='Copiar'},1800);
    }catch(error){
      console.warn('Não foi possível copiar o contato:',error);
      button.textContent='Falhou';
      window.setTimeout(()=>{if(button.isConnected)button.textContent='Copiar'},1800);
    }
  }

  search?.addEventListener('input',render);
  list?.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-copy-client]');
    if(!button)return;
    const client=visible[Number(button.dataset.copyClient)];
    const value=button.dataset.copyKind==='email'?client?.email:client?.phone;
    if(value)copyText(value,button);
  });
  window.addEventListener('jeri:cloud-ready',render);
  window.addEventListener('storage',event=>{if(event.key===KEY)render()});
  window.JeriClients=Object.freeze({buildClients,render});
  render();
})();
