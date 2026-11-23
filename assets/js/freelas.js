/* =====================================================================
   Gran Sabor · freelas.js — FREELANCERS NUM LUGAR SÓ
   Contratação (ficha e documentos), controle de habitualidade (risco de
   vínculo de emprego), avaliação, custo por empresa/unidade/motivo e
   pagamento (diárias → contas a pagar). A tela Freelancers, a Escala e
   quem calcula custo de pessoal usam estas mesmas funções.
   Dados: tabelas freelancers e freela_diarias pela escala.js (ESC), ao vivo.
   Regras de EXEMPLO (confirmar com o contador): ver FL.REGRA.
   ===================================================================== */
const FL = (() => {
  /* Habitualidade: diarista chamado com frequência pode virar vínculo de emprego (CLT art. 3º).
     Regra de exemplo: atenção a partir de 3 diárias numa mesma semana (seg a dom)
     ou de 9 diárias em 30 dias; risco alto a partir de 4 na semana ou 13 em 30 dias. */
  const REGRA = { semanaAtencao: 3, semanaAlto: 4, trintaAtencao: 9, trintaAlto: 13 };

  const vale = x => ESC.valeDiaria(x);
  const unidade = x => ESC.unCod(x.unidade_id);
  const empresa = x => UNIDADE_EMPRESA[unidade(x)];
  const doFreela = id => ESC.diarias().filter(x => x.freelancer_id === id && vale(x));
  const segunda = iso => ESC.somaDias(iso, -((ESC.dow(iso) + 6) % 7));

  /* ---------- Habitualidade ---------- */
  // Situação do freelancer em torno de uma data (padrão: hoje), contando uma diária a mais se "extra" vier.
  function habitualidade(id, ref = hojeISO(), extra = null) {
    const ds = doFreela(id).map(x => x.data);
    if (extra && !ds.includes(extra)) ds.push(extra);
    const ini = ESC.somaDias(ref, -29), fim = ESC.somaDias(ref, 29);
    const trinta = ds.filter(d => d >= ini && d <= ref).length;
    // maior semana em volta da data (4 semanas antes e depois): a diária marcada para a frente também conta
    const porSemana = {}; ds.filter(d => d >= ini && d <= fim).forEach(d => { const s = segunda(d); porSemana[s] = (porSemana[s] || 0) + 1; });
    const sem = Object.entries(porSemana).sort((a, b) => b[1] - a[1])[0] || ['', 0];
    const nivel = sem[1] >= REGRA.semanaAlto || trinta >= REGRA.trintaAlto ? 'alto'
      : sem[1] >= REGRA.semanaAtencao || trinta >= REGRA.trintaAtencao ? 'atencao' : '';
    const partes = [];
    if (sem[1] >= REGRA.semanaAtencao) partes.push(`${sem[1]} diárias na semana de ${ESC.dm(sem[0])}`);
    if (trinta >= REGRA.trintaAtencao) partes.push(`${trinta} diárias em 30 dias`);
    return { nivel, semana: sem[1], semanaDe: sem[0], trinta, texto: partes.join(' e ') };
  }
  const etqHabitual = h => h.nivel === 'alto' ? `<span class="etiqueta perigo" title="${esc(h.texto)}">risco de vínculo</span>`
    : h.nivel === 'atencao' ? `<span class="etiqueta pendente" title="${esc(h.texto)}">atenção: frequência</span>` : '';
  // Texto do aviso ao marcar mais uma diária (vazio = tudo bem)
  function avisoHabitual(id, data) {
    if (!id || !data) return '';
    const antes = habitualidade(id, data), depois = habitualidade(id, data, data);
    if (!depois.nivel || depois.nivel === antes.nivel && depois.semana === antes.semana && depois.trinta === antes.trinta) return '';
    return `${ESC.freelancer(id).nome}: ${depois.texto}. ${depois.nivel === 'alto' ? 'Risco alto de vínculo de emprego' : 'Frequência alta'}: chamar com frequência pode caracterizar vínculo (regra de exemplo, confirmar com o contador). Considere outro freelancer ou contratar.`;
  }

  /* ---------- Ficha de contratação ---------- */
  function pendencias(f) {
    const p = [];
    if (!f.cpf) p.push('CPF');
    if (!f.doc_identidade) p.push('documento com foto');
    if (!f.doc_endereco) p.push('comprovante de endereço');
    if (!f.termo_assinado_em) p.push('termo assinado');
    if (!f.pix) p.push('Pix');
    if (!f.telefone) p.push('telefone');
    return p;
  }
  const situacao = f => f.bloqueado ? 'bloqueado' : f.ativo ? 'ativo' : 'inativo';
  const podeChamar = f => !!f && f.ativo && !f.bloqueado;
  function avaliacao(id) {
    const ns = doFreela(id).map(x => Number(x.avaliacao)).filter(n => n >= 1);
    return ns.length ? { media: ns.reduce((a, n) => a + n, 0) / ns.length, n: ns.length } : null;
  }
  const estrelas = n => n ? '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)) : '';

  /* ---------- Custo (diárias que valem; pago ou não) ---------- */
  // filtro: { de, ate, empresa, unidade } (mesmos campos da barra de filtros)
  function custo(f = {}) {
    const de = f.de || '0000', ate = f.ate || '9999';
    return ESC.diarias().filter(x => vale(x) && x.data >= de && x.data <= ate)
      .map(x => ({ x, un: unidade(x), empresa: empresa(x), valor: Number(x.valor || 0), conta: contaDe(x) }))
      .filter(i => noFiltro(f, { empresa: i.empresa, unidade: i.un }));
  }
  const soma = l => l.reduce((a, i) => a + (i.valor ?? Number(i.x?.valor || 0)), 0);

  /* ---------- Pagamento ---------- */
  // Conta a pagar ligada à diária; "diarias" = quantas diárias e quanto somam nessa mesma conta
  function contaDe(x) {
    const c = ESC.contaDe(x); if (!c) return null;
    const juntas = ESC.diarias().filter(y => y.conta_pagar_id === x.conta_pagar_id);
    return { ...c, diarias: juntas.length, somaDiarias: juntas.reduce((a, y) => a + Number(y.valor || 0), 0) };
  }
  const categoria = () => {
    const cats = ESC.REAL ? casca().dadosBanco.lista('categorias_financeiras').filter(c => c.tipo === 'despesa' && c.ativo) : [];
    return cats.find(c => /freela|diarist/i.test(c.nome)) || cats.find(c => /folha|pessoal/i.test(c.grupo || '')) || null;
  };
  // fotos: diárias como a tela mostrou. juntar = uma conta por freelancer e unidade. Devolve '' ou os erros.
  async function gerarPagamentos(fotos, vencimento, juntar) {
    const grupos = {};
    fotos.forEach(x => { const k = juntar ? x.freelancer_id + '|' + x.unidade_id : x.id; (grupos[k] = grupos[k] || []).push(x); });
    const erros = [];
    for (const l of Object.values(grupos)) {
      const nome = ESC.freelancer(l[0].freelancer_id).nome, e = await gerarUma(l, vencimento);
      if (e) erros.push(`${nome} (${l.map(x => ESC.dm(x.data)).join(', ')}): ${e}`);
    }
    ESC.aoGravar?.();
    return erros.join(' · ');
  }
  async function gerarUma(l, vencimento) {
    // confere na hora de confirmar: a diária ainda é a mesma que a pessoa viu?
    for (const foto of l) {
      const atual = ESC.diarias().find(y => y.id === foto.id);
      const m = mudouDesde(foto, atual, ['valor', 'situacao', 'conta_pagar_id', 'data', 'freelancer_id', 'unidade_id', 'atualizado_em'], 'A diária');
      if (m) return m;
      if (atual.situacao !== 'trabalhou') return 'só gera pagamento de diária marcada como "Trabalhou".';
      if (!(Number(atual.valor) > 0)) return 'informe o valor da diária antes de gerar o pagamento.';
    }
    if (ESC.REAL) {
      const { error } = await db.rpc('gerar_pagamento_freela', { p_diarias: l.map(x => x.id), p_fotos: l.map(x => x.atualizado_em), p_vencimento: vencimento, p_categoria: categoria()?.id || null });
      await ESC.avisar('freela_diarias', 'contas_pagar');
      if (error) return /DIARIA_MUDOU/.test(error.message) ? 'a diária mudou em outra tela ou já tem pagamento. Nada foi gerado: confira o valor novo.' : error.message;
      return '';
    }
    // exemplo (sem banco): mesma regra, em memória
    const atuais = l.map(f => ESC.diarias().find(y => y.id === f.id)), x0 = atuais[0], fl = ESC.freelancer(x0.freelancer_id), un = unidade(x0);
    const datas = atuais.map(x => ESC.dm(x.data)).sort().join(', '), contaId = ESC.novoId(), total = atuais.reduce((a, x) => a + Number(x.valor), 0);
    CONTAS_PAGAR.push({ id: contaId, fornecedor: null, favorecido: 'Freelancer · ' + fl.nome, categoria: '4.01', unidade: un, empresa: UNIDADE_EMPRESA[un], centro: null,
      documento: (atuais.length > 1 ? atuais.length + ' diárias ' : 'Diária ') + datas, valor: total, vencimento, pagoEm: null, valorPago: null, forma: '',
      obs: fl.nome + (fl.pix ? ' · Pix ' + fl.pix : '') + ' · ' + datas, origem: 'freela' });
    const agora = new Date().toISOString(); atuais.forEach(x => Object.assign(x, { conta_pagar_id: contaId, atualizado_em: agora }));
    avisarMudanca('freela_diarias', 'contas_pagar'); return '';
  }

  /* ---------- Convite pelo WhatsApp (mensagem pronta) ---------- */
  function linkConvite(x) {
    const f = ESC.freelancer(x.freelancer_id), tel = String(f.telefone || '').replace(/\D/g, '');
    if (tel.length < 10) return '';
    const txt = `Olá, ${f.nome.split(' ')[0]}! Diária na Gran Sabor · ${nomeUnidade(unidade(x))}\n`
      + `Dia ${dataBR(x.data + 'T12:00')} (${ESC.SEMANA[ESC.dow(x.data)].toLowerCase()}), das ${ESC.hm(x.entrada)} às ${ESC.hm(x.saida)}`
      + `${x.funcao ? ' · ' + x.funcao : ''}\nValor: ${reais(x.valor)}\nPode confirmar?`;
    return `https://wa.me/${tel.length <= 11 ? '55' + tel : tel}?text=${encodeURIComponent(txt)}`;
  }

  /* ---------- Recibo das diárias (para o freelancer assinar) ---------- */
  function recibo(id, de, ate) {
    const f = ESC.freelancer(id), ds = doFreela(id).filter(x => x.situacao === 'trabalhou' && x.data >= (de || '0000') && x.data <= (ate || '9999')).sort((a, b) => a.data.localeCompare(b.data));
    if (!ds.length) return 'Nenhuma diária trabalhada deste freelancer no período.';
    const total = ds.reduce((a, x) => a + Number(x.valor || 0), 0), emps = [...new Set(ds.map(empresa))];
    const w = window.open('', '_blank'); if (!w) return 'O navegador bloqueou a janela do recibo: permita janelas (pop-up) para este site.';
    const linha = x => `<tr><td>${dataBR(x.data + 'T12:00')}</td><td>${esc(nomeUnidade(unidade(x)))}</td><td>${esc(x.funcao || f.funcao || '')}</td><td>${ESC.hm(x.entrada_real || x.entrada)}–${ESC.hm(x.saida_real || x.saida)}</td><td style="text-align:right">${reais(x.valor)}</td></tr>`;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo · ${esc(f.nome)}</title>
      <style>body{font:13px/1.5 Inter,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#222}h1{font-size:18px;margin:0 0 4px}
      table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border-bottom:1px solid #ccc;padding:4px 6px;text-align:left}.ass{margin-top:56px;border-top:1px solid #222;width:320px;padding-top:4px}
      @media print{button{display:none}}</style></head><body>
      <h1>Recibo de pagamento de diárias</h1><div>${emps.map(e => esc(nomeEmpresa(e))).join(' · ')}</div>
      <p>Eu, <b>${esc(f.nome)}</b>${f.cpf ? `, CPF ${esc(fmtDoc(f.cpf))}` : ''}, recebi ${reais(total)} pelas diárias abaixo, prestadas como autônomo, sem vínculo de emprego.</p>
      <table><thead><tr><th>Dia</th><th>Unidade</th><th>Função</th><th>Horário</th><th style="text-align:right">Valor</th></tr></thead><tbody>${ds.map(linha).join('')}</tbody>
      <tfoot><tr><th colspan="4">Total (${ds.length} diária${ds.length > 1 ? 's' : ''})</th><th style="text-align:right">${reais(total)}</th></tr></tfoot></table>
      ${f.pix ? `<div>Pagamento por Pix: ${esc(f.pix)}</div>` : ''}<p>Data: ____/____/________</p><div class="ass">${esc(f.nome)}</div>
      <p><button onclick="print()">Imprimir</button></p></body></html>`);
    w.document.close(); return '';
  }

  return { REGRA, habitualidade, etqHabitual, avisoHabitual, pendencias, situacao, podeChamar, avaliacao, estrelas,
    custo, soma, contaDe, gerarPagamentos, linkConvite, recibo, doFreela };
})();
