(function(){
  if(Array.isArray(STATUS)){
    STATUS.splice(0, STATUS.length, 'Pendente', 'Enviado', 'Realizado', 'Cancelado');
  }

  const items = typeof getRepasses === 'function' ? getRepasses() : [];
  let changed = false;

  items.forEach(item => {
    if(item.status === 'Finalizado'){
      item.status = 'Realizado';
      changed = true;
    }else if(item.status === 'Confirmado'){
      item.status = 'Enviado';
      changed = true;
    }
  });

  if(changed && typeof write === 'function'){
    write(REPASSES_KEY, items);
  }

  const filter = document.getElementById('historyStatus');
  if(filter){
    const selected = filter.value;
    filter.innerHTML = '<option value="">Todos os status</option>' + STATUS.map(status => `<option value="${status}">${status}</option>`).join('');
    if(STATUS.includes(selected)) filter.value = selected;
  }

  if(typeof renderHistory === 'function') renderHistory();
})();
