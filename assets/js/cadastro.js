/* =====================================================================
   Gran Sabor · cadastro.js — motor das telas de cadastro
   Cada tela só descreve colunas, campos e regras; a lista, os filtros
   (empresa · unidade · busca), os indicadores, a exportação e o
   formulário em popup saem daqui. Por enquanto trabalha com DADOS DE
   EXEMPLO em memória (nada é gravado).
   ===================================================================== */
function montarCadastro(cfg) {
  // A lista é a mesma de todas as abas (dadoComum): nada de cópia própria que fica velha
  let lista = cfg.dados;
  let filtro;
  document.body.innerHTML = `<div class="tela">
    <div class="tela-cab"><h1>${esc(cfg.titulo)}</h1>${cfg.sub ? `<span class="sub">${esc(cfg.sub)}</span>` : ''}
      <div class="dir"><span class="etiqueta exemplo" title="Dados fictícios: nada é gravado">exemplo</span>
        <button type="button" class="btn" id="btnExportar" title="Baixar a lista filtrada em planilha">Exportar</button>
        <button type="button" class="btn btn-pri" id="btnNovo">+ ${esc(cfg.novoRotulo || 'Novo')}</button></div></div>
    <div id="filtros"></div>
    ${cfg.abas ? `<div class="abas-tela" id="abas">${cfg.abas.map((a, i) => `<button type="button" data-aba="${i}"${i ? '' : ' class="ativa"'}>${esc(a.nome)}</button>`).join('')}</div>` : ''}
    <section class="kpis" id="kpis"></section>
    <section class="cartao"><div class="cartao-cab"><h2 id="tituloLista">${esc(cfg.tituloLista || 'Lista')}</h2><span class="dir sub" id="contagem"></span></div>
      <div class="rolagem"><table class="tabela clicavel" id="tab"></table></div></section></div>`;
  let aba = 0;
  filtro = barraFiltros($('filtros'), { aoMudar: desenhar, unidade: cfg.porUnidade !== false, placeholder: cfg.buscaDica || 'Buscar… (atalho: /)' });

  const visiveis = () => lista.filter(l =>
    (!cfg.abas || cfg.abas[aba].filtro(l)) &&
    noFiltro(filtro, cfg.escopo ? cfg.escopo(l) : {}) &&
    casaBusca(cfg.colunas.map(c => c.busca ? c.busca(l) : c.fmt ? strip(c.fmt(l[c.campo], l)) : l[c.campo]).join(' ') + ' ' + (cfg.buscaExtra ? cfg.buscaExtra(l) : ''), filtro.busca));
  const strip = h => String(h ?? '').replace(/<[^>]*>/g, ' ');

  function desenhar() {
    const v = visiveis();
    $('kpis').innerHTML = (cfg.kpis ? cfg.kpis(v, lista, filtro) : []).map(([t, val, c]) =>
      `<div class="kpi"><div class="kpi-tit">${t}</div><div class="kpi-valor">${val}</div><div class="kpi-ctx">${c || ''}</div></div>`).join('');
    $('kpis').classList.toggle('oculto', !cfg.kpis);
    $('contagem').textContent = `${v.length} de ${lista.length}`;
    const cab = `<thead><tr>${cfg.colunas.map(c => `<th${c.num ? ' class="num"' : ''}>${esc(c.titulo)}</th>`).join('')}</tr></thead>`;
    const linha = l => `<tr data-id="${esc(l.id)}" tabindex="0"${l.ativo === false ? ' class="inativa"' : ''}>${cfg.colunas.map(c =>
      `<td${c.num ? ' class="num"' : ''}>${c.fmt ? c.fmt(l[c.campo], l) : (esc(l[c.campo]) || '<span class="sub">—</span>')}</td>`).join('')}</tr>`;
    let corpo = '';
    if (cfg.agrupar) {
      const grupos = {};
      v.forEach(l => (grupos[cfg.agrupar(l)] ||= []).push(l));
      corpo = Object.entries(grupos).map(([g, ls]) => `<tr class="grupo"><td colspan="${cfg.colunas.length}">${esc(g)} <span class="sub">${ls.length}</span></td></tr>${ls.map(linha).join('')}`).join('');
    } else corpo = v.map(linha).join('');
    $('tab').innerHTML = cab + `<tbody>${corpo || `<tr><td colspan="${cfg.colunas.length}" class="vazio">Nada encontrado com esses filtros.</td></tr>`}</tbody>`;
  }

  /* ---------- Formulário ---------- */
  function abrirForm(item) {
    const novo = !item;
    item = item || (cfg.novo ? cfg.novo(filtro) : { ativo: true });
    const foto = JSON.parse(JSON.stringify(item));
    const secoes = [...new Set(cfg.campos.map(c => c.secao || ''))];
    const campo = c => {
      const v = item[c.campo];
      const attrs = `name="${c.campo}" class="campo"${c.max ? ` maxlength="${c.max}"` : ''}${c.dica ? ` placeholder="${esc(c.dica)}"` : ''}${c.somenteLeitura && !novo ? ' readonly' : ''}`;
      let el;
      if (c.tipo === 'check') return `<label class="${c.larg || 'c3'} marcar"><input type="checkbox" name="${c.campo}"${v ? ' checked' : ''}> ${esc(c.titulo)}</label>`;
      if (c.tipo === 'select') { const ops = typeof c.opcoes === 'function' ? c.opcoes(item) : c.opcoes;
        el = `<select ${attrs}>${c.vazio ? `<option value="">${esc(c.vazio)}</option>` : ''}${ops.map(([k, n]) => `<option value="${esc(k)}"${String(v ?? '') === String(k) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`; }
      else if (c.tipo === 'multi') { const ops = typeof c.opcoes === 'function' ? c.opcoes(item) : c.opcoes;
        el = `<span class="multi" data-multi="${c.campo}">${ops.map(([k, n]) => `<label><input type="checkbox" value="${esc(k)}"${(v || []).includes(k) ? ' checked' : ''}> ${esc(n)}</label>`).join('')}</span>`; }
      else if (c.tipo === 'texto-longo') el = `<textarea ${attrs} rows="2">${esc(v)}</textarea>`;
      else el = `<input ${attrs} ${c.tipo === 'numero' || c.tipo === 'dinheiro' ? 'inputmode="decimal"' : ''} value="${esc(c.tipo === 'dinheiro' && v != null ? numero(v, 2) : c.tipo === 'doc' ? fmtDoc(v) : v ?? '')}">`;
      return `<label class="${c.larg || 'c4'}">${esc(c.titulo)}${c.obrig ? ' *' : ''}${el}</label>`;
    };
    const v = document.createElement('div');
    v.className = 'veu';
    v.innerHTML = `<form class="janela larga" role="dialog" aria-modal="true" novalidate>
      <div class="janela-cab"><h2>${novo ? esc(cfg.novoRotulo || 'Novo') : esc(cfg.tituloItem ? cfg.tituloItem(item) : item.nome)}</h2>
        <button type="button" class="btn btn-ico" data-fechar aria-label="Fechar">${icone('fechar')}</button></div>
      <div class="form">${secoes.map(s => `<fieldset>${s ? `<legend>${esc(s)}</legend>` : ''}<div class="form-grade">${cfg.campos.filter(c => (c.secao || '') === s).map(campo).join('')}</div></fieldset>`).join('')}
        ${cfg.rodapeForm ? `<div class="form-nota">${cfg.rodapeForm(item)}</div>` : ''}
        <div class="login-msg" id="fMsg" role="alert"></div></div>
      <div class="janela-rodape"><span class="sub">Exemplo: as alterações somem ao recarregar</span>
        <button type="button" class="btn" data-fechar>Cancelar</button><button type="submit" class="btn btn-pri">Salvar</button></div></form>`;
    const f = v.querySelector('form');
    const fim = () => { v.remove(); document.removeEventListener('keydown', tecla); };
    const tecla = e => { if (e.key === 'Escape') fim(); };
    v.onclick = e => { if (e.target === v || e.target.closest('[data-fechar]')) fim(); };
    f.onsubmit = e => {
      e.preventDefault();
      const d = {};
      cfg.campos.forEach(c => {
        if (c.tipo === 'multi') { d[c.campo] = [...f.querySelectorAll(`[data-multi="${c.campo}"] input:checked`)].map(i => i.value); return; }
        const el = f.elements[c.campo]; if (!el) return;
        if (c.tipo === 'check') d[c.campo] = el.checked;
        else if (c.tipo === 'numero' || c.tipo === 'dinheiro') d[c.campo] = el.value.trim() === '' ? null : Number(el.value.replace(/\./g, '').replace(',', '.'));
        else if (c.tipo === 'doc') d[c.campo] = el.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
        else d[c.campo] = el.value.trim();
      });
      const faltou = cfg.campos.find(c => c.obrig && (d[c.campo] == null || d[c.campo] === '' || (Array.isArray(d[c.campo]) && !d[c.campo].length)));
      const erro = faltou ? `Preencha: ${faltou.titulo}.` : cfg.validar ? cfg.validar(d, item, lista) : '';
      // Alguém mudou este cadastro em outra aba enquanto o formulário estava aberto? Não sobrescreve.
      const mudou = !novo && mudouDesde(foto, lista.find(x => x.id === item.id), Object.keys(foto), 'Este cadastro');
      if (erro || mudou) { f.querySelector('#fMsg').textContent = erro || mudou; return; }
      if (novo) lista.unshift({ ...d, id: cfg.gerarId ? cfg.gerarId(d) : 'n' + Date.now() });
      else Object.assign(lista.find(x => x.id === item.id), d);
      fim(); desenhar(); if (cfg.tabela) avisarMudanca(cfg.tabela);
    };
    document.addEventListener('keydown', tecla);
    document.body.appendChild(v);
    f.querySelector('input:not([readonly]),select')?.focus();
  }

  // Outra aba mudou estes dados (ou algo de que eles dependem): redesenha sozinho
  if (cfg.tabela) vigiarDados([cfg.tabela, ...(cfg.depende || [])], desenhar);
  $('btnNovo').onclick = () => abrirForm();
  $('btnExportar').onclick = () => exportarCSV(cfg.arquivoCSV || cfg.titulo, cfg.colunas.map(c => c.titulo),
    visiveis().map(l => cfg.colunas.map(c => c.csv ? c.csv(l) : strip(c.fmt ? c.fmt(l[c.campo], l) : l[c.campo]).replace(/\s+/g, ' ').trim())));
  $('tab').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) abrirForm(lista.find(l => String(l.id) === tr.dataset.id)); });
  $('tab').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.closest('tr[data-id]')?.click(); });
  $('abas')?.addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (!b) return;
    aba = +b.dataset.aba; $('abas').querySelectorAll('button').forEach(x => x.classList.toggle('ativa', x === b)); desenhar(); });
  desenhar();
}

// Etiquetas e formatos usados por várias telas
const sim = v => v ? '<span class="etiqueta completa">sim</span>' : '<span class="sub">—</span>';
const etqEmpresas = ids => !ids || !ids.length || ids.length === EMPRESAS.length ? '<span class="etiqueta">todas</span>'
  : ids.map(id => `<span class="etiqueta emp" style="--c:${(EMPRESAS.find(e => e.id === id) || {}).cor}">${esc(nomeEmpresa(id))}</span>`).join(' ');
const etqEmpresa = id => id ? `<span class="etiqueta emp" style="--c:${(EMPRESAS.find(e => e.id === id) || {}).cor}">${esc(nomeEmpresa(id))}</span>` : '<span class="etiqueta">todas</span>';

/* ---------- Popup genérico para telas próprias (pagar, receber, XML…) ---------- */
// aoSalvar(form) devolve texto de erro ou nada; depois(veu) roda após abrir
function janela(titulo, corpo, botao, aoSalvar, depois) {
  const v = document.createElement('div'); v.className = 'veu';
  v.innerHTML = `<form class="janela larga" role="dialog" aria-modal="true" novalidate><div class="janela-cab"><h2>${esc(titulo)}</h2>
    <button type="button" class="btn btn-ico" data-fechar aria-label="Fechar">${icone('fechar')}</button></div>
    <div class="form">${corpo}<div class="login-msg" id="fMsg" role="alert"></div></div>
    <div class="janela-rodape"><span class="sub">${esc(janela.nota)}</span><button type="button" class="btn" data-fechar>Cancelar</button><button type="submit" class="btn btn-pri">${esc(botao)}</button></div></form>`;
  const fim = () => { v.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') fim(); };
  v.onclick = e => { if (e.target === v || e.target.closest('[data-fechar]')) fim(); };
  // aoSalvar devolve o texto do erro (ou nada); pode ser assíncrona (gravar no banco)
  v.querySelector('form').onsubmit = async e => {
    e.preventDefault(); const b = v.querySelector('.btn-pri'); if (b.disabled) return; b.disabled = true;
    let erro; try { erro = await aoSalvar(e.target); } catch (x) { erro = 'Não foi possível gravar: ' + (x?.message || x) + '. Nada foi alterado; tente de novo.'; }
    b.disabled = false; if (erro) v.querySelector('#fMsg').textContent = erro; else fim(); };
  document.addEventListener('keydown', tecla); document.body.appendChild(v);
  if (depois) depois(v);
  v.querySelector('input:not([readonly]),select')?.focus();
  return v;
}

janela.nota = 'Exemplo: nada é gravado';   // telas ligadas ao banco trocam o aviso do rodapé
