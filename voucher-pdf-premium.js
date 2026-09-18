(function(){
  'use strict';
  const client=window.jeriSupabase;
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const fmtDate=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(String(v).length===10?String(v)+'T12:00:00':v)):'A definir';
  const publicUrl=v=>location.origin+location.pathname.replace(/[^/]*$/,'')+'v/'+encodeURIComponent(v.validation_token);
  let logoPromise;
  async function logoData(){
    if(logoPromise)return logoPromise;
    logoPromise=(async()=>{try{const r=await fetch('jeri-rota-mark.svg');if(!r.ok)return null;const svg=await r.text();const blob=new Blob([svg],{type:'image/svg+xml'});const url=URL.createObjectURL(blob);try{return await new Promise(resolve=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=648;canvas.getContext('2d').drawImage(img,0,0,512,648);resolve(canvas.toDataURL('image/png'))};img.onerror=()=>resolve(null);img.src=url})}finally{URL.revokeObjectURL(url)}}catch{return null}})();
    return logoPromise;
  }
  async function qrData(text){
    if(!window.QRCode)return null;
    if(typeof window.QRCode.toDataURL==='function')return window.QRCode.toDataURL(text,{width:240,margin:1,color:{dark:'#08263e',light:'#ffffff'}});
    return new Promise(resolve=>{try{const host=document.createElement('div');host.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(host);new window.QRCode(host,{text,width:240,height:240,colorDark:'#08263e',colorLight:'#ffffff'});setTimeout(()=>{const canvas=host.querySelector('canvas'),img=host.querySelector('img');const data=canvas?.toDataURL('image/png')||img?.src||null;host.remove();resolve(data)},80)}catch{resolve(null)}});
  }
  async function generate(v,options={}){
    const jspdf=window.jspdf||{};if(!jspdf.jsPDF){alert('Gerador de PDF indisponível. Atualize a página.');return}
    const s=v.snapshot_data||{},doc=new jspdf.jsPDF({unit:'mm',format:'a4'});
    const navy=[8,38,62],gold=[217,163,60],sand=[248,245,238],ink=[31,43,51],muted=[105,115,122],green=[38,118,95],line=[226,221,211];
    const M=16,W=178;let y=0;
    const setText=(size,bold,color)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color)};
    const wrap=(value,width)=>doc.splitTextToSize(String(value??''),width);
    const ensure=h=>{if(y+h<=278)return;doc.addPage();y=18};
    const box=(x,yy,w,h,fill=sand)=>{doc.setFillColor(...fill);doc.setDrawColor(...line);doc.roundedRect(x,yy,w,h,3,3,'FD')};
    const section=label=>{ensure(12);setText(8,true,gold);doc.text(label.toUpperCase(),M,y);doc.setDrawColor(...line);doc.line(M,y+3,194,y+3);y+=9};
    const logo=await logoData();
    doc.setFillColor(...navy);doc.rect(0,0,210,43,'F');
    if(logo)doc.addImage(logo,'PNG',16,7,17,22);
    setText(18,true,[255,255,255]);doc.text('JERI ROTA',logo?39:16,17);
    setText(8,true,gold);doc.text('VOUCHER OFICIAL DE RESERVA',logo?39:16,25);
    doc.setFillColor(255,255,255);doc.roundedRect(148,9,46,18,3,3,'F');
    setText(7.5,true,v.status==='cancelled'?[170,64,58]:green);doc.text(v.status==='cancelled'?'VOUCHER CANCELADO':'RESERVA CONFIRMADA',171,16,{align:'center'});
    setText(7,true,navy);doc.text('VERSÃO '+v.version,171,22,{align:'center'});
    y=53;setText(15,true,navy);doc.text(v.voucher_number,M,y);
    setText(7,false,muted);doc.text('Reserva '+(s.reservation_code||'—')+' · Emitido em '+fmtDate(v.issued_at),M,y+6);y+=15;
    box(M,y,W,34);
    setText(6.5,true,muted);doc.text('CLIENTE',20,y+8);doc.text('PERÍODO',20,y+22);doc.text('PASSAGEIROS',137,y+22);
    setText(9,true,navy);doc.text(wrap(s.client||'A definir',166),20,y+14);
    setText(8,true,ink);doc.text(fmtDate(s.period?.start)+' a '+fmtDate(s.period?.end),20,y+28);doc.text(String(s.people||1),137,y+28);y+=43;
    section('Serviços contratados');
    const services=Array.isArray(s.services)?s.services:[];
    services.forEach((svc,i)=>{
      const details=[];if(svc.time)details.push('Horário '+svc.time);if(svc.modality)details.push(svc.modality);if(svc.vehicle)details.push(svc.vehicle);if(svc.route)details.push(svc.route);
      const titleLines=wrap(svc.title||'Serviço',118),noteLines=svc.notes?wrap(svc.notes,132):[];
      const h=Math.max(24,18+(titleLines.length-1)*4+(details.length?5:0)+(noteLines.length?noteLines.length*4+2:0));ensure(h+5);box(M,y,W,h);
      doc.setFillColor(...navy);doc.roundedRect(20,y+5,28,13,2,2,'F');setText(6.5,true,[255,255,255]);doc.text(fmtDate(svc.date),34,y+10,{align:'center'});doc.text('SERVIÇO '+(i+1),34,y+15,{align:'center'});
      setText(10,true,navy);doc.text(titleLines,54,y+9);let sy=y+15+(titleLines.length-1)*4;
      if(details.length){setText(7,false,muted);doc.text(wrap(details.join(' · '),132),54,sy);sy+=5}
      if(noteLines.length){setText(7,false,ink);doc.text(noteLines,54,sy)}
      y+=h+5;
    });
    section('Embarque');
    const boarding=wrap(s.boarding||'A definir',164),bh=16+(boarding.length-1)*4;box(M,y,W,bh);setText(6.5,true,muted);doc.text('LOCAL PRINCIPAL',20,y+7);setText(8,false,ink);doc.text(boarding,20,y+12);y+=bh+9;
    section('Pagamento');
    if(v.show_value){
      const total=Number(s.amount)||0,paid=Number(s.paid_amount)||0,balance=Math.max(0,Number(s.balance ?? total-paid));box(M,y,W,31);
      const cols=[['VALOR DA RESERVA',money(total),20,navy],['SINAL / VALOR PAGO',money(paid),78,navy],[balance>0?'SALDO NO EMBARQUE':'SITUAÇÃO',balance>0?money(balance):'RESERVA QUITADA',136,green]];
      cols.forEach(col=>{setText(6.2,true,muted);doc.text(col[0],col[2],y+8);setText(col[2]===136?10.5:9.5,true,col[3]);doc.text(col[1],col[2],y+18,{maxWidth:52})});y+=40;
    }else{box(M,y,W,18);setText(9,true,navy);doc.text(s.payment_status||'Pagamento conforme reserva',20,y+11);y+=27}
    if(s.customer_notes){section('Observações');const notes=wrap(s.customer_notes,164),nh=16+(notes.length-1)*4;ensure(nh+5);box(M,y,W,nh);setText(8,false,ink);doc.text(notes,20,y+10);y+=nh+8}
    section('Validação');ensure(49);const url=publicUrl(v),qr=await qrData(url);box(M,y,W,43);if(qr)doc.addImage(qr,'PNG',20,y+5,33,33);
    setText(9,true,navy);doc.text('Documento verificável',60,y+11);setText(7,false,muted);doc.text(wrap('Escaneie o QR Code para confirmar a autenticidade e o status deste voucher.',123),60,y+17);setText(6,false,muted);doc.text(wrap(url,123),60,y+28);setText(7,true,navy);doc.text('Jeri Rota · Jericoacoara e Ceará',60,y+38);
    const blob=doc.output('blob'),filename=v.voucher_number+'-V'+v.version+'.pdf';
    if(options.upload&&client){const path=v.voucher_number.slice(3,7)+'/'+v.voucher_number+'/v'+v.version+'.pdf';const up=await client.storage.from('vouchers').upload(path,blob,{contentType:'application/pdf',upsert:true});if(!up.error){await client.from('vouchers').update({pdf_path:path}).eq('id',v.id);v.pdf_path=path}else console.error('Falha ao armazenar PDF:',up.error)}
    doc.save(filename);return blob;
  }
  window.JeriVoucherPdf={generate};
})();
