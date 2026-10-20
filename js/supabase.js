// js/supabase.js
const SUPABASE_URL = "https://supabase-proxy.vilya51aura.workers.dev";
const SUPABASE_ANON_KEY = "sb_publishable_hrenBdw6Eqci8vtLOW5YsQ_GntLG8oh"; // Оставь свой ключ без изменений

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
