/* =====================================================================
   Gran Sabor · financeiro.js — financeiro ligado ao banco
   Usado por contas a pagar, contas a receber, extrato/conciliação,
   categorias financeiras e contas bancárias.
   - Os dados vêm da casca (dados-banco.js): uma lista só para todas as abas,
     ao vivo pelo Supabase Realtime. Aqui só se lê, converte e grava.
   - Importação do fluxo de caixa (planilha da consultoria): recebimentos
     viram contas a receber recebidas (só o valor recebido; o vendido fica
     vazio) e pagamentos viram contas a pagar pagas no dia, com categoria.
   Sem banco (modo demonstração) as telas seguem com os dados de exemplo.
   ===================================================================== */
const FIN = (() => {
  const cb = () => { try { return casca().dadosBanco || null; } catch { return null; } };
  const L = t => cb()?.lista(t) || [];

  // Banco disponível e tabelas do financeiro publicadas? (senão: exemplo)
  async function usar() {
    if (!db || !cb()) return false;
    try { await cb().garantir('unidades', 'categorias_financeiras', 'contas_bancarias'); return true; }
    catch (e) { console.warn('Financeiro ainda não está no banco:', e.message); return false; }
  }
  const garantir = (...t) => cb().garantir(...t);
  const gravou = (...t) => cb().gravou(...t);

  /* ---------- Unidades, empresas, categorias, contas ---------- */
  const unidades = () => L('unidades');
  const unidade = id => unidades().find(u => u.id === id) || {};
  const unidadePorCodigo = cod => unidades().find(u => u.codigo === cod) || {};
  const codUnidade = id => unidade(id).codigo || '';
  const empresaDaUnidade = id => UNIDADE_EMPRESA[codUnidade(id)] || '';
  const categorias = () => L('categorias_financeiras');
  const categoria = id => categorias().find(c => c.id === id) || {};
  const nomeCategoria = id => { const c = categoria(id); return c.nome ? c.nome : 'Sem categoria'; };
  const contas = () => L('contas_bancarias');
  const conta = id => contas().find(c => c.id === id) || {};
  const nomeConta = id => conta(id).apelido || '';
  const empresaDaConta = c => c.unidade_id ? empresaDaUnidade(c.unidade_id) : '';

  /* ---------- Números e datas ---------- */
  // "1.234,56" / "1234.56" / "R$ -12,30" / 12.3 → número
  const num = x => {
    if (typeof x === 'number') return x;
    let s = String(x ?? '').replace(/[R$\s]/g, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    return Number(s);
  };
  const centavos = v => Math.round(v * 100) / 100;
  const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dataBRIso = d => d ? d.split('-').reverse().join('/') : '';

  /* ---------- Leitor de planilhas (carregado só quando precisa) ---------- */
  const CDN_XLSX = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const carregarXlsx = () => window.XLSX ? Promise.resolve() : new Promise((ok, falha) => {
    const s = document.createElement('script'); s.src = CDN_XLSX; s.onload = ok;
    s.onerror = () => falha(new Error('não foi possível abrir o leitor de planilhas (sem internet?)')); document.head.appendChild(s); });

  /* =====================================================================
     FLUXO DE CAIXA (planilha da consultoria)
     Uma aba por loja (S1, S2, S3...), uma coluna por dia, uma linha por conta.
     Linhas de soma (fórmula com referência a outras células) NÃO entram:
     a própria planilha tem somas erradas (totais que deixam blocos de fora
     ou somam o recebimento junto). Entra só o valor digitado em cada célula;
     "=120+112" vira dois pagamentos (120 e 112), como foram feitos.
     Colunas de total do mês (data repetida) ficam de fora.
     ===================================================================== */
  const SECOES = {
    'recebimento': { tipo: 'receita' },
    'pagamentos': { grupo: 'Outros pagamentos', dre: 'Despesas', n: 12 },
    'impostos': { grupo: 'Impostos', dre: 'Impostos', n: 2 },
    'cmv': { grupo: 'CMV', dre: 'Custos · Mercadoria', n: 3 },
    'folha de pagamento': { grupo: 'Folha de pagamento', dre: 'Custos · Pessoal', n: 4 },
    'despesas fixas': { grupo: 'Despesas fixas', dre: 'Despesas', n: 5, natureza: 'fixa' },
    'manutencao': { grupo: 'Manutenção', dre: 'Despesas', n: 6 },
    'veiculos': { grupo: 'Veículos', dre: 'Despesas', n: 7 },
    'mkt': { grupo: 'Marketing', dre: 'Despesas', n: 8 },
    'bancario': { grupo: 'Bancário', dre: 'Despesas', n: 9 },
    'dividas anteriores': { grupo: 'Dívidas anteriores', dre: 'Passivo anterior', n: 10 },
    'investimento': { grupo: 'Investimentos', dre: 'Investimentos', n: 11 }
  };
  const SUBGRUPOS = { 'proteina pista': 'Proteína pista', 'proteina churrasco': 'Proteína churrasco', 'hort fruit': 'Hortifrúti',
    'bebidas': 'Bebidas', 'agregados': 'Agregados', 'caixa economica': 'Caixa Econômica', 'stoni': 'Stone', 'produtos': '' };
  const PULAR = ['administrativo', 'total de recebimento', 'total de pagamento', 'saldo disponivel bancario'];
  const GRUPO_RECEITA = { grupo: 'Receitas', dre: 'Vendas brutas', n: 1 };
  const NOME_RECEITA = 'Vendas nas lojas (recebido)';
  const chaveTxt = s => normalizar(s).replace(/\s+/g, ' ').trim();
  const temRef = f => /(^|[^A-Za-z])\$?[A-Z]{1,3}\$?\d+/.test(f);
  const limpo = s => String(s ?? '').replace(/\s+/g, ' ').trim();

  function lerAbaFluxo(ws) {
    const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const cel = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    // Cabeçalho: datas na linha 1; data repetida/anterior = coluna de total do mês
    const dias = []; let ant = '';
    for (let c = 1; c <= ref.e.c; c++) {
      const x = cel(0, c); if (!x || typeof x.v !== 'number') continue;
      const p = XLSX.SSF.parse_date_code(x.v); if (!p || p.y < 2000) continue;
      const d = iso(p.y, p.m, p.d); if (d <= ant) continue; ant = d; dias.push([c, d]);
    }
    if (!dias.length) return null;
    const rot = r => limpo(cel(r, 0)?.v);
    if (!/^recebimento/.test(chaveTxt(rot(1)))) return null;
    const itens = [], ignorados = { negativos: 0, texto: 0 };
    let secao = null, sub = '', subFim = -1;
    for (let r = 1; r <= ref.e.r; r++) {
      const nome = rot(r), k = chaveTxt(nome);
      if (PULAR.includes(k)) continue;
      // Linha de bloco (CMV, FOLHA...) ou de subgrupo (PROTEINA PISTA...): normalmente só tem somas,
      // mas se alguém digitou um valor direto nela, ele entra como "sem detalhe" do bloco
      let rotulo = nome;
      // só é cabeçalho se a linha tiver soma (em VEÍCULOS há uma linha "Manutenção" que é lançamento)
      const ehSoma = dias.some(([c]) => cel(r, c)?.f && temRef(cel(r, c).f));
      if (SECOES[k] && (ehSoma || !secao)) { secao = SECOES[k]; sub = ''; subFim = -1; rotulo = 'Sem detalhe'; }
      else if (k in SUBGRUPOS && ehSoma) {
        sub = SUBGRUPOS[k];
        // as linhas do subgrupo são as da soma dele (SUM(C23:C27)); depois delas, volta ao bloco
        const f = dias.map(([c]) => cel(r, c)?.f).find(Boolean) || '';
        const m = /SUM\(\$?[A-Z]+\$?(\d+):\$?[A-Z]+\$?(\d+)\)/i.exec(f);
        subFim = m ? Number(m[2]) - 1 : r;   // linha da planilha (1, 2...) → índice (0, 1...)
        rotulo = 'sem detalhe';
      } else if (r > subFim) sub = '';
      if (!secao) continue;
      if (secao.tipo === 'receita' && rotulo === 'Sem detalhe') continue;   // RECEBIMENTO é a soma das formas
      for (const [c, data] of dias) {
        const x = cel(r, c); if (!x || x.v == null || x.v === '') continue;
        let partes;
        if (x.f) {
          if (temRef(x.f)) continue;                                   // soma de outras linhas: não é lançamento
          partes = /^[\d.\s]+(\+[\d.\s]+)*$/.test(x.f) ? x.f.split('+').map(Number) : [Number(x.v)];
        } else if (typeof x.v === 'number') partes = [x.v];
        else { ignorados.texto++; continue; }
        partes.forEach((v, i) => {
          v = centavos(v); if (!v) return;
          if (v < 0) { ignorados.negativos++; return; }
          itens.push(secao.tipo === 'receita'
            ? { tipo: 'receita', data, forma: rotulo || 'Outros', valor: v }
            : { tipo: 'despesa', data, grupo: secao.grupo, sec: secao, nome: sub ? `${sub} · ${rotulo || 'sem nome'}` : (rotulo || 'Sem nome na planilha'), valor: v, parte: i });
        });
      }
    }
    return { itens, ignorados, de: dias[0][1], ate: dias[dias.length - 1][1] };
  }

  async function lerFluxo(arquivo) {
    await carregarXlsx();
    const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellFormula: true });
    const abas = [];
    wb.SheetNames.forEach(nome => {
      const lida = lerAbaFluxo(wb.Sheets[nome]); if (!lida || !lida.itens.length) return;
      abas.push({ nome, ...lida, consolidado: /consolid/i.test(nome) });
    });
    if (!abas.length) throw new Error('não achei abas no formato do fluxo de caixa (datas na linha 1 e "RECEBIMENTO" na linha 2)');
    return abas;
  }

  // Monta as linhas para o banco. Recebimentos: um por dia × forma. Pagamentos: um por valor digitado.
  function montarFluxo(aba, unidadeId, catId) {
    const hoje = hojeISO(), cod = codUnidade(unidadeId);
    const rec = {};
    aba.itens.filter(i => i.tipo === 'receita').forEach(i => { const k = i.data + '|' + i.forma; rec[k] = centavos((rec[k] || 0) + i.valor); });
    const receber = Object.entries(rec).map(([k, valor]) => { const [data, forma] = k.split('|'), ja = data <= hoje;
      return { unidade_id: unidadeId, categoria_id: catId(GRUPO_RECEITA.grupo, NOME_RECEITA, 'receita'), forma, documento: 'Fluxo de caixa',
        valor, vencimento: data, recebido_em: ja ? data : null, valor_recebido: ja ? valor : null, origem: 'fluxo',
        chave_importacao: `fluxo|rec|${cod}|${data}|${chaveTxt(forma)}` }; });
    const pagar = aba.itens.filter(i => i.tipo === 'despesa').map(i => { const ja = i.data <= hoje;
      return { unidade_id: unidadeId, categoria_id: catId(i.grupo, i.nome, 'despesa'), documento: 'Fluxo de caixa',
        valor: i.valor, vencimento: i.data, pago_em: ja ? i.data : null, valor_pago: ja ? i.valor : null, origem: 'fluxo',
        chave_importacao: `fluxo|pag|${cod}|${i.data}|${chaveTxt(i.grupo)}|${chaveTxt(i.nome)}|${i.parte}` }; });
    // a mesma célula pode repetir o mesmo valor ("=112+112"): a parte (posição) já diferencia
    return { receber, pagar };
  }

  // Categorias que faltam: cria com código no bloco certo (3.xx para CMV, 4.xx para folha...)
  async function criarCategorias(abas) {
    const precisa = new Map();
    abas.forEach(a => a.itens.forEach(i => {
      const [grupo, nome, tipo, sec] = i.tipo === 'receita' ? [GRUPO_RECEITA.grupo, NOME_RECEITA, 'receita', GRUPO_RECEITA] : [i.grupo, i.nome, 'despesa', i.sec];
      precisa.set(`${tipo}|${chaveTxt(grupo)}|${chaveTxt(nome)}`, { grupo, nome, tipo, sec });
    }));
    const existe = new Map(categorias().map(c => [`${c.tipo}|${chaveTxt(c.grupo)}|${chaveTxt(c.nome)}`, c]));
    const usados = new Set(categorias().map(c => c.codigo));
    const novas = [];
    for (const [k, c] of precisa) {
      if (existe.has(k)) continue;
      let s = 1, codigo; do codigo = `${c.sec.n}.${String(s++).padStart(2, '0')}`; while (usados.has(codigo));
      usados.add(codigo);
      novas.push({ codigo, nome: c.nome.slice(0, 80), grupo: c.grupo, tipo: c.tipo, dre: c.sec.dre, natureza: c.sec.natureza || 'variavel', origem: 'fluxo' });
    }
    if (novas.length) {
      const { error } = await db.from('categorias_financeiras').insert(novas);
      if (error) throw error;
    }
    await gravou('categorias_financeiras');
    const mapa = new Map(categorias().map(c => [`${c.tipo}|${chaveTxt(c.grupo)}|${chaveTxt(c.nome)}`, c.id]));
    return { criadas: novas.length, catId: (g, n, t) => mapa.get(`${t}|${chaveTxt(g)}|${chaveTxt(n)}`) || null };
  }

  async function gravarEmLotes(tabela, linhas, progresso, rotulo) {
    const T = 500;
    for (let i = 0; i < linhas.length; i += T) {
      const { error } = await db.from(tabela).upsert(linhas.slice(i, i + T), { onConflict: 'chave_importacao' });
      if (error) throw new Error(`${rotulo}: ${error.message}`);
      progresso(`${rotulo}: ${numero(Math.min(i + T, linhas.length))} de ${numero(linhas.length)}…`);
    }
  }

  // Tela de importação: mostra o que foi lido, escolhe a unidade de cada aba e grava
  async function importarFluxo(arquivo, aoTerminar) {
    let abas;
    try { abas = await lerFluxo(arquivo); }
    catch (e) { return janela('Importar fluxo de caixa', `<p>Não foi possível ler <b>${esc(arquivo.name)}</b>: ${esc(e.message)}.</p>`, 'Fechar', () => ''); }
    const lojas = unidades().filter(u => u.ativo !== false);
    const padrao = a => { if (a.consolidado) return ''; const n = (/(\d+)\s*$/.exec(a.nome) || [])[1];
      return (lojas.find(u => u.codigo === 'loja' + n) || {}).id || ''; };
    const soma = (l, t) => centavos(l.filter(i => i.tipo === t).reduce((s, i) => s + i.valor, 0));
    const lin = a => `<tr><td><b>${esc(a.nome)}</b>${a.consolidado ? '<br><small class="sub">soma das lojas: importar duplicaria</small>' : ''}</td>
      <td><select class="campo" name="un_${esc(a.nome)}"><option value="">Não importar</option>${lojas.map(u => `<option value="${u.id}"${u.id === padrao(a) ? ' selected' : ''}>${esc(u.nome)}</option>`).join('')}</select></td>
      <td class="mono">${dataBRIso(a.de)} a ${dataBRIso(a.ate)}</td>
      <td class="num">${reais(soma(a.itens, 'receita'))}</td>
      <td class="num">${reais(soma(a.itens, 'despesa'))}<br><small class="sub">${numero(a.itens.filter(i => i.tipo === 'despesa').length)} pagamentos</small></td></tr>`;
    const v = janela(`Importar fluxo de caixa · ${arquivo.name}`, `
      <p class="sub">Cada aba é uma loja. Entra só o valor digitado em cada célula do dia (as somas da planilha ficam de fora).
        Recebimentos viram <b>contas a receber já recebidas</b> por dia e forma (só o recebido: a planilha não traz o vendido).
        Pagamentos viram <b>contas a pagar já pagas</b> no dia, com a categoria da linha. O fornecedor fica em branco (a planilha não traz).
        Importar de novo o mesmo arquivo não duplica: atualiza.</p>
      <div class="rolagem"><table class="tabela"><thead><tr><th>Aba</th><th>Unidade</th><th>Período</th><th class="num">Recebido</th><th class="num">Pago</th></tr></thead>
        <tbody>${abas.map(lin).join('')}</tbody></table></div>
      <div class="form-nota" id="impProgresso"></div>`, 'Importar', async f => {
      const escolhidas = abas.map(a => ({ a, un: f.elements['un_' + a.nome]?.value })).filter(x => x.un);
      if (!escolhidas.length) return 'Escolha a unidade de pelo menos uma aba.';
      const uns = escolhidas.map(x => x.un);
      if (new Set(uns).size !== uns.length) return 'Duas abas estão indo para a mesma unidade. Confira.';
      const prog = t => { v.querySelector('#impProgresso').textContent = t; };
      try {
        prog('Conferindo categorias…');
        const { criadas, catId } = await criarCategorias(escolhidas.map(x => x.a));
        let nr = 0, np = 0;
        for (const { a, un } of escolhidas) {
          const { receber, pagar } = montarFluxo(a, un, catId);
          await gravarEmLotes('contas_receber', receber, prog, `${a.nome} · recebimentos`);
          await gravarEmLotes('contas_pagar', pagar, prog, `${a.nome} · pagamentos`);
          nr += receber.length; np += pagar.length;
        }
        prog('Atualizando as telas…');
        await gravou('contas_receber', 'contas_pagar');
        aoTerminar?.(`Fluxo de caixa importado: ${numero(nr)} recebimentos e ${numero(np)} pagamentos em ${escolhidas.map(x => esc(unidade(x.un).nome)).join(', ')}${criadas ? `; ${criadas} categoria(s) criada(s)` : ''}.`);
      } catch (e) {
        await gravou('contas_receber', 'contas_pagar').catch(() => {});
        return 'Parou no meio: ' + e.message + '. O que entrou já aparece nas telas; importe de novo para completar (não duplica).';
      }
    });
  }

  /* =====================================================================
     EXTRATO BANCÁRIO (OFX do banco ou CSV)
     CSV: precisa das colunas Data, Histórico e Valor (Saldo, Documento,
     Favorecido e Hora são aproveitados se vierem). Valor com "D" ou sinal
     de menos = saída. Cada linha ganha uma chave para não duplicar.
     ===================================================================== */
  function lerOFX(txt) {
    const tag = (b, t) => (new RegExp(`<${t}>([^<\\r\\n]*)`, 'i').exec(b) || [])[1]?.trim() || '';
    return [...txt.matchAll(/<STMTTRN>([\s\S]*?)(<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi)].map(m => {
      const b = m[1], d = tag(b, 'DTPOSTED');
      return { data: iso(d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)), hora: d.length >= 14 ? `${d.slice(8, 10)}:${d.slice(10, 12)}:${d.slice(12, 14)}` : null,
        documento: tag(b, 'CHECKNUM') || tag(b, 'REFNUM'), historico: tag(b, 'MEMO') || tag(b, 'TRNTYPE'), favorecido: tag(b, 'NAME'), cpf_cnpj: '',
        valor: centavos(num(tag(b, 'TRNAMT'))), saldo: null, fitid: tag(b, 'FITID') };
    });
  }
  function lerCSV(txt) {
    const sep = (txt.split('\n')[0].match(/;/g) || []).length >= (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const linhas = txt.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()).map(l => {
      const out = []; let cur = '', q = false;
      for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; }
      out.push(cur); return out.map(s => s.trim());
    });
    const cab = linhas[0].map(chaveTxt), col = (...n) => cab.findIndex(c => n.some(x => c === x || c.startsWith(x)));
    const c = { data: col('data'), hora: col('hora'), doc: col('documento', 'nr. doc', 'doc'), hist: col('historico', 'descricao', 'lancamento'),
      fav: col('favorecido', 'nome'), cpf: col('cpf'), valor: col('valor'), saldo: col('saldo') };
    if (c.data < 0 || c.valor < 0) throw new Error('o CSV precisa das colunas "Data" e "Valor"');
    return linhas.slice(1).map(l => {
      const dt = /(\d{2})\/(\d{2})\/(\d{4})(?:\D+(\d{2}:\d{2}(?::\d{2})?))?/.exec(l[c.data]) || /(\d{4})-(\d{2})-(\d{2})/.exec(l[c.data]);
      if (!dt) return null;
      const data = dt[3].length === 4 ? iso(dt[3], dt[2], dt[1]) : iso(dt[1], dt[2], dt[3]);
      const sinal = s => { s = String(s || ''); const neg = /D\s*$/i.test(s) || /^-/.test(s.trim()); const v = Math.abs(num(s.replace(/[CD]\s*$/i, ''))); return neg ? -v : v; };
      const valor = centavos(sinal(l[c.valor]));
      if (!valor || Number.isNaN(valor)) return null;
      return { data, hora: (c.hora >= 0 ? l[c.hora] : dt[4]) || null, documento: c.doc >= 0 ? l[c.doc] : '', historico: c.hist >= 0 ? l[c.hist] : '',
        favorecido: c.fav >= 0 ? l[c.fav] : '', cpf_cnpj: c.cpf >= 0 ? l[c.cpf] : '', valor, saldo: c.saldo >= 0 && l[c.saldo] ? centavos(sinal(l[c.saldo])) : null };
    }).filter(Boolean).filter(x => !/^saldo/i.test(x.historico));
  }
  async function lerExtrato(arquivo) {
    const txt = await arquivo.text();
    const linhas = /<OFX>|OFXHEADER/i.test(txt) ? lerOFX(txt) : lerCSV(txt);
    if (!linhas.length) throw new Error('nenhum lançamento encontrado no arquivo');
    // Do mais antigo para o mais novo, mantendo a ordem do banco dentro do dia (é ela que fecha o saldo;
    // a hora nem sempre segue a ordem de lançamento). Extrato que vem do mais novo para o mais antigo é invertido.
    if (linhas.length > 1 && linhas[0].data > linhas[linhas.length - 1].data) linhas.reverse();
    linhas.forEach((l, i) => { l.ordem = i; });
    linhas.sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem);
    const porDia = {}; linhas.forEach(l => { l.ordem = porDia[l.data] = (porDia[l.data] ?? -1) + 1; });
    const vistos = {};
    linhas.forEach(l => { const base = l.fitid || `${l.data}|${l.hora || ''}|${l.documento}|${l.valor}`; vistos[base] = (vistos[base] || 0) + 1;
      l.chave = vistos[base] > 1 ? `${base}|${vistos[base]}` : base; delete l.fitid; });
    return linhas;
  }
  // Confere o saldo linha a linha (quando o extrato traz o saldo): mostra onde a conta não fecha
  function conferirSaldo(linhas) {
    const com = linhas.filter(l => l.saldo != null);
    if (com.length < 2) return { conferido: false };
    let erros = 0, s = centavos(com[0].saldo - com[0].valor);
    linhas.forEach(l => { s = centavos(s + l.valor); if (l.saldo != null && Math.abs(s - l.saldo) > 0.005) { erros++; s = l.saldo; } });
    return { conferido: true, erros, inicial: centavos(com[0].saldo - com[0].valor), final: com[com.length - 1].saldo };
  }

  return {
    usar, garantir, gravou, L, unidades, unidade, unidadePorCodigo, codUnidade, empresaDaUnidade,
    categorias, categoria, nomeCategoria, carregarXlsx, contas, conta, nomeConta, empresaDaConta,
    num, centavos, dataBRIso, lerFluxo, montarFluxo, importarFluxo, lerExtrato, conferirSaldo
  };
})();
