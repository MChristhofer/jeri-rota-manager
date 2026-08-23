const WHATSAPP_TARGET_KEY='jeri-rota-manager-whatsapp-destino-v1';

function normalizeWhatsAppTarget(value=''){
  let digits=String(value).replace(/\D/g,'');
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(digits.length===10||digits.length===11)digits=`55${digits}`;
  return digits;
}

function getDefaultWhatsAppTarget(){
  return normalizeWhatsAppTarget(localStorage.getItem(WHATSAPP_TARGET_KEY)||'');
}

function setDefaultWhatsAppTarget(value){
  const digits=normalizeWhatsAppTarget(value);
  if(digits)localStorage.setItem(WHATSAPP_TARGET_KEY,digits);
  else localStorage.removeItem(WHATSAPP_TARGET_KEY);
  return digits;
}

function formatTargetForDisplay(value){
  const digits=normalizeWhatsAppTarget(value);
  if(digits.startsWith('55')&&digits.length>=12){
    const national=digits.slice(2);
    if(national.length===11)return `+55 (${national.slice(0,2)}) ${national.slice(2,7)}-${national.slice(7)}`;
    if(national.length===10)return `+55 (${national.slice(0,2)}) ${national.slice(2,6)}-${national.slice(6)}`;
  }
  return digits?`+${digits}`:'';
}

function askWhatsAppTarget(current=''){
  const typed=prompt(
    'WhatsApp que receberá os repasses:\n\nDigite com DDD. Para número internacional, informe também o código do país.',
    current?formatTargetForDisplay(current):''
  );
  if(typed===null)return'';
  const target=normalizeWhatsAppTarget(typed);
  if(target.length<10){
    toast('Informe um número de WhatsApp válido.');
    return'';
  }
  setDefaultWhatsAppTarget(target);
  return target;
}

window.openWhatsApp = function(text,target=''){
  let destination=normalizeWhatsAppTarget(target)||getDefaultWhatsAppTarget();
  if(!destination)destination=askWhatsAppTarget();
  if(!destination)return;

  const url=`https://web.whatsapp.com/send?phone=${destination}&text=${encodeURIComponent(text)}`;
  const whatsappWindow=window.open(url,'jeriRotaWhatsApp');

  if(!whatsappWindow){
    try{copyText(text)}catch{}
    toast('O navegador bloqueou o WhatsApp. Permita pop-ups; a mensagem foi copiada.');
    return;
  }

  try{whatsappWindow.focus()}catch{}
  try{copyText(text)}catch{}
  toast('WhatsApp aberto com a mensagem preenchida.');
};

function installWhatsAppSettingsButton(){
  const heading=document.querySelector('#tab-historico .section-heading');
  if(!heading||document.getElementById('whatsappTargetSettings'))return;

  const button=document.createElement('button');
  button.type='button';
  button.id='whatsappTargetSettings';
  button.className='outline-button';
  button.textContent='⚙ WhatsApp padrão';
  button.title='Definir o número que recebe os repasses';
  button.addEventListener('click',()=>{
    const current=getDefaultWhatsAppTarget();
    const target=askWhatsAppTarget(current);
    if(target)toast(`WhatsApp padrão: ${formatTargetForDisplay(target)}`);
  });
  heading.appendChild(button);
}

installWhatsAppSettingsButton();
