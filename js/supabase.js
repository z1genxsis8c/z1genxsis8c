// js/supabase.js
const SUPABASE_URL = "https://supabase-proxy-cli.layero.app";
const SUPABASE_ANON_KEY = "sb_publishable_hrenBdw6Eqci8vtLOW5YsQ_GntLG8oh";

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
