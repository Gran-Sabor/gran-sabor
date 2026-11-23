/* =====================================================================
   Gran Sabor · plano-dre.js — plano de categorias pela DRE
   Estrutura: linha da DRE > grupo (número) > categoria (código 0.00).
   Os números dos grupos são os mesmos da importação do fluxo de caixa
   (financeiro.js: 3 = CMV, 4 = Folha...), para as duas cargas casarem.
   Alocação: categoria "do escritório" é rateada entre as lojas no resultado
   (regra do rateio ainda em aberto: partes iguais ou proporcional ao faturamento).
   Aqui mora só a ESTRUTURA (nomes genéricos), nunca valores nem nomes de
   pessoas: a planilha de DRE entra pela tela (botão "Importar DRE") e
   nada dela vai para o repositório.
   ===================================================================== */
const PLANO_DRE = (() => {
  // Linhas do resultado, na ordem da DRE da Gran Sabor
  const LINHAS = ['Vendas brutas', 'Impostos', 'Custos · Mercadoria', 'Custos · Pessoal', 'Despesas', 'Resultado financeiro', 'Passivo anterior', 'Investimentos'];
  // Nomes antigos (antes da DRE) → linha nova; a migração 20261123160000 já converteu o banco
  const LINHA_ANTIGA = { 'Receita bruta': 'Vendas brutas', 'Impostos sobre vendas': 'Impostos', 'Deduções': 'Despesas', 'CMV': 'Custos · Mercadoria',
    'Pessoal': 'Custos · Pessoal', 'Ocupação': 'Despesas', 'Administrativas': 'Despesas', 'Financeiras': 'Resultado financeiro' };

  const GRUPOS = {
    1: { grupo: 'Receitas', dre: 'Vendas brutas', tipo: 'receita' },
    2: { grupo: 'Impostos', dre: 'Impostos' },
    3: { grupo: 'CMV', dre: 'Custos · Mercadoria' },
    4: { grupo: 'Folha de pagamento', dre: 'Custos · Pessoal' },
    5: { grupo: 'Despesas administrativas', dre: 'Despesas' },
    6: { grupo: 'Manutenção', dre: 'Despesas' },
    7: { grupo: 'Veículos', dre: 'Despesas' },
    8: { grupo: 'Marketing', dre: 'Despesas' },
    9: { grupo: 'Bancário', dre: 'Despesas' },
    10: { grupo: 'Dívidas anteriores', dre: 'Passivo anterior' },
    11: { grupo: 'Investimentos', dre: 'Investimentos' }
  };

  // [código, nome, marcas (f = fixa, e = do escritório: rateada entre as lojas), linha da DRE se diferente da do grupo, nomes como aparecem na planilha]
  const CATS = [
    ['1.01', 'Vendas nas lojas (recebido)', '', '', ['vendas brutas']],
    ['1.02', 'Convênios PJ', '', '', []],
    ['2.01', 'Simples Nacional (DAS)', '', '', ['simples nacional - das', 'simples nacional', 'das']],
    ['2.02', 'ISS', '', '', ['iss']],
    ['2.03', 'ICMS (GARE-SP)', '', '', ['gare-sp', 'gare']],
    ['2.04', 'Tributos federais (DARF)', '', '', ['darf']],
    ['3.01', 'Compras de mercadorias', '', '', ['compras de mercadorias']],
    ['4.01', 'Salários', 'f', '', ['folha de pagamento']],
    ['4.02', 'Vale (adiantamento 40%)', 'f', '', ['vale 40%', 'vale']],
    ['4.03', 'Vale-transporte', 'f', '', ['vale transporte']],
    ['4.04', 'FGTS', 'f', '', ['fgts']],
    ['4.05', 'INSS', 'f', '', ['inss']],
    ['4.06', 'Refeição', 'f', '', ['refeicao']],
    ['4.07', 'Férias', 'f', '', ['ferias']],
    ['4.08', '13º salário', 'f', '', ['decimo terceiro', '13o salario', '13 salario']],
    ['4.09', 'Freelancers', '', '', ['free lance', 'freelance', 'freelancer']],
    ['4.10', 'Rescisões (parcelas)', '', '', ['rescisao parcelados', 'rescisao', 'rescisoes']],
    ['4.11', 'Plus (prêmio)', '', '', ['plus']],
    ['4.12', 'Sindicato', 'f', '', ['sindicatos', 'sindicato', 'sindicato acordo']],
    ['4.13', 'Advogada trabalhista', '', '', ['advogada', 'advogado']],
    ['4.14', 'Seguro de vida', 'f', '', ['seguro de vida']],
    ['4.15', 'Uniformes', '', '', ['uniformes']],
    ['4.16', 'Aniversários', '', '', ['aniversario']],
    ['5.01', 'Aluguel', 'f', '', ['aluguel']],
    ['5.02', 'Contabilidade', 'fe', '', ['contabilidade']],
    ['5.03', 'Sistema de caixa', 'f', '', ['sistema de caixa']],
    ['5.04', 'Telefone e internet', 'f', '', ['telefone / internet']],
    ['5.05', 'Água', 'f', '', ['agua']],
    ['5.06', 'Energia elétrica', 'f', '', ['luz']],
    ['5.07', 'Gás', '', '', ['gas']],
    ['5.08', 'Material de escritório', 'e', '', ['material escritorio']],
    ['5.09', 'Eventos internos', '', '', ['eventos internos']],
    ['5.10', 'Dedetização', 'f', '', ['detetizacao', 'dedetizacao']],
    ['5.11', 'Cartórios', '', '', ['cartorios']],
    ['5.12', 'Confraternização', '', '', ['confraternizacao']],
    ['5.13', 'Pró-labore', 'fe', '', ['prolabore', 'pro-labore']],
    ['5.14', 'Aluguel do escritório', 'fe', '', ['aluguel escritorio']],
    ['5.15', 'Energia elétrica do escritório', 'fe', '', ['luz escritorio']],
    ['5.16', 'Telefone e internet do escritório', 'fe', '', ['telefone / internet escritorio']],
    ['6.01', 'Elétrica', '', '', ['eletrica manutencao + mao de obra']],
    ['6.02', 'Hidráulica', '', '', ['hidraulica manutencao + mao de obra']],
    ['6.03', 'Computadores', '', '', ['computadores materias + mao de obra']],
    ['6.04', 'Freezers e refrigeração', '', '', ['freezer materiais + mao de obra']],
    ['6.05', 'Fogões', '', '', ['fogoes materiais + mao de obra']],
    ['6.06', 'Máquina de lavar louça', '', '', ['maquina de lavar louca', 'maquina de lava louca']],
    ['6.07', 'Pedreiro', '', '', ['pedreiro manutencao + mao de obra']],
    ['6.08', 'Serralheria', '', '', ['serralheiro']],
    ['6.09', 'Pintura', '', '', ['pintura material + mao de obra']],
    ['6.10', 'Estacionamento (roçada)', '', '', ['manutencao estacionamento ( rocar)', 'manutencao estacionamento']],
    ['6.11', 'Entulho', '', '', ['entulho']],
    ['6.12', 'Manutenção diversa', '', '', ['diversos']],
    ['7.01', 'Combustível', '', '', ['gasolina']],
    ['7.02', 'Manutenção de veículos', '', '', ['kangoo materias + mao de obra']],
    ['8.01', 'Anúncios on-line', '', '', ['anuncios on line']],
    ['8.02', 'Anúncios (rádio, jornal, outros)', '', '', ['anuncios']],
    ['8.03', 'Material gráfico', '', '', ['material grafico - cartazes / panfletos / banners', 'grafica luiz / canetas']],
    ['8.04', 'Brindes para clientes', '', '', ['brindes para clientes']],
    ['8.05', 'Outros de marketing', '', '', ['outros']],
    ['9.01', 'Aluguel de maquininha', 'f', '', ['aluguel maquina cartao de credito']],
    ['9.02', 'Taxa de cartão débito', '', '', ['tx cartao debito']],
    ['9.03', 'Taxa de cartão crédito', '', '', ['tx cartao credito']],
    ['9.04', 'Tarifas de DOC, TED e Pix', '', '', ['taxas de docs e ted']],
    ['9.05', 'Juros bancários', '', 'Resultado financeiro', ['juros bancarios']],
    ['9.06', 'Pacote de serviços bancários', 'f', 'Resultado financeiro', ['pacotes de servicos bancarios']],
    ['9.07', 'Juros de antecipação de cartão', '', 'Resultado financeiro', ['juros antecipacoes de cartoes de credito']],
    ['9.08', 'Outras tarifas bancárias', '', 'Resultado financeiro', ['outras taxas (bancarias)']],
    ['10.01', 'Empréstimos bancários anteriores', 'f', '', []],
    ['10.02', 'Empréstimos de pessoas', 'f', '', []],
    ['10.03', 'Acordos e parcelamentos', 'f', '', []],
    ['11.01', 'Equipamentos', '', '', []],
    ['11.02', 'Obras e reformas', '', '', []],
    ['11.03', 'Móveis e utensílios', '', '', []],
    ['11.04', 'Veículos (compra)', '', '', []]
  ].map(([codigo, nome, m, dre, nomes]) => { const g = GRUPOS[codigo.split('.')[0]];
    return { codigo, nome, grupo: g.grupo, tipo: g.tipo || 'despesa', dre: dre || g.dre, natureza: m.includes('f') ? 'fixa' : 'variavel',
      alocacao: m.includes('e') ? 'escritorio' : 'unidade', nomes }; });

  // Títulos de bloco da planilha → grupo de quem vem abaixo (linha que não está no plano entra nesse grupo)
  const BLOCOS = [[/^impostos$/, 2], [/^custo de mp/, 3], [/^folha de pagamento func/, 4], [/^despesas marketing/, 8],
    [/^despesas administrativas/, 5], [/^ston[ei]$/, 9], [/^manutencao$/, 6], [/^resultado financeiro/, 9],
    [/^passivo anterior/, 10], [/^investimentos$/, 11]];
  // Linhas de soma ou título que o sistema calcula: não viram categoria
  const SOMAS = /^(dre\b|contas$|receita liquida|custos totais|lucro bruto|despesas$|lucro liquido|geracao de caixa|\W*$)/;

  const chave = s => normalizar(s).replace(/\s+/g, ' ').trim();
  const porNome = new Map(); CATS.forEach(c => c.nomes.forEach(n => porNome.set(chave(n), c)));
  const capital = s => { s = String(s).replace(/\s+/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

  // Lê a coluna A das abas escolhidas. Devolve: do plano (achadas), novas (linhas fora do plano) e credores
  // (linhas do passivo anterior, que vão para as categorias genéricas: nome de pessoa não vira categoria).
  function lerColunaA(XLSX, wb, abas) {
    const achadas = new Set(), novas = new Map(); let credores = 0, lidas = 0;
    abas.forEach(nome => {
      const ws = wb.Sheets[nome]; if (!ws) return;
      const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      let bloco = null;
      for (let r = 0; r <= ref.e.r; r++) {
        const txt = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v; if (txt == null || typeof txt !== 'string') continue;
        const k = chave(txt); if (!k || SOMAS.test(k)) continue;
        const b = BLOCOS.find(([re]) => re.test(k)); if (b) { bloco = b[1]; continue; }
        lidas++;
        const c = porNome.get(k);
        if (c) { achadas.add(c.codigo); continue; }     // já está no plano (com o nome e o grupo do plano)
        if (bloco === 10) { credores++; continue; }
        if (!bloco) continue;                           // linha solta antes do primeiro bloco
        const g = GRUPOS[bloco], dre = bloco === 9 && k.includes('jur') ? 'Resultado financeiro' : g.dre;
        if (![...novas.values()].some(n => chave(n.nome) === k)) novas.set(k, { nome: capital(txt).slice(0, 80), grupo: g.grupo, n: bloco, tipo: 'despesa', dre, natureza: 'variavel', alocacao: /escritorio/.test(k) ? 'escritorio' : 'unidade', aba: nome });
      }
    });
    return { achadas, novas: [...novas.values()], credores, lidas };
  }

  return { LINHAS, LINHA_ANTIGA, GRUPOS, CATS, lerColunaA, chave };
})();
