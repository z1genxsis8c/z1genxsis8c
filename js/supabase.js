// js/supabase.js
const SUPABASE_URL = "https://tpnscbkrianwgjnauaav.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hrenBdw6Eqci8vtLOW5YsQ_GntLG8oh"; // Твой ключ sb_publishable_...

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
