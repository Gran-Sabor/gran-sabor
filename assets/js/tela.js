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

/* ---------- Busca inteligente ----------
   Ignora acentos e maiúsculas; várias palavras = todas precisam aparecer
   (em qualquer ordem); números também acham CNPJ/CPF/código sem pontuação. */
const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function casaBusca(texto, q) {
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  if (!termos.length) return true;
  const h = normalizar(texto), hd = h.replace(/[^0-9a-z]/g, '');
  return termos.every(t => h.includes(t) || (/[0-9]/.test(t) && hd.includes(t.replace(/[^0-9a-z]/g, ''))));
}

/* ---------- Barra de filtros padrão: Empresa · Unidade · (período) · Busca ----------
   As 3 empresas sempre separadas. Começa pela unidade escolhida no topo. */
function barraFiltros(el, { aoMudar, periodo = false, unidade = true, placeholder = 'Buscar…' }) {
  const f = { empresa: '', unidade: '', busca: '', de: '', ate: '' };
  const un = unidadeAtual();
  if (un && un !== 'todas' && typeof UNIDADE_EMPRESA !== 'undefined') { f.unidade = un; f.empresa = UNIDADE_EMPRESA[un] || ''; }
  if (periodo) { const h = new Date(); f.de = new Date(h.getFullYear(), h.getMonth(), 1).toISOString().slice(0, 10); f.ate = new Date(h.getFullYear(), h.getMonth() + 1, 0).toISOString().slice(0, 10); }
  el.className = 'filtros';
  el.innerHTML = `
    <select class="campo" data-f="empresa" aria-label="Empresa"><option value="">Todas as empresas</option>${EMPRESAS.map(e => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select>
    ${unidade ? '<select class="campo" data-f="unidade" aria-label="Unidade"></select>' : ''}
    ${periodo ? `<input class="campo" type="date" data-f="de" aria-label="De"><input class="campo" type="date" data-f="ate" aria-label="Até">` : ''}
    <input class="campo busca" type="search" data-f="busca" placeholder="${esc(placeholder)}" aria-label="Buscar">`;
  const sel = n => el.querySelector(`[data-f="${n}"]`);
  const unidadesDe = emp => UNIDADES.filter(u => u.id !== 'todas' && (!emp || UNIDADE_EMPRESA[u.id] === emp));
  const montarUn = () => { if (!unidade) return; const s = sel('unidade');
    s.innerHTML = `<option value="">Todas as unidades</option>` + unidadesDe(f.empresa).map(u => `<option value="${u.id}">${esc(u.nome)}</option>`).join('');
    if (!unidadesDe(f.empresa).some(u => u.id === f.unidade)) f.unidade = ''; s.value = f.unidade; };
  montarUn(); sel('empresa').value = f.empresa;
  if (periodo) { sel('de').value = f.de; sel('ate').value = f.ate; }
  el.addEventListener('input', e => { const n = e.target.dataset.f; if (!n) return; f[n] = e.target.value; if (n === 'empresa') montarUn(); aoMudar(f); });
  aoTrocarUnidade(v => { f.unidade = v === 'todas' ? '' : v; f.empresa = f.unidade ? (UNIDADE_EMPRESA[f.unidade] || '') : f.empresa; sel('empresa').value = f.empresa; montarUn(); aoMudar(f); });
  document.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); sel('busca').focus(); } });
  return f;
}
// Linha pertence ao filtro? (empresa: id ou lista de ids; vazio = todas)
function noFiltro(f, { empresa, unidade } = {}) {
  if (f.empresa && empresa && !(Array.isArray(empresa) ? empresa.includes(f.empresa) : empresa === f.empresa)) return false;
  if (f.unidade && unidade && unidade !== f.unidade) return false;
  return true;
}

/* ---------- Exportar para planilha (CSV com ; e acentos certos no Excel) ---------- */
function exportarCSV(nome, cabecalho, linhas) {
  const cel = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const txt = '﻿' + [cabecalho, ...linhas].map(l => l.map(cel).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = nome + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fmtDoc = c => { c = String(c || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
    : c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c; };
