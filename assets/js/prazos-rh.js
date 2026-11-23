/* =====================================================================
   Gran Sabor · prazos-rh.js — PRAZOS DO RH NUM LUGAR SÓ
   Férias (vencimento do período, aviso ao colaborador, pagamento) e
   contrato de experiência (fim do 1º período, prorrogação, efetivação).
   A tela Férias, a tela Contrato de experiência, o Início e o sino da casca
   usam estas mesmas funções: nenhuma data fica congelada, tudo é
   recalculado do cadastro (admissão), das férias e dos contratos.
   Dados: com o banco, as tabelas ferias e contratos_experiencia (ao vivo
   pelo Realtime, lidas pela casca). Sem o banco: exemplo em memória.
   Precisa de: tela.js, exemplo.js, folha.js, escala.js.
   ===================================================================== */
const PRAZOS = (() => {
  const cb = () => { try { return casca().dadosBanco || null; } catch { return null; } };
  const banco = () => (typeof db !== 'undefined' ? db : null);
  const REAL = ESC.REAL;
  const NO_BANCO = REAL && !!dadoComum('PRAZOS_BANCO', () => false);   // tabelas desta parte publicadas no banco
  const { somaDias, difDias } = ESC;
  const br = iso => iso ? dataBR(iso + 'T12:00') : '';

  /* ---------- Regras (antecedência dos avisos) ---------- */
  const REGRAS = {
    feriasAntecedencia: 60,   // avisar quando faltar isto para o último dia de começar as férias do período
    avisoColaborador: 30,     // aviso de férias entregue ao colaborador (CLT art. 135)
    pagarAntes: 2,            // pagamento até 2 dias antes do início (CLT art. 145)
    experienciaAntecedencia: 10,   // avisar quando faltar isto para o fim de cada período da experiência
    experienciaPadrao: [45, 45]    // sem contrato cadastrado: 45 + 45 desde a admissão
  };

  /* =====================================================================
     FÉRIAS
     ===================================================================== */
  const fimDe = f => somaDias(f.inicio, f.dias - 1);
  const voltaDe = f => somaDias(f.inicio, f.dias);
  const prazoAviso = f => somaDias(f.inicio, -REGRAS.avisoColaborador);
  const prazoPagar = f => somaDias(f.inicio, -REGRAS.pagarAntes);
  function contaDe(f) {
    if (!f.conta) return null;
    if (REAL) { const c = cb().lista('contas_pagar').find(y => y.id === f.conta);
      return c ? { id: c.id, valor: Number(c.valor), pagoEm: c.pago_em, atualizado_em: c.atualizado_em } : null; }
    const c = CONTAS_PAGAR.find(y => y.id === f.conta); return c ? { id: c.id, valor: c.valor, pagoEm: c.pagoEm } : null;
  }
  const pagoEm = f => f.pagoEm || contaDe(f)?.pagoEm || null;

  // Situação do colaborador: o período aberto mais antigo manda
  function ferias(c, hoje = hojeISO()) {
    const prog = FERIAS.filter(f => f.colab === c.id && f.inicio > hoje).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const emGozo = FERIAS.find(f => f.colab === c.id && hoje >= f.inicio && hoje <= fimDe(f)) || null;
    if (c.semAdmissao) return { c, ps: [], aberto: null, atual: null, emGozo, prog, comecarAte: null, sit: ['sem admissão', 'pendente', 1] };
    const ps = FOLHA.periodosFerias(c, hoje), aberto = ps.find(p => p.completo && p.saldo > 0) || null, atual = ps[ps.length - 1] || null;
    // último dia para começar e terminar dentro do prazo (período concessivo)
    const comecarAte = aberto ? somaDias(aberto.limite, -(aberto.saldo - 1)) : null;
    let sit;
    if (emGozo) sit = ['em férias', 'destaque', 0];
    else if (aberto && aberto.limite < hoje) sit = ['vencida (dobro)', 'perigo', 4];
    else if (aberto && comecarAte < hoje) sit = ['fora do prazo (dobro)', 'perigo', 4];
    else if (aberto && difDias(comecarAte, hoje) <= REGRAS.feriasAntecedencia) sit = [`começar em ${difDias(comecarAte, hoje)} d`, 'pendente', 3];
    else if (aberto) sit = ['a tirar', '', 2];
    else sit = ['em aquisição', 'completa', 0];
    return { c, ps, aberto, atual, emGozo, prog, comecarAte, sit };
  }

  // Valor do recibo, recalculado do salário de agora (a conta a pagar guarda o valor gerado)
  const valorFerias = f => FOLHA.calculoFerias(colab(f.colab), f.dias, f.abono);

  /* =====================================================================
     CONTRATO DE EXPERIÊNCIA
     ===================================================================== */
  const contratos = () => REAL ? (NO_BANCO ? cb().lista('contratos_experiencia') : []) : ESC.lista('contratos_experiencia');
  const contratoDe = cId => contratos().find(x => x.colaborador_id === cId) || null;
  const FASES = { primeiro: ['1º período', 'destaque'], prorrogado: ['prorrogação', 'pendente'], indeterminado: ['virou prazo indeterminado', 'completa'],
    efetivado: ['efetivado', 'completa'], encerrado: ['encerrado', ''] };

  function experiencia(c, hoje = hojeISO()) {
    const row = contratoDe(c.id);
    if (!row && (c.semAdmissao || !c.admissao)) return null;
    const inicio = row ? row.inicio : c.admissao;
    const d1 = row ? row.dias_1 : REGRAS.experienciaPadrao[0], d2 = row ? row.dias_2 : REGRAS.experienciaPadrao[1];
    const fim1 = somaDias(inicio, d1 - 1), fim2 = somaDias(inicio, d1 + d2 - 1);
    // Sem contrato cadastrado e já passou da experiência há mais de 30 dias: nem aparece
    if (!row && fim2 < somaDias(hoje, -30)) return null;
    if (!row && inicio > somaDias(hoje, 30)) return null;
    let fase, prazo = null, acao = '';
    if (row && row.situacao !== 'vigente') fase = row.situacao;
    // prorrogação já assinada: o próximo prazo é o fim da experiência
    else if (hoje <= fim1 && !(d2 && row?.prorrogado_em)) { fase = 'primeiro'; prazo = fim1; acao = d2 ? 'prorrogar, efetivar ou encerrar' : 'efetivar ou encerrar'; }
    else if (d2 && hoje <= fim2) { fase = 'prorrogado'; prazo = fim2; acao = 'efetivar ou encerrar'; }
    else fase = 'indeterminado';   // passou do fim sem encerrar: o contrato vira prazo indeterminado
    const faltam = prazo ? difDias(prazo, hoje) : null;
    const semTermo = fase === 'prorrogado' && !row?.prorrogado_em;
    return { c, row, inicio, d1, d2, fim1, fim2, fase, prazo, faltam, acao, semTermo,
      modelo: d2 ? `${d1} + ${d2}` : `${d1} dias`, etiqueta: FASES[fase] };
  }

  /* =====================================================================
     AVISOS (Início, sino da casca e as próprias telas)
     nivel: perigo (vencido ou quase) · alerta (agir logo) · info
     ===================================================================== */
  const ORDEM = { perigo: 0, alerta: 1, info: 2 };
  function avisos(filtro = () => true, hoje = hojeISO()) {
    const r = [];
    const add = (nivel, tipo, c, data, titulo, texto, tela) => r.push({ nivel, tipo, colab: c.id, empresa: c.empresa, unidade: c.unidade, data, titulo, texto, tela });
    COLABORADORES.filter(c => c.ativo && c.situacao !== 'desligado' && filtro(c)).forEach(c => {
      const onde = `${c.nome} · ${nomeUnidade(c.unidade)}`;
      // Férias do período aberto
      const s = ferias(c, hoje);
      if (s.aberto && !s.emGozo) {
        const d = difDias(s.comecarAte, hoje), per = `período ${br(s.aberto.aquisitivo)} a ${br(s.aberto.fimAquisitivo)}, ${s.aberto.saldo} dias`;
        if (d < 0) add('perigo', 'ferias', c, s.comecarAte, `Férias vencidas · ${c.nome}`, `${per}: os dias fora do prazo saem em dobro. Programe já.`, 'ferias');
        else if (d <= REGRAS.feriasAntecedencia) add(d <= 30 ? 'perigo' : 'alerta', 'ferias', c, s.comecarAte, `Programar férias até ${br(s.comecarAte)}`, `${onde} · ${per}`, 'ferias');
      }
      // Férias programadas: aviso ao colaborador e pagamento
      s.prog.forEach(f => {
        if (!f.avisoEm) { const d = difDias(prazoAviso(f), hoje);
          if (d <= 7) add(d < 0 ? 'perigo' : 'alerta', 'aviso_ferias', c, prazoAviso(f), d < 0 ? `Aviso de férias atrasado · ${c.nome}` : `Entregar aviso de férias até ${br(prazoAviso(f))}`,
            `${onde} · férias a partir de ${br(f.inicio)} (o aviso é 30 dias antes)`, 'ferias'); }
        if (!pagoEm(f)) { const d = difDias(prazoPagar(f), hoje);
          if (d <= 5) add(d < 0 ? 'perigo' : 'alerta', 'pagar_ferias', c, prazoPagar(f), `Pagar férias até ${br(prazoPagar(f))}`,
            `${onde} · ${reais(valorFerias(f).liquido)} · férias a partir de ${br(f.inicio)}`, 'ferias'); }
      });
      // Experiência
      const e = experiencia(c, hoje);
      if (e && e.prazo != null && e.faltam <= REGRAS.experienciaAntecedencia) {
        const qual = e.fase === 'primeiro' ? (e.d2 ? 'Fim do 1º período' : 'Fim da experiência') : 'Fim da experiência';
        add(e.faltam <= 3 ? 'perigo' : 'alerta', 'experiencia', c, e.prazo, `${qual} em ${br(e.prazo)}${e.faltam === 0 ? ' (hoje)' : ` (${e.faltam} d)`}`,
          `${onde} · ${e.modelo} dias · decidir: ${e.acao}`, 'experiencia');
      }
      if (e && e.semTermo) add('alerta', 'experiencia', c, e.fim1, `Termo de prorrogação não registrado · ${c.nome}`,
        `${onde} · passou do 1º período (${br(e.fim1)}); registre a prorrogação assinada`, 'experiencia');
    });
    return r.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel] || a.data.localeCompare(b.data));
  }

  /* =====================================================================
     GRAVAR
     ===================================================================== */
  const novoId = ESC.novoId;
  const traduz = e => e.code === '23505' ? 'Já existe um registro igual (alguém gravou agora em outra tela?). Confira e tente de novo.'
    : e.code === '23514' ? 'Algum valor não é aceito pelo banco: ' + e.message : e.message;
  const redesenhar = () => { try { api.aoGravar?.(); } catch (e) { console.warn(e); } };
  const pronto = () => !REAL || NO_BANCO ? '' : 'As tabelas de férias e experiência ainda não estão no banco (o pacote precisa ser juntado). Nada foi gravado.';
  async function garantir() { if (NO_BANCO) await cb().garantir('contas_pagar', 'categorias_financeiras'); }

  // Programa as férias e já gera a conta a pagar do recibo (vence 2 dias antes do início)
  async function programarFerias(c, { aquisitivo, inicio, dias, abono, avisoEm, obs = '' }) {
    const e = pronto(); if (e) return e;
    const val = FOLHA.calculoFerias(c, dias, abono);
    if (!(val.liquido > 0)) return 'O salário deste colaborador está zerado no cadastro: o recibo ficaria sem valor.';
    const id = novoId(), contaId = novoId(), venc = somaDias(inicio, -REGRAS.pagarAntes), doc = `Recibo de férias ${br(inicio)}`;
    const nota = `${dias} dias${abono ? ' + abono 10' : ''} · período ${br(aquisitivo)}`;
    if (REAL) {
      await garantir();
      const cats = cb().lista('categorias_financeiras').filter(x => x.tipo === 'despesa' && x.ativo);
      const cat = cats.find(x => /f[ée]rias/i.test(x.nome)) || cats.find(x => /folha/i.test(x.grupo)) || null;
      const { error } = await banco().from('contas_pagar').insert({ id: contaId, unidade_id: ESC.unId(c.unidade), categoria_id: cat?.id || null,
        favorecido: ('Férias · ' + c.nome).slice(0, 120), documento: doc.slice(0, 60), valor: val.liquido, vencimento: venc,
        obs: (nota + (c.pix ? ' · Pix ' + c.pix : '')).slice(0, 500), origem: 'folha', chave_importacao: 'ferias:' + id });
      if (error) return traduz(error);
      const { error: e2 } = await banco().from('ferias').insert({ id, colaborador_id: c.id, aquisitivo, inicio, dias, abono, aviso_em: avisoEm || null, conta_pagar_id: contaId, obs });
      if (e2) { await banco().from('contas_pagar').delete().eq('id', contaId); await cb().gravou('contas_pagar'); return traduz(e2); }
      await cb().gravou('ferias', 'contas_pagar'); redesenhar(); return '';
    }
    CONTAS_PAGAR.push({ id: contaId, favorecido: 'Férias · ' + c.nome, documento: doc, unidade: c.unidade, empresa: c.empresa,
      centro: (CENTROS.find(x => x.unidade === c.unidade) || {}).id, categoria: '4.04', valor: val.liquido, vencimento: venc, pagoEm: null, ferias: id, obs: nota, origem: 'folha' });
    FERIAS.push({ id, colab: c.id, aquisitivo, inicio, dias, abono, avisoEm: avisoEm || null, pagoEm: null, conta: contaId, obs, atualizado_em: new Date().toISOString() });
    avisarMudanca('ferias', 'contas_pagar'); redesenhar(); return '';
  }

  // Cancela férias ainda não pagas (some a conta a pagar do recibo junto). Relê na hora.
  async function cancelarFerias(foto) {
    const e = pronto(); if (e) return e;
    const f = FERIAS.find(x => x.id === foto.id);
    if (!f) return 'Estas férias já foram canceladas em outra tela.';
    if (REAL) {
      await cb().gravou('contas_pagar');
      if (pagoEm(f)) return 'O recibo acabou de ser pago no financeiro. Nada foi cancelado.';
      if (f.conta) {
        const { data, error } = await banco().from('contas_pagar').delete().eq('id', f.conta).is('pago_em', null).select('id');
        if (error) return traduz(error);
        if (!data.length && contaDe(f)) { await cb().gravou('contas_pagar'); return 'O recibo acabou de ser pago no financeiro. Nada foi cancelado.'; }
      }
      const { error } = await banco().from('ferias').delete().eq('id', f.id);
      await cb().gravou('ferias', 'contas_pagar');
      if (error) return traduz(error);
      redesenhar(); return '';
    }
    if (pagoEm(f)) return 'O recibo acabou de ser pago no financeiro. Nada foi cancelado.';
    const conta = CONTAS_PAGAR.findIndex(x => x.id === f.conta); if (conta >= 0) CONTAS_PAGAR.splice(conta, 1);
    FERIAS.splice(FERIAS.indexOf(f), 1); avisarMudanca('ferias', 'contas_pagar'); redesenhar(); return '';
  }

  // Registra (ou tira) o dia em que o colaborador recebeu o aviso de férias
  async function registrarAviso(foto, data) {
    const e = pronto(); if (e) return e;
    const f = FERIAS.find(x => x.id === foto.id);
    const m = mudouDesde(foto, f, ['inicio', 'dias', 'avisoEm'], 'As férias'); if (m) return m;
    if (REAL) {
      const { data: d, error } = await banco().from('ferias').update({ aviso_em: data || null }).eq('id', f.id).eq('atualizado_em', f.atualizado_em).select('id');
      await cb().gravou('ferias');
      if (error) return traduz(error);
      if (!d.length) return 'Estas férias mudaram em outra tela. Nada foi gravado: confira.';
      redesenhar(); return '';
    }
    Object.assign(f, { avisoEm: data || null, atualizado_em: new Date().toISOString() }); avisarMudanca('ferias'); redesenhar(); return '';
  }

  // Salário mudou depois de programar e o recibo ainda não foi pago: a conta passa ao valor novo (visível, nunca sozinho)
  async function atualizarValor(foto) {
    const f = FERIAS.find(x => x.id === foto.id), conta = f && contaDe(f);
    if (!f || !conta) return 'Estas férias não têm conta a pagar.';
    if (conta.pagoEm) return 'O recibo já foi pago: a diferença vira acerto em Contas a pagar.';
    const novo = valorFerias(f).liquido;
    if (REAL) {
      const { data, error } = await banco().from('contas_pagar').update({ valor: novo }).eq('id', conta.id).is('pago_em', null).eq('atualizado_em', conta.atualizado_em).select('id');
      await cb().gravou('contas_pagar');
      if (error) return traduz(error);
      if (!data.length) return 'A conta a pagar mudou em outra tela (ou foi paga). Nada foi gravado: confira.';
      redesenhar(); return '';
    }
    CONTAS_PAGAR.find(x => x.id === conta.id).valor = novo; avisarMudanca('contas_pagar'); redesenhar(); return '';
  }

  // Contrato de experiência: inclui ou altera (conferindo se ninguém mudou antes)
  async function salvarContrato(c, dados, foto) {
    const e = pronto(); if (e) return e;
    const atual = contratoDe(c.id);
    if (foto && !atual) return 'Este contrato foi apagado em outra tela. Nada foi gravado.';
    if (!foto && atual) return 'Alguém acabou de cadastrar o contrato deste colaborador em outra tela. Feche e abra de novo.';
    if (foto && atual.atualizado_em !== foto.atualizado_em) return 'Alguém alterou este contrato em outra tela enquanto você editava. Nada foi gravado: confira o valor novo.';
    const err = await ESC.salvar('contratos_experiencia', { colaborador_id: c.id, ...dados }, atual);
    if (!err) redesenhar();
    return err;
  }

  const api = { REAL, NO_BANCO, REGRAS, br, fimDe, voltaDe, prazoAviso, prazoPagar, contaDe, pagoEm, ferias, valorFerias,
    contratos, contratoDe, experiencia, FASES, avisos, garantir, programarFerias, cancelarFerias, registrarAviso, atualizarValor, salvarContrato, aoGravar: null };
  return api;
})();
