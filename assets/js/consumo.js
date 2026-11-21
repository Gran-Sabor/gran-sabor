/* =====================================================================
   Gran Sabor · consumo.js — CONSUMO INTERNO DE FUNCIONÁRIO, NUM LUGAR SÓ
   Refeição do funcionário na loja (PDV, botão Funcionário/F11) ou lançada
   pelo RH. NÃO é venda ao consumidor: não tem NFC-e, não entra dinheiro no
   caixa e não gera conta a receber. Vira desconto no holerite (evento 110).

   O dado mora em LANCAMENTOS (evento 110): PDV, RH › Consumo interno,
   Lançamentos do mês e holerite leem a MESMA lista. Limite, autorização e
   mês de desconto são decididos aqui e só aqui.

   Regras (exemplo, o contador da Gran Sabor confirma):
   - Desconto em salário só com autorização prévia por escrito do
     funcionário (CLT art. 462). Sem autorização assinada, o PDV não lança.
   - Limite mensal por pessoa: o menor entre X% do salário e um teto em R$
     (a pessoa pode ter um limite próprio). Passou do limite, o PDV não lança:
     recebe como venda normal, com NFC-e.
   - Consumo feito depois do fechamento da folha entra no mês seguinte.
   ===================================================================== */
const REGRA_CONSUMO = dadoComum('REGRA_CONSUMO', () => ({ pctSalario: 20, teto: 400 }));
// Autorização de desconto assinada: { colab, assinadaEm, limite (opcional, R$), revogadaEm }
const AUTORIZACOES_CONSUMO = dadoComum('AUTORIZACOES_CONSUMO', () => (typeof COLABORADORES === 'undefined' ? [] : COLABORADORES)
  .filter(c => c.ativo && !['c0104', 'c0302'].includes(c.id))   // exemplo: dois ainda sem assinar
  .map(c => ({ id: 'au' + c.id, colab: c.id, assinadaEm: c.admissao, limite: null, revogadaEm: null })));

const CONSUMO = (() => {
  const r2 = v => Math.round(v * 100) / 100;
  const EVENTO = '110';
  const fechada = comp => FECHAMENTOS_FOLHA.some(f => f.comp === comp && !f.reabertaEm);
  const proxComp = c => { const [a, m] = c.split('-').map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`; };
  // Mês em que o consumo será descontado: o do dia, ou o primeiro mês com folha aberta depois dele
  function compDestino(data) { let c = data.slice(0, 7); for (let i = 0; i < 24 && fechada(c); i++) c = proxComp(c); return c; }

  const pessoa = id => COLABORADORES.find(c => c.id === id);
  const autorizacao = id => AUTORIZACOES_CONSUMO.find(a => a.colab === id && !a.revogadaEm) || null;
  const limitePadrao = c => r2(Math.min((c.salario || 0) * REGRA_CONSUMO.pctSalario / 100, REGRA_CONSUMO.teto));
  function limite(c) { const a = autorizacao(c.id); return a && a.limite != null ? r2(a.limite) : limitePadrao(c); }
  const doMes = (id, comp) => LANCAMENTOS.filter(l => l.evento === EVENTO && l.colab === id && l.comp === comp);
  const total = (id, comp) => r2(doMes(id, comp).reduce((s, l) => s + (l.valor || 0), 0));
  const disponivel = (c, comp) => r2(Math.max(0, limite(c) - total(c.id, comp)));

  /* Pode lançar este valor para esta pessoa nesta data? Devolve a mensagem que bloqueia, ou ''. */
  function bloqueio(id, valor, data = hojeISO()) {
    const c = pessoa(id);
    if (!c) return 'Colaborador não encontrado (foi apagado em outra tela).';
    if (!c.ativo || c.situacao === 'desligado') return `${c.nome} está desligado(a): consumo só como venda, com NFC-e.`;
    if (!(valor > 0)) return 'Informe o valor.';
    if (!autorizacao(id)) return `${c.nome} ainda não assinou a autorização de desconto em folha. Receba como venda (com NFC-e) ou registre a autorização em RH › Consumo interno.`;
    const comp = compDestino(data), disp = disponivel(c, comp);
    if (valor > disp + 0.001) return `Passa do limite do mês de ${c.nome}: disponível ${reais(disp)} de ${reais(limite(c))}. Receba como venda (com NFC-e) ou peça ao RH para mudar o limite.`;
    return '';
  }

  /* Grava o consumo na folha (um lançamento do evento 110). Quem chama confere antes com bloqueio(). */
  function lancar({ colab, data, hora = '', unidade, valor, obs = '', venda = null, origem = 'pdv' }) {
    const comp = compDestino(data);
    const l = { id: 'l' + (venda || Date.now().toString(36) + Math.random().toString(36).slice(2, 5)), comp, colab, evento: EVENTO, qtd: 0, valor: r2(valor),
      obs: obs || `Consumo na loja · ${nomeUnidade(unidade)} ${dataBR(data + 'T12:00')}${hora ? ' ' + hora : ''}`,
      venda, origem, unidade, data, hora, criadoEm: hojeISO() };
    LANCAMENTOS.push(l);
    return l;
  }
  const origem = l => l.origem || (l.venda ? 'pdv' : 'manual');

  /* Resumo do mês por colaborador e por empresa (3 CNPJs sempre separados) */
  function resumo(comp, filtro = () => true) {
    const linhas = COLABORADORES.filter(c => filtro(c) && (c.ativo || doMes(c.id, comp).length)).map(c => {
      const ls = doMes(c.id, comp), tot = r2(ls.reduce((s, l) => s + (l.valor || 0), 0)), lim = limite(c);
      return { colab: c, lancamentos: ls, qtd: ls.length, total: tot, limite: lim, disponivel: r2(Math.max(0, lim - tot)), uso: lim ? tot / lim : 0, autorizacao: autorizacao(c.id) };
    });
    const porEmpresa = {};
    EMPRESAS.forEach(e => porEmpresa[e.id] = { total: 0, qtd: 0, pessoas: 0 });
    linhas.forEach(x => { const t = porEmpresa[x.colab.empresa]; if (!t || !x.qtd) return; t.total = r2(t.total + x.total); t.qtd += x.qtd; t.pessoas++; });
    return { comp, linhas, porEmpresa, total: r2(linhas.reduce((s, x) => s + x.total, 0)) };
  }

  return { EVENTO, fechada, proxComp, compDestino, autorizacao, limitePadrao, limite, doMes, total, disponivel, bloqueio, lancar, origem, resumo };
})();
