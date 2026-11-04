/* =====================================================================
   Gran Sabor · tela.js — ajudas comuns a todas as telas (dentro das abas)
   ===================================================================== */
const $ = id => document.getElementById(id);
const reais = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v, casas = 0) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = v => numero(v, 1) + '%';
const dataBR = d => new Date(d).toLocaleDateString('pt-BR');

// Unidade escolhida no topo da casca (vale para todas as abas)
function unidadeAtual() { try { return JSON.parse(localStorage.getItem('gs_unidade')) || 'todas'; } catch { return 'todas'; } }
function aoTrocarUnidade(fn) { window.addEventListener('message', e => { if (e.data?.tipo === 'unidade') fn(e.data.valor); }); }

// Abre outra tela numa aba da casca
function abrirTela(id) {
  if (window.parent !== window) window.parent.postMessage({ tipo: 'abrir', id }, location.origin);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-abrir]');
  if (a) { e.preventDefault(); abrirTela(a.dataset.abrir); }
});
