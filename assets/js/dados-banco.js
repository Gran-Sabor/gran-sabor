/* =====================================================================
   Gran Sabor · dados-banco.js — dados do banco num lugar só, sempre ao vivo
   Roda na casca (sistema.html). Cada tabela é lida uma vez e fica guardada
   aqui; todas as abas usam a MESMA lista (nenhuma tela guarda cópia).
   Ao vivo: o banco sobe a versão da tabela a cada gravação (dados_versao);
   a casca escuta pelo Supabase Realtime, relê só o que mudou e avisa todas
   as abas abertas (avisarMudanca), inclusive de outros computadores.
   ===================================================================== */
const TABELAS_BANCO = {
  unidades: { ordem: 'ordem' },
  // incremental: relê só as linhas alteradas desde a última leitura (tabelas grandes; nelas não se apaga linha)
  categorias_financeiras: { ordem: 'codigo' },
  contas_bancarias: { ordem: 'apelido' },
  contas_pagar: { ordem: 'vencimento', incremental: true },
  contas_receber: { ordem: 'vencimento', incremental: true },
  extrato_lancamentos: { ordem: 'data' }   // dentro do dia, a tela ordena pela coluna ordem
};

window.dadosBanco = (() => {
  const listas = {}, estado = {}, ouvintes = [];
  let canal = null, conectado = false;
  const POR_VEZ = 1000;   // o Supabase devolve no máximo 1.000 linhas por pedido

  // Lê em páginas de 1.000; depois da primeira (que diz o total), pede até 4 páginas ao mesmo tempo
  async function lerTudo(tabela, desde) {
    const cfg = TABELAS_BANCO[tabela];
    const pagina = (de, contar) => { let q = db.from(tabela).select('*', contar ? { count: 'exact' } : undefined);
      if (desde) q = q.gte('atualizado_em', desde);
      if (cfg.filtro) q = cfg.filtro(q);   // ex.: só os últimos dias (tabelas que crescem todo dia)
      return q.order(cfg.ordem).order('id').range(de, de + POR_VEZ - 1); };
    const { data, error, count } = await pagina(0, true);
    if (error) throw error;
    const linhas = [...data], resto = [];
    for (let de = POR_VEZ; de < (count ?? 0); de += POR_VEZ) resto.push(de);
    for (let i = 0; i < resto.length; i += 4) {
      const r = await Promise.all(resto.slice(i, i + 4).map(de => pagina(de)));
      for (const x of r) { if (x.error) throw x.error; linhas.push(...x.data); }
    }
    return linhas;
  }
  const maisRecente = l => l.reduce((m, r) => r.atualizado_em > m ? r.atualizado_em : m, '');

  // Lê (ou relê) a tabela e troca o conteúdo da lista sem trocar o objeto: quem já tem a lista vê o novo na hora
  async function recarregar(tabela, completo = false) {
    const cfg = TABELAS_BANCO[tabela], est = estado[tabela] || (estado[tabela] = {});
    if (est.lendo) { est.deNovo = true; return est.lendo; }
    est.lendo = (async () => {
      const lista = listas[tabela] || (listas[tabela] = []);
      if (cfg.incremental && est.ultimo && !completo) {
        // margem de 2 minutos: gravação que começou antes e terminou depois não fica de fora
        const desde = new Date(new Date(est.ultimo).getTime() - 120000).toISOString();
        const novas = await lerTudo(tabela, desde);
        const pos = new Map(lista.map((r, i) => [r.id, i]));
        novas.forEach(r => pos.has(r.id) ? (lista[pos.get(r.id)] = r) : lista.push(r));
        est.ultimo = maisRecente(novas) > est.ultimo ? maisRecente(novas) : est.ultimo;
      } else {
        const todas = await lerTudo(tabela);
        lista.splice(0, lista.length, ...todas);
        est.ultimo = maisRecente(todas);
      }
      est.carregado = true; est.lidoEm = Date.now();
      return lista;
    })();
    try { return await est.lendo; }
    finally { est.lendo = null; if (est.deNovo) { est.deNovo = false; recarregar(tabela).then(() => avisar(tabela)); } }
  }

  // Primeira vez que uma tela pede a tabela: lê do banco e passa a escutar
  async function garantir(...tabelas) {
    ligarAoVivo();
    await Promise.all(tabelas.map(t => estado[t]?.carregado ? null : recarregar(t)));
    return tabelas.map(t => listas[t]);
  }

  // Avisa todas as abas abertas desta janela (cada aba redesenha o que usa a tabela: vigiarDados)
  function avisar(tabela) {
    ouvintes.forEach(f => { try { f(tabela); } catch {} });
    const msg = { tipo: 'dados', tabelas: [tabela], quando: Date.now(), de: 'banco' };
    [window, ...Array.from({ length: window.frames.length }, (_, i) => window.frames[i])]
      .forEach(f => { try { f.postMessage(msg, location.origin); } catch {} });
  }

  // Depois de gravar: relê e avisa todas as abas (o Realtime também avisa, mas assim é imediato)
  async function gravou(...tabelas) {
    await Promise.all(tabelas.map(t => recarregar(t)));
    tabelas.forEach(avisar);
  }

  // Realtime: uma linha por tabela em dados_versao; cada gravação sobe a versão
  const pendentes = new Set(); let relogio = null;
  function ligarAoVivo() {
    if (canal || !window.db) return;
    canal = db.channel('gs-dados-versao')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dados_versao' }, p => {
        const t = p.new?.tabela; if (!t || !estado[t]?.carregado) return;
        pendentes.add(t); clearTimeout(relogio);
        // espera as gravações em lote terminarem (importação) antes de reler
        relogio = setTimeout(async () => {
          const ts = [...pendentes]; pendentes.clear();
          for (const x of ts) { try { await recarregar(x); avisar(x); } catch (e) { console.warn('Não foi possível reler', x, e.message); } }
        }, 700);
      })
      .subscribe(st => {
        const antes = conectado; conectado = st === 'SUBSCRIBED';
        // Voltou a conexão (internet caiu, computador dormiu): relê tudo o que está aberto
        if (conectado && antes === false && Object.keys(estado).length) Object.keys(estado).forEach(t => recarregar(t, true).then(() => avisar(t)));
        if (!conectado && antes) console.warn('Ao vivo desligado:', st);
      });
  }
  // Aba do navegador volta a ficar visível: confere se algo mudou enquanto estava escondida
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    Object.keys(estado).forEach(t => { if (estado[t].carregado && Date.now() - estado[t].lidoEm > 60000) recarregar(t).then(() => avisar(t)); });
  });

  return {
    garantir, recarregar, gravou,
    lista: t => listas[t] || (listas[t] = []),
    aoMudar: f => ouvintes.push(f),
    aoVivo: () => conectado
  };
})();
