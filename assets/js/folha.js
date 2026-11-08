/* =====================================================================
   Gran Sabor · folha.js — A CONTA DA FOLHA, NUM LUGAR SÓ
   Holerite, fechamento, adiantamento, 13º, férias e escala usam estas
   mesmas funções (lição da Drogarema: cada tela fazendo a sua conta gerou
   pagamento errado). Mudou uma regra? Muda AQUI e sobe o ?v= nas telas.
   Tabelas e regras são de EXEMPLO: o contador da Gran Sabor confirma.
   ===================================================================== */
const FOLHA = (() => {
  const r2 = v => Math.round(v * 100) / 100;
  // INSS progressivo (tabela de exemplo)
  const FAIXAS_INSS = [[1518.00, 0.075], [2793.88, 0.09], [4190.83, 0.12], [8157.41, 0.14]];
  function inss(base) {
    let ant = 0, tot = 0;
    for (const [teto, aliq] of FAIXAS_INSS) { if (base <= ant) break; tot += (Math.min(base, teto) - ant) * aliq; ant = teto; }
    return r2(tot);
  }
  // IRRF mensal (tabela de exemplo) + redução da lei nova (isenção até R$ 5.000, parcial até R$ 7.350)
  const FAIXAS_IR = [[2428.80, 0, 0], [2826.65, 0.075, 182.16], [3751.05, 0.15, 394.16], [4664.68, 0.225, 675.49], [Infinity, 0.275, 908.73]];
  const DEP_IR = 189.59, SIMPLIFICADO = 607.20;
  function irrf(bruto, inssDesc, dependentes = 0, comReducao = true) {
    const deducoes = Math.max(inssDesc + dependentes * DEP_IR, SIMPLIFICADO);
    const base = Math.max(0, bruto - deducoes);
    const [, aliq, ded] = FAIXAS_IR.find(([teto]) => base <= teto);
    let ir = Math.max(0, base * aliq - ded);
    if (comReducao) { const red = bruto <= 5000 ? ir : bruto <= 7350 ? Math.max(0, 978.62 - 0.133145 * bruto) : 0; ir = Math.max(0, ir - red); }
    return r2(ir);
  }
  const valorHora = c => c.salario / 220;
  const evento = cod => (typeof EVENTOS !== 'undefined' && EVENTOS.find(e => e.codigo === cod)) || { codigo: cod, nome: cod, tipo: 'provento', inss: true, fgts: true, irrf: true };
  // Lançamento → valor em R$ (horas e dias viram dinheiro aqui, e só aqui)
  function valorLancamento(c, l) {
    const h = valorHora(c);
    switch (l.evento) {
      case '010': return r2(h * 1.5 * l.qtd);
      case '011': return r2(h * 2 * l.qtd);
      case '020': return r2(h * 0.2 * l.qtd);
      case '104': return r2(c.salario / 30 * l.qtd);
      case '105': return r2(h * l.qtd);
      default: return r2(l.valor || 0);
    }
  }
  // Dias trabalhados no mês (admissão no meio do mês = proporcional)
  function diasNoMes(c, comp) {
    const [a, m] = comp.split('-').map(Number), fim = new Date(a, m, 0).getDate();
    if (c.admissao > `${comp}-${fim}`) return 0;
    return c.admissao.slice(0, 7) === comp ? Math.min(30, fim - Number(c.admissao.slice(8)) + 1) : 30;
  }

  /* Holerite de UM colaborador numa competência. Lê os dados direto da origem (nada de cópia). */
  function holerite(c, comp) {
    const itens = [], add = (cod, ref, valor) => { if (valor) itens.push({ ...pick(evento(cod)), ref, valor: r2(valor) }); };
    const pick = e => ({ codigo: e.codigo, nome: e.nome, tipo: e.tipo, inss: e.inss, fgts: e.fgts, irrf: e.irrf });
    const dias = diasNoMes(c, comp);
    if (!dias || c.situacao === 'afastado') return { colab: c, comp, itens: [], dias, bruto: 0, descontos: 0, liquido: 0, fgts: 0, baseInss: 0, afastado: c.situacao === 'afastado' };
    add('001', `${dias} dias`, c.salario / 30 * dias);
    const lancs = LANCAMENTOS.filter(l => l.comp === comp && l.colab === c.id);
    let he = 0, faltas = 0;
    lancs.forEach(l => { const v = valorLancamento(c, l); const e = evento(l.evento);
      add(l.evento, l.qtd ? `${numero(l.qtd, 1)} ${['104'].includes(l.evento) ? 'd' : 'h'}` : '', v);
      if (['010', '011', '020'].includes(l.evento)) he += v; if (l.evento === '104') faltas += l.qtd; });
    if (he) add('015', '4/26', he / 26 * 4);                          // DSR sobre horas extras (exemplo: 4 domingos, 26 dias úteis)
    if (faltas) add('106', `${Math.min(faltas, 4)} d`, c.salario / 30 * Math.min(faltas, 4));
    const proventos = itens.filter(i => i.tipo === 'provento'), descs = itens.filter(i => i.tipo === 'desconto');
    const base = campo => r2(proventos.filter(i => i[campo]).reduce((a, i) => a + i.valor, 0) - descs.filter(i => i[campo]).reduce((a, i) => a + i.valor, 0));
    const baseInss = base('inss'), baseFgts = base('fgts'), baseIr = base('irrf');
    const vInss = inss(baseInss); add('101', '', vInss);
    add('102', `${c.dependentes} dep.`, irrf(baseIr, vInss, c.dependentes));
    if (c.optanteVT) add('103', '6%', Math.min(c.salario * 0.06, c.vt * 22));
    const adi = ADIANTAMENTOS.filter(a => a.comp === comp && a.colab === c.id && adiantamentoPago(a)).reduce((s, a) => s + a.valor, 0);
    add('100', '', adi);
    const bruto = r2(itens.filter(i => i.tipo === 'provento').reduce((a, i) => a + i.valor, 0));
    const descontos = r2(itens.filter(i => i.tipo === 'desconto').reduce((a, i) => a + i.valor, 0));
    return { colab: c, comp, itens, dias, bruto, descontos, liquido: r2(bruto - descontos), fgts: r2(baseFgts * 0.08), baseInss, inss: vInss, adiantamento: r2(adi) };
  }
  /* Folha inteira de uma competência, com totais por empresa (os 3 CNPJs sempre separados) */
  function folha(comp, filtro = () => true) {
    const hs = COLABORADORES.filter(c => c.ativo && filtro(c)).map(c => holerite(c, comp)).filter(h => h.dias || h.afastado);
    const porEmpresa = {};
    EMPRESAS.forEach(e => porEmpresa[e.id] = { bruto: 0, descontos: 0, liquido: 0, inss: 0, fgts: 0, pessoas: 0 });
    hs.forEach(h => { const t = porEmpresa[h.colab.empresa]; if (!t) return;
      t.bruto += h.bruto; t.descontos += h.descontos; t.liquido += h.liquido; t.inss += h.inss || 0; t.fgts += h.fgts; t.pessoas++; });
    Object.values(porEmpresa).forEach(t => Object.keys(t).forEach(k => t[k] = r2(t[k])));
    return { comp, holerites: hs, porEmpresa };
  }

  /* Adiantamento pago = o registro diz que foi pago OU a conta dele foi paga no contas a pagar (uma fonte só) */
  function adiantamentoPago(a) { return a.pagoEm || (a.conta && (CONTAS_PAGAR.find(c => c.id === a.conta) || {}).pagoEm) || null; }
  /* Adiantamento: quem tem direito e quanto */
  function adiantamentoDe(c, comp) {
    if (c.situacao === 'afastado' || !c.ativo) return { direito: false, motivo: 'afastado' };
    const dia = Number(c.admissao.slice(8)), mesAdm = c.admissao.slice(0, 7);
    if (mesAdm > comp) return { direito: false, motivo: 'admitido depois' };
    if (mesAdm === comp && dia > REGRA_ADIANTAMENTO.minimoDiasCasa) return { direito: false, motivo: `admitido depois do dia ${REGRA_ADIANTAMENTO.minimoDiasCasa}` };
    return { direito: true, valor: r2(c.salario * REGRA_ADIANTAMENTO.pct / 100) };
  }

  /* 13º: avos = meses do ano com 15 dias ou mais de trabalho */
  function avos13(c, ano) {
    const adm = new Date(c.admissao + 'T12:00'); let n = 0;
    for (let m = 0; m < 12; m++) { const fim = new Date(ano, m + 1, 0);
      if (adm > fim) continue;
      const ini = adm.getFullYear() === ano && adm.getMonth() === m ? adm.getDate() : 1;
      if (fim.getDate() - ini + 1 >= 15) n++; }
    return n;
  }
  function decimo(c, ano) {
    const avos = avos13(c, ano), total = r2(c.salario / 12 * avos);
    const primeira = r2(total / 2);
    const vInss = inss(total), vIr = irrf(total, vInss, c.dependentes, false);   // 13º: tributação exclusiva, sem a redução mensal
    return { avos, total, primeira, inss: vInss, irrf: vIr, segunda: r2(total - primeira - vInss - vIr) };
  }

  /* Férias */
  const INICIO_HISTORICO = (() => { const d = new Date(); d.setDate(d.getDate() - 330); return d.toISOString().slice(0, 10); })();
  const DIAS_POR_FALTAS = [[5, 30], [14, 24], [23, 18], [32, 12], [Infinity, 0]];
  function periodosFerias(c, hoje = hojeISO()) {
    const lista = []; let ini = new Date(c.admissao + 'T12:00');
    while (true) {
      const fim = new Date(ini); fim.setFullYear(fim.getFullYear() + 1); fim.setDate(fim.getDate() - 1);
      const limite = new Date(fim); limite.setFullYear(limite.getFullYear() + 1);
      const iso = d => d.toISOString().slice(0, 10), aq = iso(ini);
      if (aq > hoje) break;
      const faltas = LANCAMENTOS.filter(l => l.colab === c.id && l.evento === '104' && l.comp >= aq.slice(0, 7) && l.comp <= iso(fim).slice(0, 7)).reduce((a, l) => a + l.qtd, 0);
      const direito = DIAS_POR_FALTAS.find(([max]) => faltas <= max)[1];
      const tiradas = FERIAS.filter(f => f.colab === c.id && f.aquisitivo === aq);
      // Períodos antigos, de antes do sistema, contam como quitados (o histórico real entra na implantação)
      const antigo = iso(fim) < INICIO_HISTORICO;
      const usados = antigo ? direito : tiradas.reduce((a, f) => a + f.dias + (f.abono ? 10 : 0), 0);
      lista.push({ aquisitivo: aq, fimAquisitivo: iso(fim), limite: iso(limite), completo: iso(fim) < hoje, antigo, faltas, direito, usados, saldo: Math.max(0, direito - usados), ferias: tiradas });
      ini = new Date(fim); ini.setDate(ini.getDate() + 1);
    }
    return lista;
  }
  function calculoFerias(c, dias, abono) {
    const base = r2(c.salario / 30 * dias), terco = r2(base / 3);
    const vAbono = abono ? r2(c.salario / 30 * 10 * 4 / 3) : 0;                 // abono pecuniário + 1/3 (sem INSS/IRRF)
    const vInss = inss(base + terco), vIr = irrf(base + terco, vInss, c.dependentes);
    return { base, terco, abono: vAbono, inss: vInss, irrf: vIr, liquido: r2(base + terco + vAbono - vInss - vIr) };
  }

  /* Escala: turno do dia (férias e afastamento vêm direto dos cadastros; folga em rodízio quando não há registro) */
  function turnoNoDia(c, data) {
    if (FERIAS.some(f => f.colab === c.id && data >= f.inicio && data <= somaDias(f.inicio, f.dias - 1))) return 'FER';
    if (c.situacao === 'afastado') return 'AF';
    if (c.admissao > data) return '';
    const marcado = ESCALA[c.id]?.[data]; if (marcado) return marcado;
    const d = new Date(data + 'T12:00'), dow = d.getDay();
    if (c.turno === 'C') return dow === 0 || dow === 6 ? 'F' : 'C';
    // Exemplo de 6x1: uma folga fixa na semana (seg a sáb) e folga no domingo a cada 3 semanas, em rodízio
    const semana = Math.floor((d - new Date('2026-01-04T12:00')) / 6048e5);
    const h = [...c.matricula].reduce((a, x) => a + x.charCodeAt(0), 0);
    return dow === 1 + (h % 6) || (dow === 0 && semana % 3 === h % 3) ? 'F' : c.turno;
  }
  const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  return { r2, adiantamentoPago, inss, irrf, valorHora, valorLancamento, holerite, folha, adiantamentoDe, avos13, decimo, periodosFerias, calculoFerias, turnoNoDia, somaDias, diasNoMes };
})();
