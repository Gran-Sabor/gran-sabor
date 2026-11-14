/* =====================================================================
   Gran Sabor · sistema.js — a casca: menu lateral, abas e alertas
   Cada tela abre numa aba (iframe). Trocar de aba não recarrega a tela,
   então nada do que estava sendo visto ou digitado se perde.
   As abas abertas ficam lembradas neste navegador.
   ===================================================================== */
const $ = id => document.getElementById(id);
const guardar = (k, v) => { try { localStorage.setItem('gs_' + k, JSON.stringify(v)); } catch {} };
const lembrar = (k, padrao) => { try { const v = localStorage.getItem('gs_' + k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };

let abas = [];          // [{ id }]
let ativa = 'inicio';
const quadros = {};     // id → iframe

/* ---------- Sessão ---------- */
async function iniciar() {
  let usuario = { nome: 'Demonstração', email: '' };
  if (!MODO_DEMO) {
    window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: { session } } = await db.auth.getSession();
    if (!session) { location.replace('index.html'); return; }
    // Só entra quem está cadastrado e ativo na tabela de usuários
    const { data: cad } = await db.from('usuarios').select('nome, ativo').eq('id', session.user.id).maybeSingle();
    if (!cad?.ativo) { await db.auth.signOut(); location.replace('index.html?sem-acesso'); return; }
    usuario = { nome: cad.nome || session.user.email.split('@')[0], email: session.user.email };
  }
  $('usuarioNome').textContent = usuario.nome;
  $('avatar').textContent = usuario.nome.slice(0, 2).toUpperCase();
  $('btnSair').onclick = sair;
  if (!MODO_DEMO) { $('avatar').onclick = $('usuarioNome').onclick = trocarSenha; $('usuarioNome').title = 'Trocar minha senha'; }

  if (!MODO_DEMO) await Promise.all([atualizarUnidades(), carregarProdutos()]);
  montarUnidades();
  montarMenu();
  abas = lembrar('abas', [{ id: 'inicio' }]).filter(a => acharTela(a.id));
  if (!abas.some(a => a.id === 'inicio')) abas.unshift({ id: 'inicio' });
  abas.forEach(a => criarQuadro(a.id));
  ativar(lembrar('ativa', 'inicio'));
  carregarAlertas();
}

async function sair() {
  if (!MODO_DEMO) await db.auth.signOut();
  location.replace('index.html');
}

/* ---------- Trocar a própria senha (clique no nome, no topo) ---------- */
function trocarSenha() {
  const v = document.createElement('div');
  v.className = 'veu';
  v.innerHTML = `<form class="janela" role="dialog" aria-modal="true" aria-labelledby="tSenha" novalidate>
    <div class="janela-cab"><h2 id="tSenha">Trocar minha senha</h2>
      <button type="button" class="btn btn-ico" data-fechar aria-label="Fechar">${icone('fechar')}</button></div>
    <div class="janela-form">
      <label for="ns1">Nova senha (mínimo 8 caracteres)</label><input id="ns1" type="password" class="campo" autocomplete="new-password">
      <label for="ns2">Repita a nova senha</label><input id="ns2" type="password" class="campo" autocomplete="new-password">
      <div class="login-msg" id="nsMsg" role="alert"></div></div>
    <div class="janela-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button type="submit" class="btn btn-pri">Salvar</button></div></form>`;
  const fim = () => { v.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') fim(); };
  const aviso = (t, ok) => { const m = v.querySelector('#nsMsg'); m.textContent = t; m.classList.toggle('ok', !!ok); };
  v.onclick = e => { if (e.target === v || e.target.closest('[data-fechar]')) fim(); };
  v.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const s1 = v.querySelector('#ns1').value, s2 = v.querySelector('#ns2').value;
    if (s1.length < 8) return aviso('A senha precisa ter pelo menos 8 caracteres.');
    if (s1 !== s2) return aviso('As duas senhas não são iguais.');
    const b = v.querySelector('.btn-pri'); b.disabled = true;
    const { error } = await db.auth.updateUser({ password: s1 });
    b.disabled = false;
    if (error) return aviso(/different|same/i.test(error.message) ? 'A senha nova precisa ser diferente da atual.' : 'Não foi possível salvar. Tente de novo.');
    aviso('Senha trocada.', true); setTimeout(fim, 1000);
  };
  document.addEventListener('keydown', tecla);
  document.body.appendChild(v);
  v.querySelector('#ns1').focus();
}

/* ---------- Unidade escolhida (vale para todas as telas) ---------- */
// Lê as unidades ativas do banco (nome e ordem podem mudar na tela Empresas e unidades)
async function atualizarUnidades() {
  const { data, error } = await db.from('unidades').select('codigo, nome, tipo').eq('ativo', true).order('ordem').order('nome');
  if (error || !data?.length) return;
  const lst = data.map(u => ({ id: u.codigo, nome: u.nome, tipo: u.tipo }));
  UNIDADES.splice(1, UNIDADES.length, ...lst);
  guardar('unidadesBanco', lst);
}
/* ---------- Cardápio real (produtos + preço por loja) ----------
   Lido uma vez aqui, antes de abrir as telas: todas as abas usam a mesma lista (dadoComum).
   Se a tabela ainda não existir no banco, as telas seguem com o exemplo. */
const COLUNAS_PRODUTOS = 'id, codigo, nome, categoria, vende_por, convenio, ativo, atualizado_em, produto_precos(preco, unidades(codigo))';
async function carregarProdutos() {
  let raiz = window;
  try { while (raiz.parent !== raiz && raiz.parent.location.origin === location.origin) raiz = raiz.parent; } catch {}
  const { data, error } = await db.from('produtos').select(COLUNAS_PRODUTOS).order('categoria').order('nome');
  if (error) { console.warn('Produtos ainda não estão no banco:', error.message); return; }
  (raiz.__gsDados || (raiz.__gsDados = {})).PRODUTOS_BANCO = data;
}
function montarUnidades() {
  const s = $('unidade');
  s.innerHTML = UNIDADES.map(u => `<option value="${u.id}">${esc(u.nome)}</option>`).join('');
  const escolhida = lembrar('unidade', 'todas');
  s.value = UNIDADES.some(u => u.id === escolhida) ? escolhida : 'todas';
  s.onchange = () => {
    guardar('unidade', s.value);
    Object.values(quadros).forEach(q => q.contentWindow?.postMessage({ tipo: 'unidade', valor: s.value }, '*'));
  };
}

/* ---------- Menu lateral ---------- */
function montarMenu() {
  const abertos = lembrar('gruposAbertos', []);
  $('menuLista').innerHTML = MENU.map(m => m.itens
    ? `<div class="menu-grupo${abertos.includes(m.grupo) ? ' aberto' : ''}" data-grupo="${esc(m.grupo)}">
         <button type="button" class="menu-grupo-cab">${icone(m.icone)}<span>${esc(m.grupo)}</span><span class="seta">${icone('seta', 14)}</span></button>
         <div class="menu-grupo-itens">${m.itens.map(i => itemMenu(i)).join('')}</div></div>`
    : `<div class="menu-grupo">${itemMenu(m, true)}</div>`).join('');

  $('menuLista').onclick = e => {
    const cab = e.target.closest('.menu-grupo-cab');
    if (cab) {
      const g = cab.parentElement; g.classList.toggle('aberto');
      guardar('gruposAbertos', [...document.querySelectorAll('.menu-grupo.aberto')].map(x => x.dataset.grupo));
      return;
    }
    const item = e.target.closest('.menu-item');
    if (item) { e.preventDefault(); abrir(item.dataset.id); document.querySelector('.casca').classList.remove('menu-aberto'); }
  };

  $('buscaMenu').oninput = e => {
    const q = normal(e.target.value);
    document.querySelectorAll('.menu-grupo').forEach(g => {
      let algum = false;
      g.querySelectorAll('.menu-item').forEach(i => { const ok = !q || normal(i.textContent).includes(q); i.classList.toggle('oculto', !ok); algum ||= ok; });
      g.classList.toggle('oculto', !algum);
      if (q && g.dataset.grupo) g.classList.add('aberto');
    });
  };
}
const normal = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function itemMenu(t, topo) {
  return `<a href="#" class="menu-item${t.arquivo ? '' : ' breve'}" data-id="${t.id}"${t.arquivo ? '' : ' title="Em construção"'}>${topo ? icone(t.icone) : ''}<span>${esc(t.nome)}</span></a>`;
}

/* ---------- Abas ---------- */
function criarQuadro(id) {
  const t = acharTela(id);
  const q = document.createElement('iframe');
  q.title = t.nome; q.src = enderecoTela(t); q.className = 'oculto';
  $('area').appendChild(q);
  quadros[id] = q;
}
function abrir(id) {
  if (!acharTela(id)) return;
  if (!abas.some(a => a.id === id)) { abas.push({ id }); criarQuadro(id); }
  ativar(id);
}
function fechar(id) {
  if (id === 'inicio') return;
  const i = abas.findIndex(a => a.id === id);
  abas.splice(i, 1);
  quadros[id]?.remove(); delete quadros[id];
  if (ativa === id) ativar(abas[Math.max(0, i - 1)].id); else desenharAbas();
}
function ativar(id) {
  if (!abas.some(a => a.id === id)) id = 'inicio';
  ativa = id;
  Object.entries(quadros).forEach(([k, q]) => q.classList.toggle('oculto', k !== id));
  document.querySelectorAll('.menu-item').forEach(i => i.classList.toggle('ativo', i.dataset.id === id));
  const g = document.querySelector(`.menu-item[data-id="${id}"]`)?.closest('.menu-grupo');
  if (g?.dataset.grupo) g.classList.add('aberto');
  document.title = acharTela(id).nome + ' · Gran Sabor';
  guardar('abas', abas); guardar('ativa', id);
  desenharAbas();
}
function desenharAbas() {
  $('abas').innerHTML = abas.map(a => {
    const t = acharTela(a.id);
    return `<div class="aba${a.id === ativa ? ' ativa' : ''}" data-id="${a.id}" role="tab" tabindex="0" title="${esc(t.nome)}">
      <span>${esc(t.nome)}</span>${a.id === 'inicio' ? '' : `<button type="button" class="fechar" aria-label="Fechar ${esc(t.nome)}">${icone('fechar', 12)}</button>`}</div>`;
  }).join('');
  document.querySelector('.aba.ativa')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function cliqueAbas(e) {
  const aba = e.target.closest('.aba'); if (!aba) return;
  if (e.target.closest('.fechar') || e.button === 1) { fechar(aba.dataset.id); return; }
  ativar(aba.dataset.id);
}

/* ---------- Alertas (popup) ---------- */
// Por enquanto, exemplos (com ou sem banco). Depois virão do banco (contas vencendo, notas pendentes, estoque baixo...).
const ALERTAS_EXEMPLO = [
  { nivel: 'perigo', titulo: '2 cupons fiscais em contingência', texto: 'Loja 2 · aguardando envio à SEFAZ há mais de 1 hora', tela: 'vendas_dia' },
  { nivel: 'alerta', titulo: '5 contas vencem hoje', texto: 'R$ 8.430,00 somando as unidades', tela: 'pagar' },
  { nivel: 'alerta', titulo: 'Estoque abaixo do mínimo', texto: 'Picanha, óleo de soja e 2 outros itens na Central de carnes', tela: 'posicao' },
  { nivel: 'info', titulo: 'Fechamento PJ em 2 dias', texto: '3 empresas conveniadas fecham a quinzena na sexta', tela: 'faturamento_pj' }
];
let alertas = [];
function carregarAlertas() {
  alertas = ALERTAS_EXEMPLO;
  const c = $('contAlertas');
  c.textContent = alertas.length; c.classList.toggle('oculto', !alertas.length);
  const hoje = new Date().toISOString().slice(0, 10);
  if (alertas.some(a => a.nivel === 'perigo') && lembrar('alertasVistos', '') !== hoje) mostrarAlertas();
}
function mostrarAlertas() {
  const v = document.createElement('div');
  v.className = 'veu';
  v.innerHTML = `<div class="janela" role="dialog" aria-modal="true" aria-labelledby="tAlertas">
    <div class="janela-cab">${icone('sino')}<h2 id="tAlertas">Pontos de atenção</h2><span class="etiqueta exemplo">exemplo</span>
      <button type="button" class="btn btn-ico" data-fechar aria-label="Fechar">${icone('fechar')}</button></div>
    <div class="janela-corpo">${alertas.length ? alertas.map((a, i) => `<div class="alerta-linha"><span class="marcador nv-${a.nivel}"></span>
      <div><b>${esc(a.titulo)}</b><small>${esc(a.texto)}</small></div><a href="#" class="acao" data-i="${i}">Abrir</a></div>`).join('')
      : '<div class="vazio">Nada pendente agora.</div>'}</div>
    <div class="janela-rodape"><button type="button" class="btn btn-pri" data-fechar>Ciente</button></div></div>`;
  const fim = () => { guardar('alertasVistos', new Date().toISOString().slice(0, 10)); v.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') fim(); };
  v.onclick = e => {
    if (e.target === v || e.target.closest('[data-fechar]')) return fim();
    const a = e.target.closest('.acao'); if (a) { e.preventDefault(); fim(); abrir(alertas[a.dataset.i].tela); }
  };
  document.addEventListener('keydown', tecla);
  document.body.appendChild(v);
  v.querySelector('.btn-pri').focus();
}

/* ---------- Pedidos vindos das telas (ex.: um indicador que abre outra tela) ---------- */
window.addEventListener('message', e => {
  if (e.origin !== location.origin) return;
  if (e.data?.tipo === 'abrir') abrir(e.data.id);
  if (e.data?.tipo === 'unidades' && !MODO_DEMO) atualizarUnidades().then(montarUnidades);
});

document.addEventListener('DOMContentLoaded', () => {
  $('abas').addEventListener('click', cliqueAbas);
  $('abas').addEventListener('auxclick', cliqueAbas);
  $('abas').addEventListener('keydown', e => { if (e.key === 'Enter') cliqueAbas(e); });
  $('btnAlertas').onclick = mostrarAlertas;
  $('btnMenu').onclick = () => document.querySelector('.casca').classList.toggle('menu-aberto');
  iniciar();
});
