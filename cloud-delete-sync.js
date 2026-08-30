(function(){
  const client=window.jeriSupabase;
  if(!client)return;

  const RESERVATIONS_KEY='jeri-rota-manager-reservas-v1';
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(RESERVATIONS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};

  async function deleteCloudReservation(snapshot){
    if(!snapshot)return;
    let query=client.from('reservations').delete();
    if(snapshot.cloudId)query=query.eq('id',snapshot.cloudId);
    else if(snapshot.reservationCode)query=query.eq('code',snapshot.reservationCode);
    else return;
    const {error}=await query;
    if(error)throw error;
  }

  async function restoreFromCloud(message){
    try{
      if(window.JeriCloudData?.fetchAndCache)await window.JeriCloudData.fetchAndCache();
      try{if(typeof getReservations==='function')reservations=getReservations();if(typeof renderAll==='function')renderAll()}catch{}
    }finally{
      if(message)alert(message);
    }
  }

  document.addEventListener('click',event=>{
    const deleteButton=event.target.closest?.('[data-delete]');
    if(deleteButton){
      const localId=String(deleteButton.dataset.delete||'');
      const before=read();
      const snapshot=before.find(r=>String(r.id)===localId)||{
        id:localId,
        cloudId:deleteButton.dataset.deleteCloud||'',
        reservationCode:''
      };
      setTimeout(async()=>{
        const stillExists=read().some(r=>String(r.id)===localId);
        if(stillExists)return;
        try{
          await deleteCloudReservation(snapshot);
          if(window.JeriCloudData?.fetchAndCache)await window.JeriCloudData.fetchAndCache();
        }catch(error){
          console.error('Falha ao excluir reserva do Supabase:',error);
          await restoreFromCloud('Não foi possível excluir a reserva no Supabase. A lista foi restaurada com os dados oficiais do banco.');
        }
      },0);
      return;
    }

    const clearButton=event.target.closest?.('#clearAllReservations');
    if(!clearButton)return;
    const before=read();
    if(!before.length)return;
    setTimeout(async()=>{
      if(read().length)return;
      try{
        for(const reservation of before)await deleteCloudReservation(reservation);
        if(window.JeriCloudData?.fetchAndCache)await window.JeriCloudData.fetchAndCache();
      }catch(error){
        console.error('Falha ao excluir todas as reservas do Supabase:',error);
        await restoreFromCloud('Não foi possível concluir a exclusão no Supabase. A lista foi restaurada com os dados oficiais do banco.');
      }
    },0);
  },true);

  window.JeriCloudDelete={deleteReservation:deleteCloudReservation};
})();
