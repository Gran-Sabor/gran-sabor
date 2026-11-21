/* =====================================================================
   Gran Sabor · caixas-banco.js — caixas e vendas do PDV no banco, ao vivo
   Roda na casca (sistema.html). As telas (PDV, Abertura e fechamento,
   Vendas do dia, Início...) continuam usando CAIXAS e VENDAS; com o banco
   ligado, essas duas listas passam a ser o espelho das tabelas:
   - ao entrar, a casca lê do banco os caixas abertos e os últimos DIAS_PDV
     dias de caixas e vendas, ANTES de abrir as abas;
   - quando uma tela grava (avisarMudanca('caixas' | 'vendas')), descobre o
     que mudou e grava no banco com conferência (atualizado_em): se outro
     computador mudou antes, nada é gravado e a tela mostra o valor novo;
   - quando o banco muda (Realtime), troca o conteúdo do MESMO objeto e
     todas as abas abertas se redesenham sozinhas.
   Sem as tabelas (migração ainda não aplicada) ou no modo demonstração,
   tudo segue como antes, com os dados de exemplo.
   ===================================================================== */
const DIAS_PDV = 40;   // vendas e caixas fechados mais antigos que isso não são carregados nas telas

const PDV_BANCO = (() => {
  const TAB = { caixas: 'CAIXAS', vendas: 'VENDAS' };
  const ORDEM = { caixas: c => c.abertoEm || '', vendas: v => (v.data || '') + (v.hora || '') };
  const salvo = { caixas: new Map(), vendas: new Map() };   // id → { json, em }: o que o banco tem
  const forcar = new Set();   // ids que devem receber o valor do banco mesmo com mudança local (conflito)
  let ligado = false, fila = Promise.resolve(), relogio = null, pendentesAvisados = 0;

  // Onde moram os dados comuns das abas (o mesmo lugar que tela.js · dadoComum usa)
  const raiz = () => {
    let w = window;
    try { while (w.parent !== w && w.parent.location.origin === location.origin) w = w.parent; } catch {}
    return w.__gsDados || (w.__gsDados = {});
  };
  const lista = t => raiz()[TAB[t]];
  const desde = () => { const d = new Date(); d.setDate(d.getDate() - DIAS_PDV);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // As duas tabelas entram no leitor comum (dados-banco.js): incremental e só os últimos dias
  TABELAS_BANCO.caixas = { ordem: 'aberto_em', incremental: true, filtro: q => q.or(`fechado_em.is.null,aberto_em.gte.${desde()}`) };
  TABELAS_BANCO.vendas = { ordem: 'data', incremental: true, filtro: q => q.gte('data', desde()) };

  /* ---------- Banco → telas ---------- */
  function mesclar(t) {
    const arr = lista(t); if (!arr) return;
    const porId = new Map(arr.map(o => [o.id, o]));
    let novos = false;
    for (const r of dadosBanco.lista(t)) {
      const s = salvo[t].get(r.id), o = porId.get(r.id);
      if (s && s.em === r.atualizado_em && !forcar.has(r.id)) continue;   // nada novo
      // Mudança feita aqui e ainda não gravada: quem decide é a gravação (com conferência)
      if (o && s && JSON.stringify(o) !== s.json && !forcar.has(r.id)) continue;
      const json = JSON.stringify(r.dados);
      salvo[t].set(r.id, { json, em: r.atualizado_em }); forcar.delete(r.id);
      if (o) { Object.keys(o).forEach(k => delete o[k]); Object.assign(o, JSON.parse(json)); }   // o MESMO objeto: quem já tem, vê o novo
      else { arr.push(JSON.parse(json)); novos = true; }
    }
    if (novos) arr.sort((a, b) => ORDEM[t](a).localeCompare(ORDEM[t](b)));
  }

  /* ---------- Telas → banco ---------- */
  const agendar = () => { clearTimeout(relogio); relogio = setTimeout(() => { fila = fila.then(gravarTudo).catch(e => console.warn('Caixas/vendas:', e)); }, 60); };

  async function gravarTudo() {
    let aguardando = 0;
    for (const t of ['caixas', 'vendas']) {   // caixa antes: a venda aponta para ele
      for (const o of [...(lista(t) || [])]) {
        const json = JSON.stringify(o), s = salvo[t].get(o.id);
        if (s && s.json === json) continue;
        const dados = JSON.parse(json);
        const res = s ? await db.from(t).update({ dados }).eq('id', o.id).eq('atualizado_em', s.em).select('id, atualizado_em')
                      : await db.from(t).insert({ id: o.id, dados }).select('id, atualizado_em');
        if (res.error) { if (await erro(t, o, res.error, !s)) aguardando++; continue; }
        if (!res.data?.length) { await conflito(t, o); continue; }
        salvo[t].set(o.id, { json, em: res.data[0].atualizado_em });
      }
    }
    if (aguardando && aguardando !== pendentesAvisados)
      aviso(`${aguardando} lançamento(s) do caixa ainda não chegaram ao banco (sem internet?). Ficam guardados nesta janela e sobem sozinhos quando a conexão voltar: não feche o sistema.`);
    if (!aguardando && pendentesAvisados) aviso('Conexão de volta: os lançamentos do caixa chegaram ao banco.');
    pendentesAvisados = aguardando;
  }

  // Devolve true quando vale tentar de novo depois (sem conexão, caixa da venda ainda subindo)
  async function erro(t, o, e, inclusao) {
    const unico = e.code === '23505', semRede = !e.code || /fetch|network|failed/i.test(e.message || '');
    if (t === 'caixas' && inclusao && unico && /um_aberto/.test(e.message || '')) {
      // Outro computador abriu este PDV antes: o caixa aberto aqui não vale
      const arr = lista(t); arr.splice(arr.indexOf(o), 1);
      popup('PDV já aberto', `O ${nomeUn(o.unidade)} · PDV ${o.pdv} foi aberto em outro computador antes. O caixa aberto aqui não foi gravado; a tela agora mostra o caixa que está valendo.`);
      await dadosBanco.gravou('caixas');
      return false;
    }
    if (unico) { forcar.add(o.id); await conflito(t, o); return false; }
    if (semRede || e.code === '23503') return true;   // 23503: a venda espera o caixa dela subir
    console.warn('Não foi possível gravar', t, o.id, e.message);
    popup('Não foi gravado', `Não foi possível gravar ${t === 'caixas' ? 'o caixa' : 'a venda'} no banco: ${e.message}`);
    return true;
  }

  async function conflito(t, o) {
    forcar.add(o.id);
    popup(t === 'caixas' ? 'Caixa alterado em outra tela' : 'Venda alterada em outra tela',
      `${t === 'caixas' ? `O caixa ${nomeUn(o.unidade)} · PDV ${o.pdv}` : `A venda de ${o.hora || ''}`} foi alterado(a) em outro computador antes de você. ` +
      'O que você fez agora NÃO foi gravado: a tela já mostra o valor atual. Confira e faça de novo, se ainda for preciso.');
    await dadosBanco.recarregar(t, true);
    await dadosBanco.gravou(t);   // relê e avisa todas as abas (mesclar troca o valor local pelo do banco)
  }

  /* ---------- Avisos na casca ---------- */
  const nomeUn = id => (UNIDADES.find(u => u.id === id) || {}).nome || id;
  function popup(titulo, texto) {
    const v = document.createElement('div'); v.className = 'veu';
    v.innerHTML = `<div class="janela" role="alertdialog" aria-modal="true"><div class="janela-cab"><h2>${esc(titulo)}</h2></div>
      <div class="janela-form"><p>${esc(texto)}</p></div><div class="janela-rodape"><button type="button" class="btn btn-pri">Entendi</button></div></div>`;
    v.querySelector('button').onclick = () => v.remove();
    document.body.appendChild(v); v.querySelector('button').focus();
  }
  function aviso(texto) {
    let el = document.getElementById('avisoPdvBanco');
    if (!el) { el = document.createElement('div'); el.id = 'avisoPdvBanco'; el.className = 'selo-atualizado'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = texto; el.classList.remove('oculto'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('oculto'), 12000);
  }

  /* ---------- Ligar ---------- */
  async function carregar() {
    try { await dadosBanco.garantir('caixas', 'vendas'); }
    catch (e) { console.warn('Caixas e vendas ainda não estão no banco:', e.message); return; }
    const g = raiz(); g.CAIXAS = []; g.VENDAS = [];   // antes de abrir as abas: nada de caixa ou venda de exemplo
    mesclar('caixas'); mesclar('vendas');
    ligado = true;
    dadosBanco.aoMudar(t => { if (TAB[t]) mesclar(t); });
    // Uma aba gravou (abriu caixa, vendeu, sangria, fechou, cancelou, transmitiu...): sobe para o banco
    window.addEventListener('message', e => { const d = e.data;
      if (e.origin === location.origin && d?.tipo === 'dados' && d.de !== 'banco' && d.tabelas?.some(t => TAB[t])) agendar(); });
    setInterval(() => { if (pendentesAvisados) agendar(); }, 15000);   // tenta de novo o que não subiu
    window.addEventListener('online', agendar);
  }

  return { carregar, ligado: () => ligado };
})();
