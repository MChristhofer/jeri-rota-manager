(function(){
  'use strict';
  const client=window.jeriSupabase;
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const fmtDate=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(String(v).length===10?String(v)+'T12:00:00':v)):'A definir';
  const shortDate=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(String(v).length===10?String(v)+'T12:00:00':v)).replace('.','').toUpperCase():'—';
  const publicUrl=v=>location.origin+location.pathname.replace(/[^/]*$/,'')+'v/'+encodeURIComponent(v.validation_token);
  let logoPromise;
  async function logoData(){
    if(logoPromise)return logoPromise;
    logoPromise=(async()=>{try{const r=await fetch('jeri-rota-mark.svg');if(!r.ok)return null;const svg=await r.text();const blob=new Blob([svg],{type:'image/svg+xml'});return await blobToPng(blob,512,648)}catch{return null}})();
    return logoPromise;
  }
  async function blobToPng(blob,w=600,h=400){
    const url=URL.createObjectURL(blob);
    try{return await new Promise(resolve=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/png'))};img.onerror=()=>resolve(null);img.src=url})}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
  }
  async function imageData(url){
    if(!url)return null;
    try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)return null;const blob=await r.blob();return await blobToPng(blob,640,420)}catch{return null}
  }
  async function qrData(text){
    if(!window.QRCode)return null;
    if(typeof window.QRCode.toDataURL==='function'){
      try{return await window.QRCode.toDataURL(text,{width:320,margin:1,color:{dark:'#08263e',light:'#ffffff'}})}catch{}
    }
    return await new Promise(resolve=>{
      try{
        const host=document.createElement('div');host.style.cssText='position:fixed;left:-9999px;top:-9999px;background:#fff;padding:4px';document.body.appendChild(host);
        new window.QRCode(host,{text:text,width:320,height:320,colorDark:'#08263e',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel?window.QRCode.CorrectLevel.M:undefined});
        setTimeout(()=>{const canvas=host.querySelector('canvas'),img=host.querySelector('img');const data=canvas?canvas.toDataURL('image/png'):(img?img.src:null);host.remove();resolve(data)},150);
      }catch{resolve(null)}
    });
  }
  async function generate(v,options={}){
    const jspdf=window.jspdf||{};if(!jspdf.jsPDF){alert('Gerador de PDF indisponível. Atualize a página.');return}
    const s=v.snapshot_data||{},doc=new jspdf.jsPDF({unit:'mm',format:'a4'});
    const navy=[7,38,61],gold=[205,153,62],sand=[248,245,238],sand2=[252,250,246],ink=[23,42,56],muted=[103,116,125],green=[32,126,91],line=[228,221,209],white=[255,255,255];
    const M=12,R=198,W=186;
    const setText=(size,bold,color)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color)};
    const wrap=(value,width)=>doc.splitTextToSize(String(value??''),width);
    const box=(x,y,w,h,fill=sand,r=3)=>{doc.setFillColor(...fill);doc.setDrawColor(...line);doc.roundedRect(x,y,w,h,r,r,'FD')};
    const label=(text,x,y)=>{setText(6.2,true,muted);doc.text(String(text).toUpperCase(),x,y)};
    const logo=await logoData();
    const services=Array.isArray(s.services)?s.services:[];
    const photos=await Promise.all(services.map(item=>imageData(item.image_url)));
    const qr=await qrData(publicUrl(v));

    // Cabeçalho
    doc.setFillColor(...navy);doc.rect(0,0,210,38,'F');
    if(logo)doc.addImage(logo,'PNG',12,6,15,20);
    setText(17,true,white);doc.text('JERI ROTA',32,15);
    setText(7.5,true,gold);doc.text('VOUCHER OFICIAL DE RESERVA',32,23);
    doc.setFillColor(238,248,242);doc.roundedRect(153,7,45,15,3,3,'F');
    setText(7,true,green);doc.text(v.status==='cancelled'?'VOUCHER CANCELADO':'RESERVA CONFIRMADA',175.5,13,{align:'center'});
    setText(6.5,true,navy);doc.text('VERSÃO '+v.version,175.5,18,{align:'center'});

    setText(14,true,navy);doc.text(v.voucher_number,12,48);
    setText(6.5,false,muted);doc.text('Reserva '+(s.reservation_code||'—')+'  ·  Emitido em '+fmtDate(v.issued_at),12,54);

    // Resumo
    box(12,59,186,27,sand2);
    label('Cliente',18,67);setText(8.4,true,navy);doc.text(wrap(s.client||'A definir',75),18,73);
    doc.setDrawColor(...line);doc.line(99,64,99,81);
    label('Período',105,67);setText(8.3,true,navy);doc.text(fmtDate(s.period?.start)+' a '+fmtDate(s.period?.end),105,74);
    label('Passageiros',164,67);setText(9,true,navy);doc.text(String(s.people||1),164,74);

    // Roteiro
    setText(9,true,gold);doc.text('SEU ROTEIRO',12,94);doc.setDrawColor(...line);doc.line(12,97,198,97);
    let y=101;
    const rowH=19;
    services.forEach((svc,i)=>{
      box(12,y,186,rowH,sand2,2.5);
      doc.setFillColor(...navy);doc.roundedRect(16,y+3,24,13,2,2,'F');
      setText(7,true,white);doc.text(shortDate(svc.date),28,y+8,{align:'center'});
      setText(5.7,true,white);doc.text(String(new Date(String(svc.date).length===10?String(svc.date)+'T12:00:00':svc.date).getFullYear()),28,y+13,{align:'center'});
      if(photos[i]){
        doc.addImage(photos[i],'PNG',44,y+2,29,15.5,undefined,'FAST');
      }else{
        doc.setFillColor(...navy);doc.roundedRect(44,y+2,29,15.5,2,2,'F');
        if(logo)doc.addImage(logo,'PNG',53,y+4.2,10,11);
      }
      setText(9.5,true,navy);doc.text(wrap(svc.title||'Serviço',70),78,y+7);
      const details=[svc.time?svc.time:'',svc.modality||'',svc.vehicle||''].filter(Boolean).join('  ·  ');
      setText(6.7,false,muted);doc.text(wrap(details,70),78,y+13);
      y+=rowH+2;
    });

    // Se muitos serviços ocuparem espaço, cria página 2 apenas quando necessário
    if(y>205){doc.addPage();y=18;}

    // Embarque + Pagamento lado a lado
    const infoY=y+2;
    box(12,infoY,89,36,[245,249,252]);
    label('Local de embarque',18,infoY+8);
    setText(7.7,true,navy);doc.text(wrap(s.boarding||'A definir',77),18,infoY+14);
    const firstTime=services.find(x=>x.time)?.time||'';
    if(firstTime){setText(6.5,false,muted);doc.text('Horário relacionado: '+firstTime,18,infoY+30);}

    box(105,infoY,93,36,[252,248,238]);
    label('Pagamento',111,infoY+8);
    if(v.show_value){
      const total=Number(s.amount)||0,paid=Number(s.paid_amount)||0,balance=Math.max(0,Number(s.balance ?? total-paid));
      setText(6.3,false,muted);doc.text('Valor da reserva',111,infoY+15);doc.text('Sinal recebido',151,infoY+15);
      setText(9,true,navy);doc.text(money(total),111,infoY+22);doc.text(money(paid),151,infoY+22);
      doc.setFillColor(...navy);doc.roundedRect(111,infoY+25,81,8,2,2,'F');
      setText(6.3,true,gold);doc.text(balance>0?'SALDO NO EMBARQUE':'RESERVA QUITADA',115,infoY+30);
      setText(9.2,true,white);doc.text(balance>0?money(balance):'QUITADA',188,infoY+30,{align:'right'});
    }else{
      setText(8.5,true,navy);doc.text(s.payment_status||'Pagamento conforme reserva',111,infoY+20);
    }

    // Observações + validação
    const lowerY=infoY+41;
    box(12,lowerY,89,43,[247,250,252]);
    label('Informações importantes',18,lowerY+8);
    setText(6.5,false,ink);
    const notes=s.customer_notes?wrap(s.customer_notes,77):[
      'Apresente este voucher no momento do embarque.',
      'Chegue ao local com alguns minutos de antecedência.',
      'Em caso de dúvidas, fale com a equipe Jeri Rota.'
    ];
    if(Array.isArray(notes)){notes.slice(0,4).forEach((n,i)=>{doc.setFillColor(...gold);doc.circle(19,lowerY+15+i*7,1,'F');doc.text(wrap(n,72),23,lowerY+16+i*7)})}
    else doc.text(notes,18,lowerY+15);

    box(105,lowerY,93,43,[247,250,252]);
    label('Validação do voucher',111,lowerY+8);
    if(qr)doc.addImage(qr,'PNG',111,lowerY+12,25,25);
    else{doc.setDrawColor(...navy);doc.rect(111,lowerY+12,25,25);setText(6,true,muted);doc.text('QR',123.5,lowerY+26,{align:'center'});}
    setText(7.2,true,navy);doc.text('Documento oficial Jeri Rota',141,lowerY+17);
    setText(6.2,false,muted);doc.text(wrap('Escaneie o QR Code para confirmar autenticidade e status.',50),141,lowerY+23);
    setText(6.5,true,navy);doc.text('sistema.jerirota.com.br',141,lowerY+35);
    setText(5.8,false,muted);doc.text(v.voucher_number,141,lowerY+40);

    // Rodapé
    const footY=lowerY+49;
    doc.setDrawColor(...gold);doc.line(12,footY,198,footY);
    if(logo)doc.addImage(logo,'PNG',12,footY+3,9,12);
    setText(8.5,true,navy);doc.text('JERI ROTA',24,footY+9);
    setText(6,false,muted);doc.text('Jericoacoara · Ceará',24,footY+14);
    setText(6.2,false,muted);doc.text('Documento emitido em '+fmtDate(v.issued_at),198,footY+8,{align:'right'});
    doc.text('Voucher sujeito às condições da reserva.',198,footY+13,{align:'right'});

    const blob=doc.output('blob'),filename=v.voucher_number+'-V'+v.version+'.pdf';
    if(options.upload&&client){
      const path=v.voucher_number.slice(3,7)+'/'+v.voucher_number+'/v'+v.version+'.pdf';
      const up=await client.storage.from('vouchers').upload(path,blob,{contentType:'application/pdf',upsert:true});
      if(!up.error){await client.from('vouchers').update({pdf_path:path}).eq('id',v.id);v.pdf_path=path}else console.error('Falha ao armazenar PDF:',up.error);
    }
    doc.save(filename);return blob;
  }
  window.JeriVoucherPdf={generate};
})();