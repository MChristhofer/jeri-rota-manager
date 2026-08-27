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
          alert('A reserva foi removida deste navegador, mas não foi possível removê-la do banco. Atualize a página e tente novamente.');
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
        alert('As reservas foram removidas deste navegador, mas houve falha ao limpar o banco. Atualize a página antes de continuar.');
      }
    },0);
  });

  window.JeriCloudDelete={deleteReservation:deleteCloudReservation};
})();
