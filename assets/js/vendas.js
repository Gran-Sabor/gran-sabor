/* =====================================================================
   Gran Sabor · vendas.js — A CONTA DAS VENDAS, NUM LUGAR SÓ
   PDV, Abertura e fechamento de caixa, Vendas do dia e Início usam estas
   mesmas funções: total da venda, NFC-e, saldo esperado do caixa,
   baixa de estoque e indicadores. Nenhuma tela faz a sua própria conta.
   Regras fiscais e taxas são de EXEMPLO: o contador da Gran Sabor confirma.
   ===================================================================== */
const VENDA = (() => {
  const r2 = v => Math.round(v * 100) / 100;
  const agoraLocal = () => `${hojeISO()}T${new Date().toTimeString().slice(0, 5)}`;   // data e hora de quem usa

  // Formas de recebimento. tecla = atalho na janela de pagamento.
  // prazo = dias até o dinheiro cair; taxa = % da operadora (exemplo).
  const FORMAS = [
    { id: 'din', nome: 'Dinheiro',          tecla: '1', prazo: 0,  taxa: 0 },
    { id: 'pix', nome: 'Pix',               tecla: '2', prazo: 0,  taxa: 0 },
    { id: 'deb', nome: 'Cartão de débito',  tecla: '3', prazo: 1,  taxa: 1.2 },
    { id: 'cre', nome: 'Cartão de crédito', tecla: '4', prazo: 30, taxa: 2.9 },
    { id: 'vr',  nome: 'Vale-refeição',     tecla: '5', prazo: 30, taxa: 5.5 },
    { id: 'pj',  nome: 'Convênio (faturar)', tecla: '6', prazo: 0, taxa: 0 }
  ];
  const forma = id => FORMAS.find(f => f.id === id) || { id, nome: id, prazo: 0, taxa: 0 };

  // NFC-e (exemplo; cada UF pode reduzir os prazos)
  const REGRA_NFCE = {
    cancelarMinutos: 30,     // cancelamento só dentro deste prazo depois da autorização
    contingenciaHoras: 24    // nota emitida sem internet precisa ser transmitida neste prazo
  };

  const totalItens = v => r2(v.itens.reduce((a, i) => a + i.qtd * i.preco, 0));
  const total = v => r2(totalItens(v) - (v.desconto || 0));
  const pago = v => r2((v.pagamentos || []).reduce((a, p) => a + p.valor, 0));
  const valida = v => !v.canceladaEm;
  const quando = v => new Date(`${v.data}T${v.hora}`);

  // Numeração por empresa e série (série = número do PDV)
  function proximoNumero(empresa, serie) {
    return VENDAS.filter(v => v.empresa === empresa && v.nota && v.nota.serie === serie).reduce((m, v) => Math.max(m, v.nota.numero), 0) + 1;
  }
  // Chave de 44 dígitos com o formato da NFC-e (UF, AAMM, CNPJ, modelo 65, série, número, tipo de emissão, código, DV). Fictícia.
  function chave(v, numero, tpEmis) {
    const emp = EMPRESAS.find(e => e.id === v.empresa) || { cnpj: '0'.repeat(14) };
    const base = '35' + v.data.slice(2, 4) + v.data.slice(5, 7) + emp.cnpj + '65' + String(v.pdv).padStart(3, '0') + String(numero).padStart(9, '0') + tpEmis + String(numero * 7919 % 1e8).padStart(8, '0');
    let soma = 0, peso = 2; for (let i = base.length - 1; i >= 0; i--) { soma += +base[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
    const dv = 11 - (soma % 11); return base + (dv >= 10 ? 0 : dv);
  }
  // Emite a NFC-e da venda. online=false → contingência (tpEmis 9), transmitir depois.
  function emitirNota(v, online) {
    const numero = proximoNumero(v.empresa, v.pdv);
    v.nota = { modelo: 65, serie: v.pdv, numero, chave: chave(v, numero, online ? 1 : 9), status: online ? 'autorizada' : 'contingencia',
      protocolo: online ? protocolo(numero) : '', emitidaEm: `${v.data}T${v.hora}`, transmitidaEm: online ? `${v.data}T${v.hora}` : null };
    return v.nota;
  }
  const protocolo = n => '135' + String(Date.now()).slice(-8) + String(n).padStart(4, '0');
  function transmitir(v) {
    if (!v.nota || v.nota.status !== 'contingencia') return false;
    v.nota.status = 'autorizada'; v.nota.protocolo = protocolo(v.nota.numero); v.nota.transmitidaEm = agoraLocal(); return true;
  }
  const pendentes = (filtroFn = () => true) => VENDAS.filter(v => valida(v) && v.nota && v.nota.status === 'contingencia' && filtroFn(v));
  // Minutos que ainda restam para cancelar (0 = não pode mais)
  function minutosParaCancelar(v, agora = new Date()) {
    if (!valida(v)) return 0;
    const ref = v.nota && v.nota.transmitidaEm ? new Date(v.nota.transmitidaEm) : quando(v);
    return Math.max(0, Math.ceil(REGRA_NFCE.cancelarMinutos - (agora - ref) / 60000));
  }
  function horasContingencia(v, agora = new Date()) { return REGRA_NFCE.contingenciaHoras - (agora - quando(v)) / 3600000; }

  // Baixa (sinal 1) ou devolução (sinal −1) do estoque da loja: só o que sai pronto da prateleira
  // (bebidas, embalagens). O buffet consome insumos na produção, pela ficha técnica.
  function mexerEstoque(v, sinal) {
    const mexidos = [];
    v.itens.forEach(i => { const p = PRODUTOS_VENDA.find(x => x.id === i.prod); if (!p) return;
      p.comp.filter(c => c.tipo === 'insumo').forEach(c => {
        let e = ESTOQUE.find(x => x.insumo === c.ref && x.local === v.unidade);
        if (!e) { e = { insumo: c.ref, local: v.unidade, saldo: 0, min: 0, consumo: 0 }; ESTOQUE.push(e); }
        e.saldo = r2(e.saldo - sinal * c.qtd * i.qtd); mexidos.push(c.ref); }); });
    return mexidos;
  }

  // Resumo do caixa: por forma, e o dinheiro que deve estar na gaveta
  function resumoCaixa(cx) {
    const vs = VENDAS.filter(v => v.caixa === cx.id && valida(v));
    const porForma = Object.fromEntries(FORMAS.map(f => [f.id, 0]));
    vs.forEach(v => v.pagamentos.forEach(p => { porForma[p.forma] = r2((porForma[p.forma] || 0) + p.valor); }));
    porForma.din = r2(porForma.din - vs.reduce((a, v) => a + (v.troco || 0), 0));
    const mov = t => r2((cx.movimentos || []).filter(m => m.tipo === t).reduce((a, m) => a + m.valor, 0));
    const sangrias = mov('sangria'), suprimentos = mov('suprimento');
    return { vendas: vs.length, canceladas: VENDAS.filter(v => v.caixa === cx.id && !valida(v)).length, total: r2(vs.reduce((a, v) => a + total(v), 0)),
      porForma, sangrias, suprimentos, dinheiroGaveta: r2(cx.fundo + porForma.din + suprimentos - sangrias),
      pendentes: vs.filter(v => v.nota && v.nota.status === 'contingencia').length };
  }
  const caixaAberto = (un, pdv) => CAIXAS.find(c => c.unidade === un && c.pdv === pdv && !c.fechadoEm);

  // Indicadores das vendas de um dia (Início e Vendas do dia)
  function indicadores(vs) {
    vs = vs.filter(valida);
    const fat = r2(vs.reduce((a, v) => a + total(v), 0));
    let kg = 0, fatKg = 0, custo = 0, bebidas = 0;
    vs.forEach(v => v.itens.forEach(i => { const p = PRODUTOS_VENDA.find(x => x.id === i.prod);
      if (i.un === 'kg') { kg += i.qtd; fatKg += i.qtd * i.preco; }
      if (p && p.grupo === 'Bebidas') bebidas += i.qtd * i.preco;
      if (p) custo += custoProduto(p) * i.qtd; }));
    return { fat, cupons: vs.length, ticket: vs.length ? fat / vs.length : 0, kg: r2(kg), precoKg: kg ? fatKg / kg : 0, bebidas: r2(bebidas),
      custo: r2(custo), cmv: fat ? custo / fat * 100 : 0, cmvKg: kg ? custoKg(vs) : 0 };
  }
  // Custo médio do kg servido (só itens por kg)
  function custoKg(vs) {
    let kg = 0, c = 0; vs.forEach(v => v.itens.forEach(i => { if (i.un !== 'kg') return; const p = PRODUTOS_VENDA.find(x => x.id === i.prod); kg += i.qtd; if (p) c += custoProduto(p) * i.qtd; }));
    return kg ? c / kg : 0;
  }

  // Cupom (DANFE da NFC-e) para tela e impressão
  function cupomHTML(v) {
  const e = EMPRESAS.find(x => x.id === v.empresa), c = v.pj && CLIENTES_PJ.find(x => x.id === v.pj), n = v.nota;
  return `<div class="cupom"><div class="c"><b>${esc(e.razao)}</b><br>CNPJ ${fmtDoc(e.cnpj)} · ${esc(nomeUnidade(v.unidade))}<br>Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div><hr>
    ${n.status === 'contingencia' ? '<div class="aviso-cont">EMITIDA EM CONTINGÊNCIA<br>Pendente de autorização</div>' : ''}${!valida(v) ? '<div class="aviso-cont">NFC-e CANCELADA</div>' : ''}
    ${v.itens.map((i, k) => `<div>${String(k + 1).padStart(3, '0')} ${esc(i.nome)}</div><div class="l"><span>${i.un === 'kg' ? numero(i.qtd, 3) + ' kg' : numero(i.qtd) + ' un'} × ${numero(i.preco, 2)}</span><span>${numero(i.qtd * i.preco, 2)}</span></div>`).join('')}<hr>
    <div class="l"><span>Qtd. total de itens</span><span>${v.itens.length}</span></div>${v.desconto ? `<div class="l"><span>Desconto</span><span>-${numero(v.desconto, 2)}</span></div>` : ''}
    <div class="l"><b>VALOR A PAGAR R$</b><b>${numero(total(v), 2)}</b></div>
    ${v.pagamentos.map(p => `<div class="l"><span>${forma(p.forma).nome}</span><span>${numero(p.valor, 2)}</span></div>`).join('')}${v.troco ? `<div class="l"><span>Troco</span><span>${numero(v.troco, 2)}</span></div>` : ''}<hr>
    <div class="c">${c ? `CONSUMIDOR CNPJ ${fmtDoc(c.cnpj)}<br>${esc(c.nome)}` : v.cpf ? 'CONSUMIDOR CPF informado' : 'CONSUMIDOR NÃO IDENTIFICADO'}</div><hr>
    <div class="c">NFC-e nº ${String(n.numero).padStart(6, '0')} Série ${String(n.serie).padStart(3, '0')} ${dataBR(v.data + 'T12:00')} ${v.hora}<br>Consulte pela chave de acesso no portal da SEFAZ<br>
    ${n.chave.replace(/(\d{4})/g, '$1 ').trim()}<br>${n.protocolo ? `Protocolo ${n.protocolo}` : 'Sem protocolo (contingência)'}</div><div class="qr">QR Code</div>
    <div class="c">Operador: ${esc(v.operador)} · PDV ${v.pdv}</div></div>`;
}

  // Cancela a venda e desfaz a cadeia (estoque, convênio, caixa). Devolve a mensagem de erro, ou '' se cancelou.
  function cancelar(v, motivo) {
    motivo = String(motivo || '').trim();
    if (motivo.length < 15) return 'A justificativa precisa ter pelo menos 15 letras.';
    if (!valida(v)) return 'Esta venda já foi cancelada em outra tela.';
    if (v.nota.status !== 'autorizada') return 'Transmita a nota antes de cancelar.';
    if (!minutosParaCancelar(v)) return `Passou o prazo de ${REGRA_NFCE.cancelarMinutos} min para cancelar. Fale com o contador.`;
    const cx = CAIXAS.find(c => c.id === v.caixa); if (cx && cx.fechadoEm) return 'O caixa desta venda já foi fechado.';
    v.canceladaEm = agoraLocal(); v.motivoCancel = motivo; v.nota.status = 'cancelada';
    mexerEstoque(v, -1);
    const k = CONSUMOS_PJ.findIndex(x => x.venda === v.id); if (k >= 0) CONSUMOS_PJ.splice(k, 1);
    COMANDAS.filter(c => c.venda === v.id).forEach(c => { c.status = 'cancelada'; });
    avisarMudanca('vendas', 'estoque', 'caixas', 'consumos_pj', 'comandas');
    return '';
  }


  /* ---------- Cartões: bandeiras, taxa do contrato e conciliação ----------
     A taxa e o prazo de cada bandeira vêm de TAXAS_CONTRATO (tela Conciliação de cartões).
     A previsão do caixa e a conferência do extrato usam esta MESMA função. */
  const BANDEIRAS = { deb: ['Visa', 'Mastercard', 'Elo'], cre: ['Visa', 'Mastercard', 'Elo', 'Amex'], vr: ['Alelo', 'Pluxee', 'Ticket', 'VR'] };
  const eCartao = f => !!BANDEIRAS[f];
  function contrato(formaId, bandeira) {
    const c = TAXAS_CONTRATO.find(t => t.forma === formaId && t.bandeira === bandeira) || TAXAS_CONTRATO.find(t => t.forma === formaId && t.bandeira === '*');
    return c || { forma: formaId, bandeira, taxa: forma(formaId).taxa, prazo: forma(formaId).prazo, operadora: '—' };
  }
  const somaDiasISO = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoLocal(d); };
  // Cada pagamento em cartão de uma lista de vendas, com o que o contrato diz que deve cair
  function transacoesCartao(vs) {
    const r = [];
    vs.filter(valida).forEach(v => v.pagamentos.forEach((p, k) => { if (!eCartao(p.forma)) return;
      const c = contrato(p.forma, p.bandeira);
      r.push({ chave: v.id + '#' + k, venda: v.id, caixa: v.caixa, unidade: v.unidade, empresa: v.empresa, data: v.data, hora: v.hora, forma: p.forma, bandeira: p.bandeira || '—', nsu: p.nsu || '', aut: p.aut || '',
        bruto: p.valor, taxaPct: c.taxa, taxa: r2(p.valor * c.taxa / 100), liquido: r2(p.valor * (1 - c.taxa / 100)), previsao: somaDiasISO(v.data, c.prazo), comandas: v.comandas || [] }); }));
    return r;
  }
  // Agrupa as transações do caixa por forma + bandeira (vira um título no contas a receber)
  function recebiveisCaixa(cx) {
    const g = {};
    transacoesCartao(VENDAS.filter(v => v.caixa === cx.id)).forEach(t => { const k = t.forma + '|' + t.bandeira;
      const x = g[k] ||= { forma: t.forma, bandeira: t.bandeira, bruto: 0, taxa: 0, liquido: 0, previsao: t.previsao, qtd: 0 };
      x.bruto = r2(x.bruto + t.bruto); x.taxa = r2(x.taxa + t.taxa); x.liquido = r2(x.liquido + t.liquido); x.qtd++; });
    return Object.values(g);
  }
  // Confere o extrato da operadora com as vendas: por NSU; sem NSU, por data + bandeira + valor
  function conciliar(vs, extrato) {
    const trans = transacoesCartao(vs), usadas = new Set(), linhas = [];
    const tol = 0.01;
    extrato.forEach(e => {
      let t = e.nsu && trans.find(x => !usadas.has(x.chave) && x.nsu && x.nsu === e.nsu);
      if (!t) t = trans.find(x => !usadas.has(x.chave) && x.data === e.data && x.bandeira === e.bandeira && Math.abs(x.bruto - e.bruto) < tol);
      if (!t) { linhas.push({ e, t: null, status: 'so_extrato' }); return; }
      usadas.add(t.chave);
      const taxaCobradaPct = e.bruto ? r2(e.taxa / e.bruto * 100) : 0, difTaxa = r2(e.taxa - e.bruto * t.taxaPct / 100);
      // 1 centavo de tolerância (arredondamento da operadora)
      const status = Math.abs(t.bruto - e.bruto) >= tol ? 'valor' : difTaxa > 0.015 ? 'taxa' : e.previsao > t.previsao ? 'prazo' : 'ok';
      linhas.push({ e, t, status, taxaCobradaPct, difTaxa: status === 'taxa' || status === 'valor' ? difTaxa : 0 });
    });
    trans.filter(t => !usadas.has(t.chave)).forEach(t => linhas.push({ e: null, t, status: 'so_venda' }));
    return linhas;
  }

  return { BANDEIRAS, eCartao, contrato, transacoesCartao, recebiveisCaixa, conciliar, FORMAS, cupomHTML, cancelar, forma, REGRA_NFCE, total, totalItens, pago, valida, emitirNota, transmitir, pendentes, minutosParaCancelar, horasContingencia,
    mexerEstoque, resumoCaixa, caixaAberto, indicadores, r2 };
})();
