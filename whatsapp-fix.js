window.openWhatsApp = async function(text){
  const whatsappWindow = window.open('https://web.whatsapp.com/','jeriRotaWhatsApp');

  if(!whatsappWindow){
    try{ await copyText(text); }catch{}
    toast('O navegador bloqueou o WhatsApp. Permita pop-ups; a mensagem já foi copiada.');
    return;
  }

  try{ whatsappWindow.focus(); }catch{}

  try{
    await copyText(text);
    toast('WhatsApp aberto. Mensagem copiada; escolha a conversa e cole com Ctrl+V.');
  }catch{
    toast('WhatsApp aberto. Use o botão Copiar para copiar a mensagem.');
  }
};
