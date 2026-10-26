// Isi dua nilai ini dari Supabase > Project Settings > API.
// "anon public key" memang aman ditaruh di sini (data tetap dikunci lewat login + RLS).
// JANGAN pernah taruh "service_role key" di file ini.
window.CAPO_CONFIG = {
  SUPABASE_URL: "ISI_PROJECT_URL",        // contoh: https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "ISI_ANON_PUBLIC_KEY"
};
