const REPASSES_KEY='jeri-rota-manager-repasses-v1';
const TOURS_KEY='jeri-rota-manager-passeios-v1';
const LOCATIONS_KEY='jeri-rota-manager-locais-v1';
const STATUS=['Pendente','Enviado','Confirmado','Finalizado'];
const DEFAULT_TOURS=['Litoral Leste','Litoral Oeste'];
const DEFAULT_MAP_CITY='Fortaleza, Ceará';
const $=id=>document.getElementById(id);
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const todayFormat=new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
let editingRepasseId=null;

const phoneInput=$('phoneInput');
const phoneIti=window.intlTelInput?window.intlTelInput(phoneInput,{
  initialCountry:'br',
  countryOrder:['br','us','ar','pt','gb','fr','es','it','de'],
  countryNameLocale:'pt-BR',
  numberDisplayFormat:'NATIONAL',
  formatAsYouType:true,
  strictMode:true,
  loadUtils:()=>import('https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.0/dist/js/utils.js')
}):null;

function read(key,fallback=[]){try{const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function escapeHtml(v=''){return String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))}
function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(window.__jrToast);window.__jrToast=setTimeout(()=>el.classList.remove('show'),2200)}
function normalizeMoney(v){const s=String(v||'').replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?Math.max(0,n):0}
function brDate(v){if(!v)return'';const [y,m,d]=v.split('-');return `${d}/${m}/${y}`}
function localToday(){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function mapUrl(query){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
function fallbackCopy(text){const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.focus();area.select();try{document.execCommand('copy')}catch{}area.remove()}
async function copyText(text){if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return}catch{}}fallbackCopy(text)}
async function openWhatsApp(text){await copyText(text);const whatsappWindow=window.open('https://web.whatsapp.com/','jeriRotaWhatsApp');if(whatsappWindow){whatsappWindow.focus();toast('Mensagem copiada. Escolha a conversa e cole com Ctrl+V.')}else toast('Permita pop-ups para abrir o WhatsApp Web.')}
function activateTab(name){document.querySelectorAll('.repasse-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));document.querySelectorAll('.repasse-panel').forEach(x=>x.classList.toggle('active',x.id===`tab-${name}`));window.scrollTo({top:0,behavior:'smooth'})}

function getTours(){let tours=read(TOURS_KEY);if(!tours.length){tours=[...DEFAULT_TOURS];write(TOURS_KEY,tours)}return tours}
function getLocations(){return read(LOCATIONS_KEY)}
function getRepasses(){return read(REPASSES_KEY)}
function nextNumber(){return getRepasses().reduce((m,x)=>Math.max(m,Number(x.number)||0),0)+1}
function nextCode(){return `REP-${String(nextNumber()).padStart(5,'0')}`}
function currentCode(){if(!editingRepasseId)return nextCode();const item=getRepasses().find(x=>x.id===editingRepasseId);return item?.code||nextCode()}
function locationMapQuery(name){const saved=getLocations().find(x=>x.name.toLowerCase()===String(name||'').trim().toLowerCase());return [saved?.name||name,saved?.address||DEFAULT_MAP_CITY].filter(Boolean).join(', ')}

function getPhoneInfo(){
  const raw=phoneInput.value.trim();
  const selected=phoneIti?.getSelectedCountryData?.()||{iso2:'br',dialCode:'55'};
  let phone=raw;
  let phoneE164='';
  if(phoneIti&&raw){
    try{
      phoneE164=phoneIti.getNumber('E164')||'';
      const formatted=phoneIti.getNumber(selected.iso2==='br'?'NATIONAL':'INTERNATIONAL');
      if(formatted)phone=formatted;
    }catch{}
  }
  return{phone,phoneE164,phoneCountry:selected.iso2||''};
}

async function validatePhone(){
  if(phoneIti?.promise){try{await phoneIti.promise}catch{}}
  const raw=phoneInput.value.trim();
  if(!raw)return false;
  const help=$('phoneHelp');
  if(phoneIti?.isValidNumber&&!phoneIti.isValidNumber()){
    help.textContent='Confira o número para o país selecionado.';
    help.classList.remove('phone-valid');
    help.classList.add('phone-invalid');
    phoneInput.focus();
    toast('Telefone inválido para o país selecionado.');
    return false;
  }
  const country=phoneIti?.getSelectedCountryData?.();
  help.textContent=country?.name?`${country.name} · número reconhecido`:'Número reconhecido';
  help.classList.remove('phone-invalid');
  help.classList.add('phone-valid');
  return true;
}

function renderTours(){const tours=getTours().slice().sort((a,b)=>a.localeCompare(b,'pt-BR'));$('tourSelect').innerHTML='<option value="">Selecione...</option>'+tours.map(t=>`<option>${escapeHtml(t)}</option>`).join('');$('tourList').innerHTML=tours.map(t=>`<div class="catalog-item"><div><strong>${escapeHtml(t)}</strong><small>Disponível nos novos repasses</small></div><div class="catalog-actions"><button class="mini-button" data-tour-edit="${encodeURIComponent(t)}">Editar</button><button class="mini-button" data-tour-delete="${encodeURIComponent(t)}">Excluir</button></div></div>`).join('');$('tourEmpty').style.display=tours.length?'none':'block'}
function renderLocations(){const items=getLocations().slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));$('boardingOptions').innerHTML=items.map(x=>`<option value="${escapeHtml(x.name)}">${escapeHtml(x.address||x.type||'')}</option>`).join('');$('locationList').innerHTML=items.map(x=>`<div class="catalog-item"><div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml([x.type,x.address].filter(Boolean).join(' · '))}</small></div><div class="catalog-actions"><button class="mini-button maps" data-location-maps="${x.id}">Maps</button><button class="mini-button" data-location-edit="${x.id}">Editar</button><button class="mini-button" data-location-delete="${x.id}">Excluir</button></div></div>`).join('');$('locationEmpty').style.display=items.length?'none':'block'}

function formData(){const phone=getPhoneInfo();return{date:$('serviceDate').value,tour:$('tourSelect').value,boarding:$('boardingInput').value.trim(),names:$('namesInput').value.trim(),phone:phone.phone,phoneE164:phone.phoneE164,phoneCountry:phone.phoneCountry,people:Math.max(1,Number($('peopleInput').value)||1),amount:normalizeMoney($('amountInput').value)}}
function message(data,code){return `Código: ${code}\nData: ${brDate(data.date)}\nPasseio: ${data.tour}\nEmbarque: ${data.boarding}\nPassageiro(s): ${data.names}\nTelefone: ${data.phone}\nQuantidade: ${data.people} pessoa${data.people===1?'':'s'}\nValor a receber: ${currency.format(data.amount)}`}
function updatePreview(){const data=formData();$('nextCode').textContent=currentCode();const has=data.date||data.tour||data.boarding||data.names||data.phone||data.amount;if(!has){$('messagePreview').className='message-preview empty';$('messagePreview').textContent='Preencha os dados para visualizar a mensagem.';return}$('messagePreview').className='message-preview';$('messagePreview').textContent=message(data,currentCode())}
function syncPeopleFromNames(){const names=$('namesInput').value.trim();$('peopleInput').value=names?((names.match(/\//g)||[]).length+1):1;updatePreview()}
function maybeSaveLocation(name){if(!$('saveLocationCheck').checked||!name)return;const items=getLocations();if(items.some(x=>x.name.toLowerCase()===name.toLowerCase()))return;items.push({id:Date.now(),name,type:'Hotel / pousada',address:DEFAULT_MAP_CITY});write(LOCATIONS_KEY,items);renderLocations()}
function resetPhone(){if(phoneIti){phoneIti.setCountry('br');phoneIti.setNumber('')}else phoneInput.value='';const help=$('phoneHelp');help.textContent='Brasil selecionado por padrão. Use a bandeira para trocar de país.';help.classList.remove('phone-invalid','phone-valid')}
function resetRepasseForm(){editingRepasseId=null;$('repasseForm').reset();$('serviceDate').value=localToday();$('peopleInput').value=1;resetPhone();$('repasseForm').querySelector('button[type="submit"]').textContent='Salvar repasse';$('saveWhatsappButton').textContent='Salvar + abrir WhatsApp';updatePreview()}
function editRepasse(id){const item=getRepasses().find(x=>x.id===id);if(!item)return;editingRepasseId=id;$('serviceDate').value=item.date||localToday();$('tourSelect').value=item.tour||'';$('boardingInput').value=item.boarding||'';$('namesInput').value=item.names||'';if(phoneIti){if(item.phoneE164)phoneIti.setNumber(item.phoneE164);else{if(item.phoneCountry)phoneIti.setCountry(item.phoneCountry);phoneIti.setNumber(item.phone||'')}}else phoneInput.value=item.phone||'';$('peopleInput').value=item.people||1;$('amountInput').value=Number(item.amount||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});$('saveLocationCheck').checked=false;$('repasseForm').querySelector('button[type="submit"]').textContent='Salvar alterações';$('saveWhatsappButton').textContent='Salvar alterações + WhatsApp';activateTab('novo');updatePreview();setTimeout(()=>$('serviceDate').focus(),250)}
async function createRepasse(openWhatsapp){if(!$('repasseForm').reportValidity())return;if(!(await validatePhone()))return;const data=formData();let items=getRepasses();let item;if(editingRepasseId){const idx=items.findIndex(x=>x.id===editingRepasseId);if(idx<0)return;item={...items[idx],...data};if(openWhatsapp&&item.status==='Pendente')item.status='Enviado';items[idx]=item}else{const number=nextNumber();item={id:Date.now(),number,code:`REP-${String(number).padStart(5,'0')}`,...data,status:openWhatsapp?'Enviado':'Pendente',createdAt:new Date().toISOString()};items.unshift(item)}write(REPASSES_KEY,items);maybeSaveLocation(data.boarding);if(openWhatsapp)openWhatsApp(message(item,item.code));const wasEditing=Boolean(editingRepasseId);resetRepasseForm();renderHistory();toast(wasEditing?'Repasse atualizado.':(openWhatsapp?'Repasse salvo. Mensagem copiada para o WhatsApp.':'Repasse salvo.'))}

function renderHistory(){const q=$('historySearch').value.trim().toLowerCase();const status=$('historyStatus').value;const items=getRepasses().filter(x=>{const text=`${x.code} ${x.names} ${x.tour} ${x.phone} ${x.phoneE164||''} ${x.boarding}`.toLowerCase();return(!q||text.includes(q))&&(!status||x.status===status)});$('historyBody').innerHTML=items.map(x=>`<tr><td><strong>${x.code}</strong></td><td>${brDate(x.date)}</td><td>${escapeHtml(x.tour)}</td><td>${escapeHtml(x.boarding)}<small><a href="${mapUrl(locationMapQuery(x.boarding))}" target="_blank" rel="noopener">Ver no Maps</a></small></td><td>${escapeHtml(x.names)}</td><td>${x.people}</td><td><strong>${currency.format(x.amount)}</strong></td><td><select class="status-select" data-repasse-status-select="${x.id}" aria-label="Status de ${x.code}">${STATUS.map(s=>`<option value="${s}"${s===x.status?' selected':''}>${s}</option>`).join('')}</select></td><td><div class="repasse-row-actions"><button class="mini-button" data-repasse-edit="${x.id}">Editar</button><button class="mini-button maps" data-repasse-wa="${x.id}">WhatsApp</button><button class="mini-button" data-repasse-delete="${x.id}">Excluir</button></div></td></tr>`).join('');$('historyEmpty').style.display=items.length?'none':'block'}

$('repasseForm').addEventListener('submit',e=>{e.preventDefault();createRepasse(false)});$('saveWhatsappButton').addEventListener('click',()=>createRepasse(true));['serviceDate','tourSelect','boardingInput','phoneInput','peopleInput','amountInput'].forEach(id=>{$(id).addEventListener('input',updatePreview);$(id).addEventListener('change',updatePreview)});$('namesInput').addEventListener('input',syncPeopleFromNames);$('namesInput').addEventListener('change',syncPeopleFromNames);phoneInput.addEventListener('countrychange',()=>{const country=phoneIti?.getSelectedCountryData?.();const help=$('phoneHelp');help.textContent=country?.name?`${country.name} selecionado. Digite o número no formato local.`:'Digite o telefone.';help.classList.remove('phone-invalid','phone-valid');updatePreview()});$('copyMessageButton').addEventListener('click',async()=>{if($('messagePreview').classList.contains('empty'))return;await copyText($('messagePreview').textContent);toast('Mensagem copiada.')});
$('searchMapsButton').addEventListener('click',()=>{const q=$('boardingInput').value.trim();if(!q)return toast('Digite o local primeiro.');window.open(mapUrl(locationMapQuery(q)),'_blank')});

$('tourForm').addEventListener('submit',e=>{e.preventDefault();const name=$('newTourInput').value.trim();if(!name)return;const items=getTours();if(items.some(x=>x.toLowerCase()===name.toLowerCase()))return toast('Esse passeio já está cadastrado.');items.push(name);write(TOURS_KEY,items);$('newTourInput').value='';renderTours();toast('Passeio cadastrado.')});
$('tourList').addEventListener('click',e=>{const edit=e.target.dataset.tourEdit,del=e.target.dataset.tourDelete;if(edit){const old=decodeURIComponent(edit),novo=prompt('Novo nome do passeio:',old);if(novo===null||!novo.trim())return;const items=getTours();const idx=items.indexOf(old);if(idx>=0){items[idx]=novo.trim();write(TOURS_KEY,items);renderTours();toast('Passeio atualizado.')}}if(del){const name=decodeURIComponent(del);if(confirm(`Excluir "${name}"?`)){write(TOURS_KEY,getTours().filter(x=>x!==name));renderTours();toast('Passeio excluído.')}}});

$('newLocationMaps').addEventListener('click',()=>{const name=$('newLocationName').value.trim(),address=$('newLocationAddress').value.trim();if(!name&&!address)return toast('Digite um nome ou endereço.');window.open(mapUrl([name,address||DEFAULT_MAP_CITY].filter(Boolean).join(', ')),'_blank')});
$('locationForm').addEventListener('submit',e=>{e.preventDefault();const name=$('newLocationName').value.trim(),type=$('newLocationType').value,address=$('newLocationAddress').value.trim();const items=getLocations();if(items.some(x=>x.name.toLowerCase()===name.toLowerCase()))return toast('Esse local já está cadastrado.');items.push({id:Date.now(),name,type,address:address||DEFAULT_MAP_CITY});write(LOCATIONS_KEY,items);e.target.reset();renderLocations();toast('Local salvo.')});
$('locationList').addEventListener('click',e=>{const maps=Number(e.target.dataset.locationMaps),edit=Number(e.target.dataset.locationEdit),del=Number(e.target.dataset.locationDelete),items=getLocations();if(maps){const x=items.find(i=>i.id===maps);if(x)window.open(mapUrl([x.name,x.address||DEFAULT_MAP_CITY].filter(Boolean).join(', ')),'_blank')}if(edit){const x=items.find(i=>i.id===edit);if(!x)return;const name=prompt('Nome do local:',x.name);if(name===null||!name.trim())return;const address=prompt('Endereço ou referência:',x.address||DEFAULT_MAP_CITY);x.name=name.trim();x.address=(address||DEFAULT_MAP_CITY).trim();write(LOCATIONS_KEY,items);renderLocations();toast('Local atualizado.')}if(del){const x=items.find(i=>i.id===del);if(x&&confirm(`Excluir "${x.name}"?`)){write(LOCATIONS_KEY,items.filter(i=>i.id!==del));renderLocations();toast('Local excluído.')}}});

$('historyBody').addEventListener('click',e=>{const edit=Number(e.target.dataset.repasseEdit),wa=Number(e.target.dataset.repasseWa),del=Number(e.target.dataset.repasseDelete);let items=getRepasses();if(edit){editRepasse(edit);return}if(wa){const x=items.find(i=>i.id===wa);if(!x)return;if(x.status==='Pendente')x.status='Enviado';write(REPASSES_KEY,items);openWhatsApp(message(x,x.code));renderHistory()}if(del){const x=items.find(i=>i.id===del);if(x&&confirm(`Excluir ${x.code}?`)){write(REPASSES_KEY,items.filter(i=>i.id!==del));if(editingRepasseId===del)resetRepasseForm();renderHistory();updatePreview();toast('Repasse excluído.')}}});
$('historyBody').addEventListener('change',e=>{const id=Number(e.target.dataset.repasseStatusSelect);if(!id)return;const items=getRepasses();const item=items.find(x=>x.id===id);if(!item)return;item.status=e.target.value;write(REPASSES_KEY,items);renderHistory();toast(`Status alterado para ${item.status}.`)});
$('historySearch').addEventListener('input',renderHistory);$('historyStatus').addEventListener('change',renderHistory);

document.querySelectorAll('.repasse-tab').forEach(button=>button.addEventListener('click',()=>activateTab(button.dataset.tab)));
$('menuButton').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
$('todayLabel').textContent=todayFormat.format(new Date()).replace('.','');
renderTours();renderLocations();renderHistory();resetRepasseForm();