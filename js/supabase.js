// js/supabase.js
import { createSmartClient } from "supadns-js";

const SUPABASE_URL = "https://tpnscbkrianwgjnauaav.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hrenBdw6Eqci8vtLOW5YsQ_GntLG8oh";

// Используем "умный" клиент вместо стандартного
window.supabase = createSmartClient(SUPABASE_URL, SUPABASE_ANON_KEY);
