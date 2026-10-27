(function(){
  'use strict';
  function waitForImage(image){if(image.complete&&image.naturalWidth)return Promise.resolve();return new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error(`Imagem não carregou: ${image.src}`)),{once:true})})}
  async function waitForVoucherAssets(container){
    if(document.fonts?.ready)await document.fonts.ready;
    const qr=container.querySelector('.vp-qr');if(!qr||qr.classList.contains('vp-qr-pending'))throw new Error('QR Code não foi gerado.');
    const backgroundPromises=[...container.querySelectorAll('*')].flatMap(element=>{const value=getComputedStyle(element).backgroundImage||'';return[...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error(`Fundo não carregou: ${match[1]}`));image.src=match[1]}))});
    await Promise.all([...container.querySelectorAll('img')].map(waitForImage).concat(backgroundPromises));
  }
  function hasVisibleContent(canvas){
    const context=canvas.getContext('2d',{willReadFrequently:true}),pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    const step=4,minimum=Math.max(8,Math.floor((canvas.width/step)*.02));let visible=0;
    for(let y=0;y<canvas.height;y+=step){
      for(let x=0;x<canvas.width;x+=step){
        const offset=(y*canvas.width+x)*4;
        if(pixels[offset+3]>10&&(pixels[offset]<248||pixels[offset+1]<248||pixels[offset+2]<248)&&++visible>=minimum)return true;
      }
    }
    return false;
  }

  function overflowPx(page){
    // Browser A4 can vary by a few pixels after font rendering.
    return Math.max(0,page.scrollHeight-page.clientHeight);
  }
  function applyCompactLayout(page){
    if(overflowPx(page)<=3)return true;
    page.classList.add('vc-compact');
    if(overflowPx(page)<=3)return true;
    page.classList.add('vc-ultra-compact');
    return overflowPx(page)<=3;
  }
  function splitDocumentPage(page){
    const rows=[...page.querySelectorAll('.vc-service-row')];
    if(rows.length<2)return null;
    // Clone only the document structure. The last row and validation block
    // move to the new final page, avoiding a page with an orphaned QR.
    const next=page.cloneNode(true);
    next.querySelector('.vc-summary')?.remove();
    next.querySelectorAll('.vc-service-row').forEach(row=>row.remove());
    next.querySelectorAll('.vc-continuation').forEach(node=>node.remove());
    const destination=next.querySelector('.vc-service-table');
    const last=rows[rows.length-1];
    destination.appendChild(last.cloneNode(true));
    last.remove();
    const endBlocks=['.vc-pickup','.vc-money','.vc-notes','.vc-validation'];
    endBlocks.forEach(selector=>page.querySelector(selector)?.remove());
    if(!page.querySelector('.vc-continuation')){
      const more=document.createElement('div');
      more.className='vc-continuation';
      more.textContent=page.querySelector('.vc-reference')?.textContent||'Jeri Rota';
      page.querySelector('.vc-main')?.appendChild(more);
    }
    page.after(next);
    return next;
  }
  function normalizeCleanPages(container){
    // Called after fonts/assets finish loading. Dynamically reduce nonessential
    // spacing; if necessary transfer services to another A4 document page.
    let pages=[...container.querySelectorAll('[data-voucher-page]')];
    for(let i=0;i<pages.length;i++){
      const page=pages[i];
      if(applyCompactLayout(page))continue;
      if(!page.classList.contains('vc-document-page')){
        throw new Error('As condições gerais não cabem na página '+(i+1)+'.');
      }
      const next=splitDocumentPage(page);
      if(!next)throw new Error('O conteúdo da página '+(i+1)+' excede a área A4 e não pode ser dividido sem perda de informação.');
      pages=[...container.querySelectorAll('[data-voucher-page]')];
      if(pages.length>40)throw new Error('O documento ultrapassou o limite de páginas aceito.');
      // Page i is smaller now. Check it again without advancing.
      i--;
    }
    pages=[...container.querySelectorAll('[data-voucher-page]')];
    const labels={pt:'Página',en:'Page',fr:'Page',es:'Página'};
    const label=labels[container.getAttribute('lang')]||'Página';
    pages.forEach((page,i)=>{
      const count=page.querySelector('.vc-footer span:last-child');
      if(count)count.textContent=label+' '+(i+1)+' / '+pages.length;
    });
    return pages;
  }

  async function renderBlob(container){
    if(!window.html2canvas)throw new Error('Renderizador HTML indisponível.');
    const {jsPDF}=window.jspdf||{};if(!jsPDF)throw new Error('Gerador de PDF indisponível.');
    await waitForVoucherAssets(container);
    const cleanPages=normalizeCleanPages(container);
    if(cleanPages.length){
      const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      for(let i=0;i<cleanPages.length;i++){
        const page=cleanPages[i];
        // Rejeita conteúdo que extrapole o A4, evitando páginas órfãs e cortes.
        const overflow=overflowPx(page);
        if(overflow>3)throw new Error('Não foi possível adequar a página '+(i+1)+' ao tamanho A4 sem cortar o conteúdo.');
        const canvas=await html2canvas(page,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:page.scrollWidth,windowHeight:page.scrollHeight});
        if(i)doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,0,210,297,undefined,'FAST');
        if(page.classList.contains('vc-terms-page'))doc.link(10,260,190,18,{url:'https://www.jerirota.com.br/termos-e-condicoes/'});
      }
      return doc.output('blob');
    }
    const canvas=await html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:container.scrollWidth,windowHeight:container.scrollHeight});
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    const pageWidth=210,pageHeight=297,pixelsPerPage=Math.ceil(canvas.width*(pageHeight/pageWidth));
    if(container.scrollHeight/container.scrollWidth<=pageHeight/pageWidth+.01){doc.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,0,pageWidth,pageHeight,undefined,'FAST');return doc.output('blob')}
    for(let offset=0,page=0;offset<canvas.height;offset+=pixelsPerPage,page++){
      const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(pixelsPerPage,canvas.height-offset);slice.getContext('2d').drawImage(canvas,0,offset,canvas.width,slice.height,0,0,canvas.width,slice.height);
      if(page&&!hasVisibleContent(slice))break;
      if(page)doc.addPage();const height=pageWidth*(slice.height/slice.width);doc.addImage(slice.toDataURL('image/jpeg',.94),'JPEG',0,0,pageWidth,height,undefined,'FAST');
    }
    return doc.output('blob');
  }
  async function exportAndStore({container,voucher,client,upload=false,download=true}){
    const blob=await renderBlob(container);const filename=`${voucher.voucher_number}-V${voucher.version}.pdf`;
    if(upload){const path=`${voucher.voucher_number.slice(3,7)}/${voucher.voucher_number}/v${voucher.version}.pdf`;const result=await client.storage.from('vouchers').upload(path,blob,{contentType:'application/pdf',upsert:true});if(result.error)throw result.error;const update=await client.from('vouchers').update({pdf_path:path}).eq('id',voucher.id);if(update.error)throw update.error;voucher.pdf_path=path}
    if(download){const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),30000)}
    return blob;
  }
  window.JeriVoucherPremiumExport={waitForVoucherAssets,hasVisibleContent,normalizeCleanPages,renderBlob,exportAndStore};
})();
