(function(){
  'use strict';
  function waitForImage(image){if(image.complete&&image.naturalWidth)return Promise.resolve();return new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error(`Imagem não carregou: ${image.src}`)),{once:true})})}
  async function waitForVoucherAssets(container){
    if(document.fonts?.ready)await document.fonts.ready;
    const qr=container.querySelector('.vp-qr');if(!qr||qr.classList.contains('vp-qr-pending'))throw new Error('QR Code não foi gerado.');
    const backgroundPromises=[...container.querySelectorAll('*')].flatMap(element=>{const value=getComputedStyle(element).backgroundImage||'';return[...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error(`Fundo não carregou: ${match[1]}`));image.src=match[1]}))});
    await Promise.all([...container.querySelectorAll('img')].map(waitForImage).concat(backgroundPromises));
  }
  async function renderBlob(container){
    if(!window.html2canvas)throw new Error('Renderizador HTML indisponível.');
    const {jsPDF}=window.jspdf||{};if(!jsPDF)throw new Error('Gerador de PDF indisponível.');
    await waitForVoucherAssets(container);
    const canvas=await html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:container.scrollWidth,windowHeight:container.scrollHeight});
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    const pageWidth=210,pageHeight=297,pixelsPerPage=Math.ceil(canvas.width*(pageHeight/pageWidth));
    if(container.scrollHeight/container.scrollWidth<=pageHeight/pageWidth+.01){doc.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,0,pageWidth,pageHeight,undefined,'FAST');return doc.output('blob')}
    for(let offset=0,page=0;offset<canvas.height;offset+=pixelsPerPage,page++){
      if(page&&canvas.height-offset<20)break;
      if(page)doc.addPage();const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(pixelsPerPage,canvas.height-offset);slice.getContext('2d').drawImage(canvas,0,offset,canvas.width,slice.height,0,0,canvas.width,slice.height);const height=pageWidth*(slice.height/slice.width);doc.addImage(slice.toDataURL('image/jpeg',.94),'JPEG',0,0,pageWidth,height,undefined,'FAST');
    }
    return doc.output('blob');
  }
  async function exportAndStore({container,voucher,client,upload=false,download=true}){
    const blob=await renderBlob(container);const filename=`${voucher.voucher_number}-V${voucher.version}.pdf`;
    if(upload){const path=`${voucher.voucher_number.slice(3,7)}/${voucher.voucher_number}/v${voucher.version}.pdf`;const result=await client.storage.from('vouchers').upload(path,blob,{contentType:'application/pdf',upsert:true});if(result.error)throw result.error;const update=await client.from('vouchers').update({pdf_path:path}).eq('id',voucher.id);if(update.error)throw update.error;voucher.pdf_path=path}
    if(download){const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),30000)}
    return blob;
  }
  window.JeriVoucherPremiumExport={waitForVoucherAssets,renderBlob,exportAndStore};
})();
