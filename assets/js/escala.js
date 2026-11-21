/* =====================================================================
   Gran Sabor · escala.js — A ESCALA NUM LUGAR SÓ
   Quem trabalha em cada dia, em qual turno e unidade, faltas, cobertura
   mínima e freelancers. A tela Escala, a Configuração, Faltas e freelancers
   e a folha (desconto de falta) usam estas mesmas funções.
   Regra do dia (da mais forte para a mais fraca):
     fora do contrato > férias > afastado > exceção do dia (troca, folga,
     falta, atestado) > unidade fechada > padrão de folgas do colaborador.
   Dados: com o banco, as tabelas escala_* / feriados / freelancers /
   freela_diarias lidas pela casca (dados-banco.js), ao vivo pelo Realtime.
   Sem o banco: os mesmos formatos em memória (exemplo), avisando as abas.
   ===================================================================== */
const ESC = (() => {
  const cb = () => { try { return casca().dadosBanco || null; } catch { return null; } };
  const banco = () => (typeof db !== 'undefined' ? db : null);
  const REAL = RH_DO_BANCO && !!cb();   // ler basta a casca; gravar usa o db da tela (banco.js)
  const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  /* ---------- Datas e horas ---------- */
  const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const difDias = (a, b) => Math.round((new Date(a + 'T12:00') - new Date(b + 'T12:00')) / 864e5);
  const dow = iso => new Date(iso + 'T12:00').getDay();
  const hm = t => t ? String(t).slice(0, 5) : '';
  const minutos = t => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  // intervalo [a, b) em minutos; saída menor que a entrada = passa da meia-noite
  const faixa = (ini, fim) => { let a = minutos(ini), b = minutos(fim); if (a == null || b == null) return null; if (b <= a) b += 1440; return [a, b]; };
  const mod = (a, n) => ((a % n) + n) % n;
  const dm = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';

  /* ---------- Exemplo (mesmo formato das tabelas do banco) ---------- */
  function semente(t) {
    const agora = new Date().toISOString(), id = (p, i) => `${p}${i}`;
    if (t === 'escala_turnos') return Object.entries(TURNOS).filter(([k]) => k !== 'F').map(([codigo, [nome, h]], i) => {
      const [entrada, saida] = h.split('–'); return { id: id('t', codigo), codigo, nome, entrada, saida, intervalo_min: 60, ordem: i + 1, ativo: true, atualizado_em: agora }; });
    if (t === 'escala_funcionamento') {
      const r = [], add = (un, d, aberta, abre, fecha, minimo) => r.push({ id: id('h', un + d), unidade_id: un, dia_semana: d, aberta, abre, fecha, minimo, atualizado_em: agora });
      ['loja1', 'loja2', 'loja3'].forEach(un => { for (let d = 1; d <= 6; d++) add(un, d, true, '06:00', '22:20', 1); add(un, 0, true, '06:00', '16:00', 1); });
      for (let d = 1; d <= 6; d++) add('central', d, true, '06:00', '15:00', 1); add('central', 0, false, null, null, 0);
      for (let d = 1; d <= 5; d++) add('escritorio', d, true, '08:00', '18:00', 1); add('escritorio', 6, false, null, null, 0); add('escritorio', 0, false, null, null, 0);
      return r;
    }
    if (t === 'escala_padrao') return COLABORADORES.map(c => {
      const h = [...c.matricula].reduce((a, x) => a + x.charCodeAt(0), 0), com = c.turno === 'C';
      return { id: id('p', c.id), colaborador_id: c.id, regime: 'semanal', folgas: com ? [6] : [1 + (h % 6)], domingo: com ? 'folga' : 'dois_um', domingo_ref: com ? null : somaDias('2026-01-04', 7 * (h % 3)),
        ciclo_trabalho: null, ciclo_folga: null, ciclo_ref: null, turno_sabado: null, turno_domingo: null, atualizado_em: agora };
    });
    if (t === 'escala_dias') return COLABORADORES.some(c => c.id === 'c0304') ? [{ id: 'd1', colaborador_id: 'c0304', data: diasDaqui(-2), tipo: 'falta', turno: null, unidade_id: null, obs: 'Não avisou', atualizado_em: agora }] : [];
    if (t === 'freelancers') return [
      { id: 'fl1', nome: 'Freelancer Exemplo A', cpf: null, telefone: '', pix: '', funcao: 'Ajud. cozinha', diaria: 120, ativo: true, obs: '', atualizado_em: agora },
      { id: 'fl2', nome: 'Freelancer Exemplo B', cpf: null, telefone: '', pix: '', funcao: 'Atendente', diaria: 110, ativo: true, obs: '', atualizado_em: agora }];
    if (t === 'freela_diarias') return [
      { id: 'fd1', freelancer_id: 'fl1', unidade_id: 'loja3', data: diasDaqui(-2), entrada: '10:00', saida: '18:20', funcao: 'Ajud. cozinha', motivo: 'falta', cobre_colaborador_id: 'c0304', valor: 120, situacao: 'trabalhou', conta_pagar_id: null, obs: '', atualizado_em: agora },
      { id: 'fd2', freelancer_id: 'fl2', unidade_id: 'loja1', data: diasDaqui(2), entrada: '11:00', saida: '15:00', funcao: 'Atendente', motivo: 'demanda', cobre_colaborador_id: null, valor: 60, situacao: 'combinada', conta_pagar_id: null, obs: 'Evento na região', atualizado_em: agora }];
    return [];
  }
  const L = t => REAL ? cb().lista(t) : dadoComum('ESC_' + t, () => semente(t));

  /* ---------- Unidades: no banco a ligação é pelo id; nas telas, pelo código (loja1...) ---------- */
  const unidadesBanco = () => REAL ? cb().lista('unidades') : [];
  const unCod = id => REAL ? ((unidadesBanco().find(u => u.id === id) || {}).codigo || '') : id;
  const unId = cod => REAL ? ((unidadesBanco().find(u => u.codigo === cod) || {}).id || null) : cod;
  const unidadesEscala = () => UNIDADES.filter(u => u.id !== 'todas');

  /* ---------- Cadastros da escala ---------- */
  const turnos = () => L('escala_turnos').filter(t => t.ativo).sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo));
  const turno = cod => L('escala_turnos').find(t => t.codigo === cod) || null;
  const funcionamento = (un, d) => L('escala_funcionamento').find(f => unCod(f.unidade_id) === un && f.dia_semana === d) || null;
  const padraoDe = cId => L('escala_padrao').find(p => p.colaborador_id === cId) || null;
  const excecao = (cId, iso) => L('escala_dias').find(x => x.colaborador_id === cId && x.data === iso) || null;
  const feriados = () => REAL ? L('feriados') : Object.entries(FERIADOS).map(([data, nome]) => ({ id: data, data, nome })).sort((a, b) => a.data.localeCompare(b.data));
  const freelancers = () => L('freelancers');
  const freelancer = id => freelancers().find(f => f.id === id) || { nome: '?' };
  const diarias = () => L('freela_diarias');
  const valeDiaria = x => !['cancelada', 'nao_veio'].includes(x.situacao);

  /* ---------- O dia de um colaborador ---------- */
  // tipo: turno | folga | falta | atestado | abonada | ferias | afastado | fechada | fora
  function dia(c, iso) {
    if (!c || !c.id) return { tipo: 'fora' };
    if ((!c.semAdmissao && c.admissao > iso) || (c.demissao && iso > c.demissao) || (c.situacao === 'desligado' && !c.demissao)) return { tipo: 'fora' };
    if (c.situacao === 'ferias' || FERIAS.some(f => f.colab === c.id && iso >= f.inicio && iso <= somaDias(f.inicio, f.dias - 1))) return { tipo: 'ferias' };
    if (c.situacao === 'afastado') return { tipo: 'afastado' };
    const ex = excecao(c.id, iso);
    if (ex) return ex.tipo === 'turno' ? { tipo: 'turno', turno: ex.turno, unidade: ex.unidade_id ? unCod(ex.unidade_id) : c.unidade, origem: 'dia', ex }
      : { tipo: ex.tipo, origem: 'dia', ex };
    return padrao(c, iso);
  }
  function padrao(c, iso) {
    const d = dow(iso), f = funcionamento(c.unidade, d);
    if (f && !f.aberta) return { tipo: 'fechada', origem: 'padrao' };
    const p = padraoDe(c.id) || { regime: 'semanal', folgas: [], domingo: 'folga', semPadrao: true };
    const trab = () => ({ tipo: 'turno', turno: (d === 6 && p.turno_sabado) || (d === 0 && p.turno_domingo) || c.turno, unidade: c.unidade, origem: 'padrao', semPadrao: p.semPadrao });
    const folga = { tipo: 'folga', origem: 'padrao', semPadrao: p.semPadrao };
    if (p.regime === 'ciclo' && p.ciclo_ref && p.ciclo_trabalho && p.ciclo_folga)
      return mod(difDias(iso, p.ciclo_ref), p.ciclo_trabalho + p.ciclo_folga) < p.ciclo_folga ? folga : trab();
    if (d === 0) {
      if (p.domingo === 'trabalha') return trab();
      const ciclo = p.domingo === 'alternado' ? 2 : p.domingo === 'dois_um' ? 3 : 0;
      if (!ciclo) return folga;
      return p.domingo_ref && mod(Math.round(difDias(iso, p.domingo_ref) / 7), ciclo) === 0 ? folga : trab();
    }
    return (p.folgas || []).map(Number).includes(d) ? folga : trab();
  }
  const trabalha = r => r.tipo === 'turno';
  const SIGLA = { folga: 'F', falta: 'FA', atestado: 'AT', abonada: 'AB', ferias: 'Fér', afastado: 'Af', fechada: '–', fora: '' };
  const NOME = { turno: 'Trabalha', folga: 'Folga', falta: 'Falta (desconta)', atestado: 'Atestado', abonada: 'Falta abonada', ferias: 'Férias', afastado: 'Afastado', fechada: 'Unidade fechada', fora: 'Fora do contrato' };
  const sigla = r => r.tipo === 'turno' ? r.turno : SIGLA[r.tipo] ?? '';
  const horario = r => { const t = r.tipo === 'turno' && turno(r.turno); return t ? `${hm(t.entrada)}–${hm(t.saida)}` : ''; };

  /* ---------- Cobertura: quantas pessoas ao mesmo tempo, de meia em meia hora ---------- */
  function cobertura(un, iso) {
    const f = funcionamento(un, dow(iso));
    const pessoas = COLABORADORES.filter(c => c.ativo).map(c => ({ c, r: dia(c, iso) })).filter(x => trabalha(x.r) && x.r.unidade === un);
    const extras = diarias().filter(x => unCod(x.unidade_id) === un && x.data === iso && valeDiaria(x));
    const base = { n: pessoas.length + extras.length, pessoas, extras, f, buracos: [], minimo: f?.minimo ?? null };
    if (!f) return { ...base, semConfig: true };
    if (!f.aberta) return { ...base, fechada: true };
    const faixas = [...pessoas.map(p => { const t = turno(p.r.turno); return t && faixa(t.entrada, t.saida); }), ...extras.map(x => faixa(x.entrada, x.saida))].filter(Boolean);
    const [a, b] = faixa(f.abre, f.fecha); let atual = null;
    for (let m = a; m < b; m += 30) {
      const q = faixas.filter(([i, s]) => (m >= i && m < s) || (m + 1440 >= i && m + 1440 < s)).length;
      if (q < f.minimo) { if (atual) { atual.fim = m + 30; atual.falta = Math.max(atual.falta, f.minimo - q); } else atual = { ini: m, fim: m + 30, falta: f.minimo - q }; }
      else if (atual) { base.buracos.push(atual); atual = null; }
    }
    if (atual) base.buracos.push(atual);
    base.buracos.forEach(x => x.fim = Math.min(x.fim, b));
    return base;
  }
  const textoBuracos = bs => bs.map(x => `${hhmm(x.ini)}–${hhmm(x.fim)} (falta${x.falta > 1 ? 'm' : ''} ${x.falta})`).join(', ');

  /* ---------- Faltas (a folha desconta daqui: nada de lançar de novo) ---------- */
  const faltasEntre = (c, ini, fim, tipos = ['falta']) => L('escala_dias').filter(x => x.colaborador_id === c.id && tipos.includes(x.tipo) && x.data >= ini && x.data <= fim);
  const faltasNoMes = (c, comp) => faltasEntre(c, comp + '-01', comp + '-31').length;

  /* ---------- Alertas da escala de um colaborador numa janela ---------- */
  function alertas(c, inicio, dias) {
    const a = [], ds = Array.from({ length: dias + 21 }, (_, i) => somaDias(inicio, i - 21));
    let seg = 0, max = 0, ate = '';
    ds.forEach(d => { if (trabalha(dia(c, d))) { seg++; if (seg > max) { max = seg; ate = d; } } else seg = 0; });
    if (max > 6 && ate >= inicio) a.push(`${max} dias seguidos sem folga (até ${dm(ate)})`);
    const doms = ds.filter(d => dow(d) === 0 && d >= somaDias(inicio, -7));
    for (let i = 0; i + 2 < doms.length; i++) if (doms.slice(i, i + 3).every(d => trabalha(dia(c, d)))) { a.push(`3 domingos seguidos trabalhando (até ${dm(doms[i + 2])})`); break; }
    return a;
  }

  /* ---------- Gravar ---------- */
  const novoId = () => REAL ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const traduz = e => e.code === '23505' ? 'Já existe um registro igual (alguém gravou agora em outra tela?). Confira e tente de novo.'
    : e.code === '23514' ? 'Algum valor não é aceito pelo banco: ' + e.message : e.message;
  function depoisMemoria(t) {
    if (t === 'escala_turnos') { Object.keys(TURNOS).forEach(k => delete TURNOS[k]); turnos().forEach(x => TURNOS[x.codigo] = [x.nome, `${hm(x.entrada)}–${hm(x.saida)}`]); TURNOS.F = ['Folga', '']; }
  }
  const avisar = async (...ts) => { if (REAL) await cb().gravou(...ts); else ts.forEach(t => { depoisMemoria(t); avisarMudanca(t); }); };
  // A própria tela redesenha depois de gravar (o aviso às abas não volta para quem avisou)
  const redesenhar = () => { try { api.aoGravar?.(); } catch (e) { console.warn(e); } };
  // Grava (inclui ou altera conferindo se ninguém mudou antes). Devolve '' ou o texto do erro.
  async function salvar(tabela, dados, atual) { const e = await salvar0(tabela, dados, atual); if (!e) redesenhar(); return e; }
  async function apagar(tabela, atual) { const e = await apagar0(tabela, atual); if (!e) redesenhar(); return e; }
  async function salvar0(tabela, dados, atual) {
    if (REAL) {
      if (atual) {
        const { data, error } = await banco().from(tabela).update(dados).eq('id', atual.id).eq('atualizado_em', atual.atualizado_em).select('id');
        if (error) return traduz(error);
        if (!data.length) { await cb().gravou(tabela); return 'Alguém alterou isto em outra tela enquanto você editava. Nada foi gravado: confira o valor novo.'; }
      } else { const { error } = await banco().from(tabela).insert({ id: novoId(), ...dados }); if (error) return traduz(error); }
      await cb().gravou(tabela); return '';
    }
    const lista = L(tabela), agora = new Date().toISOString();
    if (atual) {
      const x = lista.find(y => y.id === atual.id);
      if (!x) return 'Isto foi apagado em outra tela. Nada foi gravado.';
      if (x.atualizado_em !== atual.atualizado_em) return 'Alguém alterou isto em outra tela enquanto você editava. Nada foi gravado: confira o valor novo.';
      Object.assign(x, dados, { atualizado_em: agora });
    } else lista.push({ id: novoId(), criado_em: agora, ...dados, atualizado_em: agora });
    depoisMemoria(tabela); avisarMudanca(tabela); return '';
  }
  async function apagar0(tabela, atual) {
    if (REAL) {
      const { data, error } = await banco().from(tabela).delete().eq('id', atual.id).eq('atualizado_em', atual.atualizado_em).select('id');
      if (error) return traduz(error);
      await cb().gravou(tabela);
      return data.length ? '' : 'Isto mudou em outra tela. Nada foi apagado: confira.';
    }
    const lista = L(tabela), i = lista.findIndex(y => y.id === atual.id);
    if (i < 0) return '';
    if (lista[i].atualizado_em !== atual.atualizado_em) return 'Isto mudou em outra tela. Nada foi apagado: confira.';
    lista.splice(i, 1); depoisMemoria(tabela); avisarMudanca(tabela); return '';
  }

  /* ---------- Colaborador (turno padrão mora no cadastro) ---------- */
  async function salvarColaborador(c, dados) {
    const atual = COLABORADORES.find(x => x.id === c.id);
    if (!atual) return 'Colaborador não encontrado (saiu do cadastro?).';
    if (REAL) {
      const { data, error } = await banco().from('colaboradores').update(dados).eq('id', c.id).eq('atualizado_em', c.atualizado_em).select('id');
      if (error) return traduz(error);
      await cb().gravou('colaboradores');
      if (!data.length) return 'O cadastro deste colaborador mudou em outra tela. Nada foi gravado: confira e tente de novo.';
    } else { Object.assign(atual, dados); avisarMudanca('colaboradores'); }
    redesenhar(); return '';
  }

  /* ---------- Pagamento do freelancer → contas a pagar ---------- */
  async function garantirPagar() { if (REAL) await cb().garantir('contas_pagar', 'categorias_financeiras'); }
  function contaDe(x) {
    if (!x.conta_pagar_id) return null;
    if (REAL) { const c = cb().lista('contas_pagar').find(y => y.id === x.conta_pagar_id); return c ? { valor: Number(c.valor), pago: !!c.pago_em, pagoEm: c.pago_em, vencimento: c.vencimento } : null; }
    const c = CONTAS_PAGAR.find(y => y.id === x.conta_pagar_id); return c ? { valor: c.valor, pago: !!c.pagoEm, pagoEm: c.pagoEm, vencimento: c.vencimento } : null;
  }
  // Uma conta a pagar por diária (chave freela:<id>: gerar de novo não duplica). Relê a diária antes.
  async function gerarPagamento(foto, vencimento) { const e = await gerarPagamento0(foto, vencimento); redesenhar(); return e; }
  async function gerarPagamento0(foto, vencimento) {
    const atual = diarias().find(y => y.id === foto.id);
    const mudou = mudouDesde(foto, atual, ['valor', 'situacao', 'conta_pagar_id', 'data', 'freelancer_id', 'unidade_id'], 'A diária');
    if (mudou) return mudou;
    if (atual.situacao !== 'trabalhou') return 'Só gera pagamento de diária marcada como "trabalhou".';
    if (atual.conta_pagar_id) return 'Esta diária já tem conta a pagar.';
    if (!(Number(atual.valor) > 0)) return 'Informe o valor da diária antes de gerar o pagamento.';
    const fl = freelancer(atual.freelancer_id), un = unCod(atual.unidade_id), contaId = novoId();
    const doc = `Diária ${dm(atual.data)}`, obs = `${fl.nome} · ${atual.funcao || 'freelancer'} · ${hm(atual.entrada)}–${hm(atual.saida)}${fl.pix ? ' · Pix ' + fl.pix : ''}`;
    if (REAL) {
      const cats = cb().lista('categorias_financeiras').filter(c => c.tipo === 'despesa' && c.ativo);
      const cat = cats.find(c => /freela|diarist/i.test(c.nome)) || cats.find(c => /folha/i.test(c.grupo)) || null;
      const { error } = await banco().from('contas_pagar').insert({ id: contaId, unidade_id: atual.unidade_id, categoria_id: cat?.id || null, favorecido: ('Freelancer · ' + fl.nome).slice(0, 120),
        documento: doc, valor: Number(atual.valor), vencimento, obs: obs.slice(0, 500), origem: 'freela', chave_importacao: 'freela:' + atual.id });
      if (error) { await cb().gravou('freela_diarias', 'contas_pagar'); return traduz(error); }
      const { data, error: e2 } = await banco().from('freela_diarias').update({ conta_pagar_id: contaId }).eq('id', atual.id).eq('atualizado_em', atual.atualizado_em).select('id');
      await cb().gravou('freela_diarias', 'contas_pagar');
      if (e2 || !data.length) return 'A conta a pagar foi criada, mas a diária mudou em outra tela. Confira as duas.';
      return '';
    }
    CONTAS_PAGAR.push({ id: contaId, fornecedor: null, favorecido: 'Freelancer · ' + fl.nome, categoria: '4.01', unidade: un, empresa: UNIDADE_EMPRESA[un], centro: null,
      documento: doc, valor: Number(atual.valor), vencimento, pagoEm: null, valorPago: null, forma: '', obs, origem: 'freela' });
    Object.assign(atual, { conta_pagar_id: contaId, atualizado_em: new Date().toISOString() });
    avisarMudanca('freela_diarias', 'contas_pagar'); return '';
  }

  const api = { REAL, SEM, SEMANA, NOME, somaDias, difDias, dow, hm, dm, faixa, hhmm, unCod, unId, unidadesEscala,
    turnos, turno, funcionamento, padraoDe, excecao, feriados, freelancers, freelancer, diarias, valeDiaria,
    dia, padrao, trabalha, sigla, horario, cobertura, textoBuracos, faltasEntre, faltasNoMes, alertas,
    lista: L, salvar, apagar, avisar, salvarColaborador, novoId, garantirPagar, contaDe, gerarPagamento, aoGravar: null };
  return api;
})();

/* ---------- Janela da diária de freelancer (usada na Escala e em Faltas e freelancers) ----------
   preset: { unidade, data, motivo, cobre, entrada, saida } para nova diária. */
ESC.MOTIVOS = { falta: 'Cobrir falta', folga: 'Cobrir folga', ferias: 'Cobrir férias', demanda: 'Movimento alto', evento: 'Evento', outro: 'Outro' };
ESC.SITUACOES = { combinada: 'Combinada', trabalhou: 'Trabalhou', nao_veio: 'Não veio', cancelada: 'Cancelada' };
ESC.janelaDiaria = function (atual, preset = {}) {
  const x = atual || { unidade_id: ESC.unId(preset.unidade || 'loja1'), data: preset.data || hojeISO(), entrada: preset.entrada || '11:00', saida: preset.saida || '15:00',
    motivo: preset.motivo || 'demanda', cobre_colaborador_id: preset.cobre || null, situacao: 'combinada', valor: null, funcao: '', obs: '', freelancer_id: '' };
  const foto = atual ? JSON.parse(JSON.stringify(atual)) : null, temConta = !!x.conta_pagar_id, ro = temConta ? ' disabled' : '';
  const fls = ESC.freelancers().filter(f => f.ativo || f.id === x.freelancer_id);
  const un = ESC.unCod(x.unidade_id);
  const opUn = ESC.unidadesEscala().map(u => `<option value="${u.id}"${u.id === un ? ' selected' : ''}>${esc(u.nome)}</option>`).join('');
  const opCol = cod => `<option value="">— ninguém —</option>` + COLABORADORES.filter(c => c.ativo && c.unidade === cod).map(c => `<option value="${c.id}"${c.id === x.cobre_colaborador_id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');
  const corpo = `<div class="form-grade">
    <label class="c6">Freelancer<select name="fl" class="campo"${ro}><option value="">— escolha ou cadastre ao lado —</option>${fls.map(f => `<option value="${f.id}"${f.id === x.freelancer_id ? ' selected' : ''}>${esc(f.nome)}${f.funcao ? ' · ' + esc(f.funcao) : ''}</option>`).join('')}</select></label>
    <label class="c6">ou novo freelancer (nome)<input name="novo" class="campo" maxlength="80" placeholder="Nome completo"${ro}></label>
    <label class="c4">Unidade<select name="un" class="campo"${ro}>${opUn}</select></label>
    <label class="c4">Dia<input name="data" type="date" class="campo" value="${x.data}"${ro}></label>
    <label class="c2">Entrada<input name="ent" type="time" class="campo" value="${ESC.hm(x.entrada)}"></label>
    <label class="c2">Saída<input name="sai" type="time" class="campo" value="${ESC.hm(x.saida)}"></label>
    <label class="c4">Motivo<select name="motivo" class="campo">${Object.entries(ESC.MOTIVOS).map(([k, n]) => `<option value="${k}"${k === x.motivo ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="c8">Cobrindo quem<select name="cobre" class="campo">${opCol(un)}</select></label>
    <label class="c4">Função<input name="funcao" class="campo" maxlength="40" value="${esc(x.funcao)}" placeholder="Ex.: Ajud. cozinha"></label>
    <label class="c4">Valor (R$)<input name="valor" class="campo" inputmode="decimal" value="${x.valor != null ? numero(x.valor, 2) : ''}"${ro}></label>
    <label class="c4">Situação<select name="sit" class="campo"${ro}>${Object.entries(ESC.SITUACOES).map(([k, n]) => `<option value="${k}"${k === x.situacao ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="c12">Observação<input name="obs" class="campo" maxlength="200" value="${esc(x.obs)}"></label></div>
    <div class="form-nota">${temConta ? 'Pagamento já gerado em Contas a pagar: valor, dia e situação ficam travados. Diferença? Ajuste em Contas a pagar, com acerto visível.'
      : 'Depois que o freelancer trabalhar, marque "Trabalhou" e gere o pagamento em Faltas e freelancers: vira conta a pagar na hora.'}
    ${atual && !temConta ? ' <button type="button" class="btn btn-mini" data-excluir>Excluir diária</button>' : ''}</div>`;
  const v = janela(atual ? `Diária · ${ESC.freelancer(x.freelancer_id).nome}` : 'Novo freelancer na escala', corpo, 'Salvar', async f => {
    const valor = f.valor.value.trim() === '' ? 0 : Number(f.valor.value.replace(/\./g, '').replace(',', '.'));
    if (!f.fl.value && !f.novo.value.trim()) return 'Escolha o freelancer ou digite o nome de um novo.';
    if (!f.data.value || !f.ent.value || !f.sai.value) return 'Informe dia, entrada e saída.';
    if (!(valor >= 0)) return 'Valor inválido.';
    if (atual) { const agora = ESC.diarias().find(y => y.id === atual.id); const m = mudouDesde(foto, agora, Object.keys(foto), 'A diária'); if (m) return m; }
    let fl = f.fl.value;
    if (!fl) {
      fl = ESC.novoId();
      const e = await ESC.salvar('freelancers', { id: fl, nome: f.novo.value.trim(), funcao: f.funcao.value.trim(), diaria: valor, ativo: true });
      if (e) return e;
    }
    const dados = { entrada: f.ent.value, saida: f.sai.value, motivo: f.motivo.value, cobre_colaborador_id: f.cobre.value || null, funcao: f.funcao.value.trim(), obs: f.obs.value.trim() };
    if (!temConta) Object.assign(dados, { freelancer_id: fl, unidade_id: ESC.unId(f.un.value), data: f.data.value, valor, situacao: f.sit.value });
    return ESC.salvar('freela_diarias', dados, atual);
  });
  const f = v.querySelector('form');
  // valor sugerido = diária do cadastro; trocar a unidade troca a lista de quem é coberto
  f.fl.onchange = () => { const d = ESC.freelancer(f.fl.value); if (d.diaria && !f.valor.value) f.valor.value = numero(d.diaria, 2); if (d.funcao && !f.funcao.value) f.funcao.value = d.funcao; };
  f.un.onchange = () => { f.cobre.innerHTML = opCol(f.un.value); };
  v.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    const e = await ESC.apagar('freela_diarias', atual); if (e) v.querySelector('#fMsg').textContent = e; else v.remove(); });
  return v;
};
