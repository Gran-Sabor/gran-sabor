/* =====================================================================
   Gran Sabor · rescisao.js — A CONTA DA RESCISÃO, NUM LUGAR SÓ
   A tela Rescisão (projeção, passivo e registradas) usa só estas funções.
   Reaproveita a folha (folha.js: INSS, IRRF, holerite do mês, 13º, férias)
   e a escala (faltas): nada é digitado de novo, tudo vem da origem.
   Regras CLT de EXEMPLO (o contador da Gran Sabor confirma):
   - Aviso prévio: 30 dias + 3 por ano completo de casa, até 90 (Lei 12.506).
     Trabalhado: 30 dias trabalhados, o que passa de 30 é indenizado.
     O aviso indenizado conta como tempo de casa (projeção) para 13º e férias.
   - Sem justa causa: tudo + multa de 40% do FGTS, saque e seguro-desemprego.
   - Pedido de demissão: sem multa nem saque; se não cumprir o aviso, desconta 30 dias.
   - Justa causa: só saldo de salário e férias vencidas (+1/3).
   - Acordo (art. 484-A): metade do aviso indenizado, multa de 20%, saque de 80%.
   - Fim da experiência: saldo, 13º e férias proporcionais, saque; sem aviso e sem multa.
   - Pagamento em até 10 dias corridos depois do último dia (art. 477).
   Mudou uma regra? Muda AQUI e sobe o ?v= na tela.
   ===================================================================== */
const RESC = (() => {
  const r2 = FOLHA.r2;
  const cb = () => { try { return casca().dadosBanco || null; } catch { return null; } };
  const banco = () => (typeof db !== 'undefined' ? db : null);
  const REAL = RH_DO_BANCO && !!cb() && !!banco();

  const TIPOS = {
    sem_justa_causa: { nome: 'Sem justa causa (empresa demite)', curto: 'Sem justa causa', multa: 0.40, saque: 1, seguro: true, aviso: 'empresa', prop: true },
    pedido_demissao: { nome: 'Pedido de demissão', curto: 'Pedido de demissão', multa: 0, saque: 0, seguro: false, aviso: 'empregado', prop: true },
    acordo:          { nome: 'Acordo entre as partes (484-A)', curto: 'Acordo', multa: 0.20, saque: 0.8, seguro: false, aviso: 'metade', prop: true },
    fim_experiencia: { nome: 'Fim do contrato de experiência', curto: 'Fim da experiência', multa: 0, saque: 1, seguro: false, aviso: null, prop: true },
    justa_causa:     { nome: 'Justa causa', curto: 'Justa causa', multa: 0, saque: 0, seguro: false, aviso: null, prop: false }
  };
  const AVISOS = { indenizado: 'Indenizado (sai já)', trabalhado: 'Trabalhado', dispensado: 'Empresa dispensa o cumprimento', descontado: 'Não cumpriu (desconta)', nao_se_aplica: 'Não se aplica' };
  // Quais formas de aviso cada tipo aceita (a primeira é a sugestão)
  const avisosDo = tipo => ({ sem_justa_causa: ['indenizado', 'trabalhado'], acordo: ['indenizado', 'trabalhado'],
    pedido_demissao: ['trabalhado', 'dispensado', 'descontado'] }[tipo] || ['nao_se_aplica']);

  /* ---------- Datas ---------- */
  const somaDias = FOLHA.somaDias;
  const dt = iso => new Date(iso + 'T12:00');
  const iso = d => d.toISOString().slice(0, 10);
  const somaMeses = (s, n) => { const d = dt(s); const dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d); };
  const anosCompletos = (de, ate) => { let n = 0; while (somaMeses(de, 12 * (n + 1)) <= somaDias(ate, 1)) n++; return n; };
  function tempoCasa(c, ate) {
    let m = 0; while (somaMeses(c.admissao, m + 1) <= somaDias(ate, 1)) m++;
    const a = Math.floor(m / 12), mm = m % 12;
    return [a ? `${a} ano${a > 1 ? 's' : ''}` : '', mm ? `${mm} ${mm > 1 ? 'meses' : 'mês'}` : ''].filter(Boolean).join(' e ') || 'menos de 1 mês';
  }
  // Avos: meses cheios desde o início + fração de 15 dias ou mais conta 1
  function avosDesde(inicio, ate) {
    let n = 0;
    while (n < 12) { const fimMes = somaDias(somaMeses(inicio, n + 1), -1);
      if (fimMes <= ate) { n++; continue; }
      if (ESC_dif(ate, somaMeses(inicio, n)) + 1 >= 15) n++;
      break; }
    return n;
  }
  const ESC_dif = (a, b) => Math.round((dt(a) - dt(b)) / 864e5);
  // 13º: avos do ano até a data = meses do calendário com 15 dias ou mais de trabalho (como em folha.js · avos13)
  function avos13Ate(c, ate) {
    const ano = ate.slice(0, 4); let n = 0;
    for (let m = 1; m <= Number(ate.slice(5, 7)); m++) {
      const mm = String(m).padStart(2, '0'), ini0 = `${ano}-${mm}-01`, fim0 = `${ano}-${mm}-${new Date(+ano, m, 0).getDate()}`;
      const ini = c.admissao > ini0 ? c.admissao : ini0, fim = ate < fim0 ? ate : fim0;
      if (ini <= fim && ESC_dif(fim, ini) + 1 >= 15) n++;
    }
    return n;
  }
  const avisoDias = (c, dataAviso) => Math.min(90, 30 + 3 * anosCompletos(c.admissao, dataAviso));
  const emExperiencia = (c, data) => !c.semAdmissao && ESC_dif(data, c.admissao) < 90;

  /* ---------- Cálculo ----------
     op: { tipo, aviso, dataAviso, saida (último dia trabalhado), saldoFgts (opcional) }
     Devolve as verbas (como num TRCT), descontos, líquido, FGTS, multa, custo e prazos. */
  function calcular(c, op) {
    const T = TIPOS[op.tipo] || TIPOS.sem_justa_causa;
    const aviso = avisosDo(op.tipo).includes(op.aviso) ? op.aviso : avisosDo(op.tipo)[0];
    const saida = op.saida, dataAviso = op.dataAviso || saida, comp = saida.slice(0, 7);
    const alertas = [];
    const itens = [], add = (grupo, nome, ref, valor, tipo = 'provento', inc = {}) => { valor = r2(valor); if (valor > 0) itens.push({ grupo, nome, ref, valor, tipo, ...inc }); };

    // Aviso prévio
    const dAviso = avisoDias(c, dataAviso);
    let indenizados = 0, descontoAviso = 0;
    if (T.aviso === 'empresa') indenizados = aviso === 'indenizado' ? dAviso : Math.max(0, dAviso - 30);
    if (T.aviso === 'metade') indenizados = aviso === 'indenizado' ? Math.floor(dAviso / 2) : Math.floor(Math.max(0, dAviso - 30) / 2);
    if (T.aviso === 'empregado' && aviso === 'descontado') descontoAviso = 30;
    const projetada = somaDias(saida, indenizados);

    // 1. Saldo de salário (dias do mês até a saída) + o que já foi lançado no mês (horas extras, faltas, consumo, vale)
    const ini = c.admissao.slice(0, 7) === comp ? Number(c.admissao.slice(8)) : 1;
    const diasSaldo = Math.max(0, Math.min(30, Number(saida.slice(8))) - ini + 1);
    add('salario', 'Saldo de salário', `${diasSaldo} dias`, c.salario / 30 * diasSaldo, 'provento', { inss: true, fgts: true, irrf: true });
    const hol = FOLHA.holerite(c, comp);
    hol.itens.filter(i => !['001', '101', '102', '103'].includes(i.codigo))
      .forEach(i => add('salario', `${i.nome}`, i.ref, i.valor, i.tipo, { codigo: i.codigo, inss: i.inss, fgts: i.fgts, irrf: i.irrf }));

    // 2. Aviso prévio indenizado
    if (indenizados) add('aviso', 'Aviso prévio indenizado', `${indenizados} dias${T.aviso === 'metade' ? ' (metade)' : ''}`, c.salario / 30 * indenizados, 'provento', { fgts: true });
    if (descontoAviso) add('aviso', 'Aviso prévio não cumprido (desconto)', '30 dias', c.salario, 'desconto');

    // 3. 13º proporcional (até a saída) e sobre o aviso (até a data projetada)
    const ano = Number(saida.slice(0, 4)), fimAno = `${ano}-12-31`;
    const avos13 = T.prop ? avos13Ate(c, saida) : 0;
    // Projeção que passa de dezembro: os avos do ano seguinte também entram
    const avos13Proj = !T.prop ? 0 : avos13Ate(c, projetada < fimAno ? projetada : fimAno) + (projetada > fimAno ? avos13Ate(c, projetada) : 0);
    add('decimo', '13º salário proporcional', `${avos13}/12`, c.salario / 12 * avos13, 'provento', { d13: true, fgts: true });
    add('decimo', '13º sobre o aviso indenizado', `${avos13Proj - avos13}/12`, c.salario / 12 * (avos13Proj - avos13), 'provento', { d13: true, fgts: true });
    const adiant13 = (typeof PAGAMENTOS_13 !== 'undefined' ? PAGAMENTOS_13 : []).filter(p => p.colab === c.id && p.ano === ano && p.parcela === 1 && pago13(p)).reduce((s, p) => s + (p.valor || 0), 0);
    add('decimo', '13º · 1ª parcela já paga', '', Math.min(adiant13, c.salario / 12 * avos13Proj), 'desconto');

    // 4. Férias: vencidas (dobro se passou do limite) e proporcionais (até a data projetada); +1/3
    const ps = FOLHA.periodosFerias(c, projetada);
    ps.filter(p => p.completo && p.saldo > 0).forEach(p => {
      const dobro = p.limite < saida, v = c.salario / 30 * p.saldo * (dobro ? 2 : 1);
      add('ferias', `Férias vencidas ${dataBR(p.aquisitivo + 'T12:00')} a ${dataBR(p.fimAquisitivo + 'T12:00')}${dobro ? ' (em dobro)' : ''}`, `${p.saldo} dias`, v);
      add('ferias', '1/3 sobre férias vencidas', '', v / 3);
      if (dobro) alertas.push('Há férias vencidas fora do prazo: saem em dobro.');
    });
    const aberto = ps.find(p => !p.completo);
    if (T.prop && aberto) {
      const avosF = avosDesde(aberto.aquisitivo, projetada), diasF = r2(Math.max(0, aberto.direito * avosF / 12 - aberto.usados));
      const vProp = c.salario / 30 * diasF;
      add('ferias', 'Férias proporcionais', `${avosF}/12 · ${numero(diasF, 1)} d`, vProp);
      add('ferias', '1/3 sobre férias proporcionais', '', vProp / 3);
    }

    // 5. Impostos: INSS e IRRF do mês (saldo + variáveis) e do 13º (à parte). Aviso e férias indenizados: isentos.
    const soma = f => itens.filter(f).reduce((a, i) => a + (i.tipo === 'provento' ? i.valor : -i.valor), 0);
    const baseInss = Math.max(0, r2(soma(i => i.grupo === 'salario' && i.inss)));
    const baseIr = Math.max(0, r2(soma(i => i.grupo === 'salario' && i.irrf)));
    const inss = FOLHA.inss(baseInss), irrf = FOLHA.irrf(baseIr, inss, c.dependentes);
    const total13 = r2(itens.filter(i => i.d13).reduce((a, i) => a + i.valor, 0));
    const inss13 = FOLHA.inss(total13), irrf13 = FOLHA.irrf(total13, inss13, c.dependentes, false);
    add('impostos', 'INSS', `base ${reais(baseInss)}`, inss, 'desconto');
    add('impostos', 'IRRF', '', irrf, 'desconto');
    add('impostos', 'INSS sobre 13º', `base ${reais(total13)}`, inss13, 'desconto');
    add('impostos', 'IRRF sobre 13º', '', irrf13, 'desconto');

    const bruto = r2(itens.filter(i => i.tipo === 'provento').reduce((a, i) => a + i.valor, 0));
    const descontos = r2(itens.filter(i => i.tipo === 'desconto').reduce((a, i) => a + i.valor, 0));
    let liquido = r2(bruto - descontos);
    if (liquido < 0) { alertas.push(`Os descontos passam das verbas em ${reais(-liquido)}: o líquido fica zero e a diferença não pode ser cobrada além do limite legal (confira com o contador).`); liquido = 0; }

    // 6. FGTS: depósito do mês, do aviso e do 13º; multa sobre o saldo (informado ou estimado) + esses depósitos
    // Saque: saldo × (100%, 80% no acordo, 0%) + a multa, que vai inteira para o colaborador
    const baseFgts = Math.max(0, r2(soma(i => (i.grupo === 'salario' && i.fgts) || i.grupo === 'aviso' && i.tipo === 'provento' || i.d13)));
    const fgtsRescisao = r2(baseFgts * 0.08);
    const informado = op.saldoFgts != null && op.saldoFgts !== '' && !isNaN(op.saldoFgts);
    const saldoFgts = informado ? Number(op.saldoFgts) : estimarSaldoFgts(c, saida);
    const baseMulta = r2(saldoFgts + fgtsRescisao), multa = r2(baseMulta * T.multa);
    const guiaFgts = r2(fgtsRescisao + multa);
    const custo = r2(bruto + guiaFgts);

    if (op.tipo === 'fim_experiencia' && !emExperiencia(c, saida)) alertas.push('Pela admissão, este contrato já passou dos 90 dias de experiência: o tipo certo seria outro.');
    if (op.tipo !== 'fim_experiencia' && op.tipo !== 'justa_causa' && emExperiencia(c, saida)) alertas.push('Ainda em experiência: se a empresa encerrar antes do fim do contrato, a regra é a do art. 479 (metade dos dias que faltam). Confira com o contador.');
    if (saida < dataAviso) alertas.push('O último dia é antes do aviso.');
    if (T.aviso === 'empresa' && aviso === 'trabalhado' && ESC_dif(saida, dataAviso) + 1 < 30) alertas.push('Aviso trabalhado: o último dia deveria ser 30 dias depois do aviso.');
    if (c.semAdmissao) alertas.unshift('Sem data de admissão no cadastro: aviso, 13º, férias e FGTS ficam errados. Preencha a admissão em Colaboradores.');
    if (c.situacao === 'afastado') alertas.push('Colaborador afastado: confira estabilidade antes de desligar.');

    return { c, op: { ...op, aviso }, T, itens, bruto, descontos, liquido, avisoDias: dAviso, indenizados, projetada,
      inss, irrf, inss13, irrf13, fgtsRescisao, saldoFgts: r2(saldoFgts), fgtsEstimado: !informado, baseMulta, multa, guiaFgts, custo,
      saque: r2((saldoFgts + fgtsRescisao) * T.saque + multa), prazo: somaDias(saida, 10), tempo: tempoCasa(c, saida), alertas };
  }
  // Sem o extrato da Caixa: 8% do salário de hoje por mês de casa, com o 13º (é só uma estimativa)
  function estimarSaldoFgts(c, ate) {
    if (c.semAdmissao) return 0;
    let m = 0; while (somaMeses(c.admissao, m + 1) <= somaDias(ate, 1)) m++;
    return r2(c.salario * 0.08 * m * 13 / 12);
  }
  function pago13(p) { return p.pagoEm || (p.conta && (CONTAS_PAGAR.find(x => x.id === p.conta) || {}).pagoEm); }

  /* ---------- Dados (banco ou exemplo) ---------- */
  const memoria = () => dadoComum('RESCISOES', () => []);
  const lista = () => REAL ? cb().lista('rescisoes') : memoria();
  async function garantir() { if (REAL) await cb().garantir('rescisoes', 'contas_pagar', 'categorias_financeiras'); }
  const opDe = r => ({ tipo: r.tipo, aviso: r.aviso, dataAviso: r.data_aviso, saida: r.data_saida, saldoFgts: r.saldo_fgts == null ? null : Number(r.saldo_fgts) });
  function conta(id) {
    if (!id) return null;
    if (REAL) { const x = cb().lista('contas_pagar').find(y => y.id === id); return x ? { valor: Number(x.valor), pagoEm: x.pago_em, vencimento: x.vencimento } : null; }
    const x = CONTAS_PAGAR.find(y => y.id === id); return x ? { valor: x.valor, pagoEm: x.pagoEm, vencimento: x.vencimento } : null;
  }

  // Registrar: relê o colaborador, refaz a conta e confere com o que a pessoa viu; depois grava tudo de uma vez
  async function registrar(foto, op, obs = '') {
    const c = COLABORADORES.find(x => x.id === foto.c.id);
    const mudou = mudouDesde(foto.c, c, ['salario', 'admissao', 'situacao', 'dependentes', 'unidade', 'atualizado_em'], 'O cadastro do colaborador');
    if (mudou) return mudou;
    if (c.situacao === 'desligado') return 'Este colaborador já está desligado.';
    if (lista().some(r => r.colaborador_id === c.id)) return 'Já existe uma rescisão registrada para este colaborador.';
    const agora = calcular(c, op);
    if (agora.liquido !== foto.liquido || agora.guiaFgts !== foto.guiaFgts)
      return `Os valores mudaram enquanto a janela estava aberta (líquido ${reais(foto.liquido)} → ${reais(agora.liquido)}). Nada foi gravado: confira e registre de novo.`;
    const fav = `Rescisão · ${c.nome}`;
    if (REAL) {
      const cats = cb().lista('categorias_financeiras').filter(x => x.tipo === 'despesa' && x.ativo);
      const cat = cats.find(x => /rescis/i.test(x.nome)) || cats.find(x => /sal[aá]rio|folha/i.test(x.nome)) || cats.find(x => /pessoal|folha/i.test(x.grupo)) || null;
      if (!cat) return 'Cadastre antes uma categoria financeira de folha (ex.: 4.10 Rescisões) em Cadastros › Categoria financeira: toda conta a pagar precisa de categoria.';
      const { error } = await banco().rpc('registrar_rescisao', { p_colaborador: c.id, p_visto_em: c.atualizado_em, p_tipo: op.tipo, p_aviso: agora.op.aviso,
        p_data_aviso: op.dataAviso, p_data_saida: op.saida, p_saldo_fgts: agora.fgtsEstimado ? null : agora.saldoFgts, p_obs: obs.slice(0, 500),
        p_liquido: agora.liquido, p_guia_fgts: agora.guiaFgts, p_categoria: cat?.id || null, p_favorecido: fav, p_vencimento: agora.prazo });
      await cb().gravou('rescisoes', 'contas_pagar', 'colaboradores');
      if (error) return error.code === '23505' ? 'Alguém registrou a rescisão deste colaborador agora em outra tela.' : error.message;
      return '';
    }
    const id = 'rs' + Date.now(), un = c.unidade, base = { fornecedor: null, categoria: '4.01', unidade: un, empresa: UNIDADE_EMPRESA[un], centro: null, vencimento: agora.prazo, pagoEm: null, valorPago: null, forma: '', origem: 'folha' };
    const cp = agora.liquido > 0 ? 'cr' + Date.now() : null, cf = agora.guiaFgts > 0 ? 'cg' + Date.now() : null;
    if (cp) CONTAS_PAGAR.push({ ...base, id: cp, favorecido: fav, documento: 'Rescisão (TRCT)', valor: agora.liquido, obs: 'Líquido da rescisão. Gerado pela tela Rescisão.' });
    if (cf) CONTAS_PAGAR.push({ ...base, id: cf, favorecido: 'FGTS rescisório', documento: 'Guia FGTS · rescisão', valor: agora.guiaFgts, obs: 'FGTS do mês, do aviso e do 13º + multa. ' + fav });
    memoria().push({ id, colaborador_id: c.id, tipo: op.tipo, aviso: agora.op.aviso, data_aviso: op.dataAviso, data_saida: op.saida,
      saldo_fgts: agora.fgtsEstimado ? null : agora.saldoFgts, conta_pagar_id: cp, conta_fgts_id: cf, obs, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });
    Object.assign(c, { situacao: 'desligado', demissao: op.saida, ativo: false, atualizado_em: new Date().toISOString() });
    avisarMudanca('rescisoes', 'contas_pagar', 'colaboradores');
    return '';
  }
  async function desfazer(foto) {
    const r = lista().find(x => x.id === foto.id);
    if (!r || r.atualizado_em !== foto.atualizado_em) return 'Esta rescisão mudou em outra tela. Nada foi desfeito: confira.';
    if ([r.conta_pagar_id, r.conta_fgts_id].some(id => conta(id)?.pagoEm)) return 'Uma das contas desta rescisão já foi paga. Não dá para desfazer: a diferença vira acerto.';
    if (REAL) {
      const { error } = await banco().rpc('desfazer_rescisao', { p_id: r.id, p_visto_em: r.atualizado_em });
      await cb().gravou('rescisoes', 'contas_pagar', 'colaboradores');
      return error ? error.message : '';
    }
    [r.conta_pagar_id, r.conta_fgts_id].forEach(id => { const i = CONTAS_PAGAR.findIndex(x => x.id === id); if (i >= 0) CONTAS_PAGAR.splice(i, 1); });
    const c = COLABORADORES.find(x => x.id === r.colaborador_id);
    if (c) Object.assign(c, { situacao: 'ativo', demissao: '', ativo: true, atualizado_em: new Date().toISOString() });
    memoria().splice(memoria().indexOf(r), 1);
    avisarMudanca('rescisoes', 'contas_pagar', 'colaboradores');
    return '';
  }

  return { REAL, TIPOS, AVISOS, avisosDo, avisoDias, calcular, tempoCasa, emExperiencia, lista, garantir, opDe, conta, registrar, desfazer, somaDias };
})();
