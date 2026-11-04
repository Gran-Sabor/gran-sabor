/* =====================================================================
   Gran Sabor · config.js — endereço do banco (Supabase)
   A chave "publishable" é pública por natureza: quem protege os dados são
   as regras de acesso (RLS) no banco. NUNCA coloque aqui a chave secreta.
   Enquanto SUPABASE_KEY estiver vazia, o sistema abre em MODO DEMONSTRAÇÃO
   (sem login e com números de exemplo).
   ===================================================================== */
const SUPABASE_URL = 'https://sayplpvhnoeytfnkbvpm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_04rpFKJwML3lVX2jnniYlA_kid2jgfN';
const MODO_DEMO = !SUPABASE_KEY;
