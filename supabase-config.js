window.JERI_ROTA_SUPABASE = {
  url: 'https://euqixdlpkjajhigqwhvi.supabase.co',
  publishableKey: 'sb_publishable_D9hnQLDMekew4_jZWXa2BA_G3UF9TIP'
};

window.jeriSupabase = window.supabase.createClient(
  window.JERI_ROTA_SUPABASE.url,
  window.JERI_ROTA_SUPABASE.publishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
