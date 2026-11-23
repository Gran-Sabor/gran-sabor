/* =====================================================================
   Gran Sabor · custos.js — CUSTO POR COLABORADOR E IMPACTO DAS AUSÊNCIAS
   Uma conta só, lida direto da origem (nada guardado):
     salário e adicionais → holerite (folha.js)
     faltas, atestados, abonos e dias trabalhados → escala (escala.js)
     freelancer que cobriu a ausência → diárias da escala
   Mudou a escala, um lançamento, o cadastro ou uma diária? A conta muda junto.
   Encargos e provisões são de EXEMPLO: o contador da Gran Sabor confirma.
   ===================================================================== */
const CUSTO = (() => {
  const r2 = FOLHA.r2;
  // Regime de cada empresa (exemplo). Simples Nacional: a contribuição patronal (CPP) vai dentro do DAS,
  // por isso fica fora daqui. Regime normal: 20% INSS + 2% RAT + 5,8% terceiros sobre a base do INSS.
  const REGIME = { emp1: 'simples', emp2: 'simples', emp3: 'simples' };
  const PATRONAL = { simples: 0, normal: 0.278 };
  const NOME_REGIME = { simples: 'Simples Nacional (CPP no DAS)', normal: 'Regime normal (INSS 20% + RAT + terceiros)' };
  const FGTS = 0.08;
  const AUSENCIA = ['104', '105', '106'];          // falta, atraso e DSR perdido: a empresa deixa de pagar
  const AUS_PAGA = ['atestado', 'abonada'];        // ausência que a empresa paga sem ter o trabalho

  const regimeDe = emp => REGIME[emp] || 'simples';
  const diasDoMes = comp => { const [a, m] = comp.split('-').map(Number), n = new Date(a, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${comp}-${String(i + 1).padStart(2, '0')}`); };

  /* Dias do mês pela escala: trabalhados, previstos e cada tipo de ausência */
  function diasEscala(c, comp) {
    const t = { trabalhados: 0, faltas: 0, atestados: 0, abonadas: 0, ferias: 0, folgas: 0 };
    if (typeof ESC === 'undefined') return t;
    diasDoMes(comp).forEach(d => { const r = ESC.dia(c, d);
      if (r.tipo === 'turno') t.trabalhados++; else if (r.tipo === 'falta') t.faltas++;
      else if (r.tipo === 'atestado') t.atestados++; else if (r.tipo === 'abonada') t.abonadas++;
      else if (r.tipo === 'ferias') t.ferias++; else if (r.tipo === 'folga') t.folgas++; });
    return t;
  }

  /* Custo de UM colaborador numa competência (AAAA-MM). null = fora do contrato no mês. */
  function mes(c, comp) {
    const h = FOLHA.holerite(c, comp);
    if (!h.dias && !h.afastado) return null;
    const soma = cods => r2(h.itens.filter(i => cods.includes(i.codigo)).reduce((a, i) => a + i.valor, 0));
    const regime = regimeDe(c.empresa), aliq = PATRONAL[regime];
    const ds = diasEscala(c, comp);
    // Faltas e atrasos lançados à mão (Lançamentos do mês) também contam como ausência
    const lancs = LANCAMENTOS.filter(l => l.comp === comp && l.colab === c.id);
    const faltasLanc = lancs.filter(l => l.evento === '104').reduce((a, l) => a + Number(l.qtd || 0), 0);
    const atrasoHoras = lancs.filter(l => l.evento === '105').reduce((a, l) => a + Number(l.qtd || 0), 0);
    const faltas = ds.faltas + faltasLanc, pagas = ds.atestados + ds.abonadas;
    const trabalhados = Math.max(0, ds.trabalhados - faltasLanc);
    const previstos = trabalhados + faltas + pagas;
    const diaria = c.salario / 30;

    const descontoAusencia = soma(AUSENCIA);                     // falta + DSR + atraso descontados no holerite
    const salario = r2(h.bruto - descontoAusencia);              // o que a empresa paga de salário e adicionais
    const inssPatronal = r2(h.baseInss * aliq);
    const fgts = h.fgts;
    const baseProv = h.afastado ? 0 : diaria * h.dias;           // 1/12 de 13º e 1/12 de férias + 1/3 por mês
    const prov13 = r2(baseProv / 12), provFerias = r2(baseProv / 12 * 4 / 3);
    const encProvisoes = r2((prov13 + provFerias) * (FGTS + aliq));
    const vtEmpresa = c.optanteVT ? r2(Math.max(0, c.vt * trabalhados - soma(['103']))) : 0;
    const cobertura = typeof ESC === 'undefined' ? [] : ESC.diarias().filter(x => x.cobre_colaborador_id === c.id && x.data.slice(0, 7) === comp && ESC.valeDiaria(x));
    const freelancer = r2(cobertura.reduce((a, x) => a + Number(x.valor || 0), 0));

    const encargos = r2(inssPatronal + fgts);
    const provisoes = r2(prov13 + provFerias + encProvisoes);
    const total = r2(salario + encargos + provisoes + vtEmpresa + freelancer);
    // Impacto das ausências: o que custaram a mais (freelancer + dias pagos sem trabalho) menos o que a folha descontou
    const pagoSemTrabalho = r2(diaria * pagas * (1 + FGTS + aliq));
    const impacto = r2(freelancer + pagoSemTrabalho - descontoAusencia);
    const custoDia = trabalhados ? r2(total / trabalhados) : 0;
    // Custo por dia se ninguém tivesse faltado: tira o impacto e divide pelos dias previstos
    const custoDiaSemAus = previstos ? r2((total - impacto) / previstos) : 0;
    return { c, comp, h, regime, afastado: !!h.afastado, dias: h.dias,
      salario, inssPatronal, fgts, encargos, prov13, provFerias, encProvisoes, provisoes, vtEmpresa, freelancer, cobertura, total,
      trabalhados, previstos, faltas, faltasEscala: ds.faltas, faltasLanc, atestados: ds.atestados, abonadas: ds.abonadas, atrasoHoras, ferias: ds.ferias,
      ausencias: faltas + pagas, absenteismo: previstos ? (faltas + pagas) / previstos * 100 : 0,
      descontoAusencia, pagoSemTrabalho, impacto, custoDia, custoDiaSemAus,
      aumentoDia: custoDiaSemAus ? (custoDia / custoDiaSemAus - 1) * 100 : 0,
      custoHora: r2((total - freelancer) / 220) };
  }

  /* Todos os colaboradores de uma competência (filtro opcional) */
  const competencia = (comp, filtro = () => true) => COLABORADORES.filter(c => filtro(c)).map(c => mes(c, comp)).filter(Boolean);

  /* Soma de uma lista de custos (para totais por empresa, unidade ou período) */
  const CAMPOS = ['salario', 'inssPatronal', 'fgts', 'encargos', 'prov13', 'provFerias', 'encProvisoes', 'provisoes', 'vtEmpresa', 'freelancer', 'total',
    'trabalhados', 'previstos', 'faltas', 'atestados', 'abonadas', 'atrasoHoras', 'ausencias', 'descontoAusencia', 'pagoSemTrabalho', 'impacto'];
  function somar(lista) {
    const t = { pessoas: new Set(lista.map(x => x.c.id)).size };
    CAMPOS.forEach(k => t[k] = r2(lista.reduce((a, x) => a + (x[k] || 0), 0)));
    t.absenteismo = t.previstos ? t.ausencias / t.previstos * 100 : 0;
    t.custoDia = t.trabalhados ? r2(t.total / t.trabalhados) : 0;
    return t;
  }

  /* Competências de um intervalo: os n meses que terminam em comp */
  function meses(comp, n) {
    const [a, m] = comp.split('-').map(Number);
    return Array.from({ length: n }, (_, i) => { const d = new Date(a, m - 1 - (n - 1 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  }

  return { REGIME, NOME_REGIME, PATRONAL, FGTS, regimeDe, diasEscala, mes, competencia, somar, meses };
})();
