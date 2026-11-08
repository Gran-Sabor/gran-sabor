/* =====================================================================
   Gran Sabor · banco.js — ligação das telas com o banco (Supabase)
   O login é o mesmo da casca (fica guardado no navegador).
   Em modo demonstração, db fica null e as telas usam exemplos.
   ===================================================================== */
const db = (!MODO_DEMO && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Avisa a casca que algo mudou (ex.: unidades → recarregar o seletor do topo)
function avisarCasca(tipo) {
  if (window.parent !== window) window.parent.postMessage({ tipo }, location.origin);
}
