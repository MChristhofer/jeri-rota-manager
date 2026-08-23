(function(){
  const byId=id=>document.getElementById(id);

  function updateTourFilter(){
    const select=byId('historyTour');
    if(!select)return;
    const selected=select.value;
    const tours=[...new Set([
      ...(typeof getTours==='function'?getTours():[]),
      ...(typeof getRepasses==='function'?getRepasses().map(x=>x.tour).filter(Boolean):[])
    ])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    select.innerHTML='<option value="">Todos os passeios</option>'+tours.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    if(tours.includes(selected))select.value=selected;
  }

  function renderHistoryAdvanced(){
    updateTourFilter();

    const code=(byId('historyCode')?.value||'').trim().toLowerCase();
    const date=byId('historyDate')?.value||'';
    const tour=byId('historyTour')?.value||'';
    const status=byId('historyStatus')?.value||'';
    const q=(byId('historySearch')?.value||'').trim().toLowerCase();

    const items=getRepasses().filter(x=>{
      const generalText=`${x.names||''} ${x.phone||''} ${x.phoneE164||''} ${x.boarding||''}`.toLowerCase();
      const codeOk=!code||String(x.code||'').toLowerCase().includes(code);
      const dateOk=!date||x.date===date;
      const tourOk=!tour||x.tour===tour;
      const statusOk=!status||x.status===status;
      const generalOk=!q||generalText.includes(q);
      return codeOk&&dateOk&&tourOk&&statusOk&&generalOk;
    });

    const body=byId('historyBody');
    if(body){
      body.innerHTML=items.map(x=>`<tr><td><strong>${escapeHtml(x.code)}</strong></td><td>${brDate(x.date)}</td><td>${escapeHtml(x.tour)}</td><td>${escapeHtml(x.boarding)}<small><a href="${mapUrl(locationMapQuery(x.boarding))}" target="_blank" rel="noopener">Ver no Maps</a></small></td><td>${escapeHtml(x.names)}</td><td>${x.people}</td><td><strong>${currency.format(x.amount)}</strong></td><td><select class="status-select" data-repasse-status-select="${x.id}" aria-label="Status de ${escapeHtml(x.code)}">${STATUS.map(s=>`<option value="${s}"${s===x.status?' selected':''}>${s}</option>`).join('')}</select></td><td><div class="repasse-row-actions"><button class="mini-button" data-repasse-edit="${x.id}">Editar</button><button class="mini-button maps" data-repasse-wa="${x.id}">WhatsApp</button><button class="mini-button" data-repasse-delete="${x.id}">Excluir</button></div></td></tr>`).join('');
    }

    const empty=byId('historyEmpty');
    if(empty)empty.style.display=items.length?'none':'block';

    const count=byId('historyResultCount');
    if(count)count.textContent=`${items.length} ${items.length===1?'repasse encontrado':'repasses encontrados'}`;
  }

  window.renderHistory=renderHistoryAdvanced;

  ['historyCode','historySearch'].forEach(id=>byId(id)?.addEventListener('input',renderHistoryAdvanced));
  ['historyDate','historyTour','historyStatus'].forEach(id=>byId(id)?.addEventListener('change',renderHistoryAdvanced));

  byId('clearHistoryFilters')?.addEventListener('click',()=>{
    ['historyCode','historyDate','historyTour','historyStatus','historySearch'].forEach(id=>{const el=byId(id);if(el)el.value=''});
    renderHistoryAdvanced();
  });

  renderHistoryAdvanced();
})();