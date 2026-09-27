(function(){
  'use strict';

  const client=window.jeriSupabase;
  if(!client)return;

  const BUCKET='profile-avatars';
  const MAX_BYTES=5*1024*1024;
  const ACCEPTED=new Set(['image/jpeg','image/png','image/webp']);

  function ensureIcons(){
    if(document.querySelector('link[data-phosphor-icons]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css';
    link.dataset.phosphorIcons='1';
    document.head.appendChild(link);
  }

  function profileElements(){
    const root=document.querySelector('.profile-mini');
    return{
      root,
      avatar:root?.querySelector('[data-profile-avatar]')||null,
      image:root?.querySelector('[data-profile-avatar-image]')||null,
      icon:root?.querySelector('[data-profile-avatar-icon]')||null,
      input:root?.querySelector('[data-profile-avatar-input]')||null,
      email:root?.querySelector('[data-profile-email]')||null
    };
  }

  function setFallback(){
    const {image,icon}=profileElements();
    if(image){image.hidden=true;image.removeAttribute('src')}
    if(icon)icon.hidden=false;
  }

  function setImage(url){
    const {image,icon}=profileElements();
    if(!image)return;
    image.src=url;
    image.hidden=false;
    if(icon)icon.hidden=true;
  }

  async function loadProfile(user){
    const {email}=profileElements();
    if(email){
      email.textContent=user.email||'Usuário autenticado';
      email.title=user.email||'';
    }

    const {data,error}=await client
      .from('user_profiles')
      .select('avatar_path')
      .eq('user_id',user.id)
      .maybeSingle();

    if(error){
      console.warn('Não foi possível carregar a foto de perfil:',error);
      setFallback();
      return;
    }

    const path=data?.avatar_path;
    if(!path){setFallback();return}

    const signed=await client.storage.from(BUCKET).createSignedUrl(path,3600);
    if(signed.error||!signed.data?.signedUrl){
      console.warn('Não foi possível gerar a URL da foto de perfil:',signed.error);
      setFallback();
      return;
    }
    setImage(signed.data.signedUrl);
  }

  async function uploadAvatar(file,user){
    if(!file)return;
    if(!ACCEPTED.has(file.type)){
      alert('Use uma imagem JPG, PNG ou WEBP.');
      return;
    }
    if(file.size>MAX_BYTES){
      alert('A foto de perfil deve ter no máximo 5 MB.');
      return;
    }

    const {avatar}=profileElements();
    if(avatar){
      avatar.disabled=true;
      avatar.classList.add('is-uploading');
    }

    const path=`${user.id}/avatar`;
    try{
      const upload=await client.storage.from(BUCKET).upload(path,file,{
        upsert:true,
        cacheControl:'3600',
        contentType:file.type
      });
      if(upload.error)throw upload.error;

      const saved=await client.from('user_profiles').upsert({
        user_id:user.id,
        avatar_path:path,
        updated_at:new Date().toISOString()
      },{onConflict:'user_id'});
      if(saved.error)throw saved.error;

      const signed=await client.storage.from(BUCKET).createSignedUrl(path,3600);
      if(signed.error)throw signed.error;
      setImage(signed.data.signedUrl+`&v=${Date.now()}`);
    }catch(error){
      console.error('Falha ao atualizar foto de perfil:',error);
      alert('Não foi possível salvar a foto de perfil. Tente novamente.');
    }finally{
      if(avatar){
        avatar.disabled=false;
        avatar.classList.remove('is-uploading');
      }
    }
  }

  async function init(){
    ensureIcons();
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user)return;

    const {avatar,input}=profileElements();
    if(!avatar||!input)return;

    avatar.addEventListener('click',()=>input.click());
    avatar.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];
      input.value='';
      await uploadAvatar(file,user);
    });

    await loadProfile(user);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();