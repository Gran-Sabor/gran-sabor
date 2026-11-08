/* =====================================================================
   Gran Sabor · exemplo.js — DADOS FICTÍCIOS compartilhados pelas telas
   Servem para aprovar telas e regras antes dos dados reais. Nomes, CNPJs,
   pessoas e valores são inventados. Quando os dados reais chegarem, cada
   tela passa a ler do banco e este arquivo deixa de ser usado.
   Os dados ficam num lugar só (dadoComum): todas as abas abertas veem o mesmo
   valor, e quem altera avisa as outras (avisarMudanca).
   ===================================================================== */

// 3 empresas (CNPJs) — fictícias. A distribuição das unidades é suposição.
const EMPRESAS = [
  { id: 'emp1', nome: 'Empresa 1', razao: 'Empresa Exemplo Um Ltda',   cnpj: '11222333000181', cor: '#b4532a' },
  { id: 'emp2', nome: 'Empresa 2', razao: 'Empresa Exemplo Dois Ltda', cnpj: '44555666000110', cor: '#2c5f8a' },
  { id: 'emp3', nome: 'Empresa 3', razao: 'Empresa Exemplo Três Ltda', cnpj: '77888999000150', cor: '#2f7d4f' }
];
// Unidade → empresa (exemplo)
const UNIDADE_EMPRESA = { loja1: 'emp1', central: 'emp1', escritorio: 'emp1', loja2: 'emp2', loja3: 'emp3' };
const empresaDe = un => EMPRESAS.find(e => e.id === UNIDADE_EMPRESA[un]);
const nomeUnidade = un => (UNIDADES.find(u => u.id === un) || {}).nome || un || '—';
const nomeEmpresa = id => (EMPRESAS.find(e => e.id === id) || {}).nome || 'Todas';

/* ---------- Categorias financeiras (plano de contas gerencial) ---------- */
// dre: linha do resultado gerencial onde a categoria soma
const CATEGORIAS = dadoComum('CATEGORIAS', () => [
  ['1.01', 'Vendas balcão (por kg)',         'receita', 'Receita bruta', 'variavel'],
  ['1.02', 'Vendas delivery',                'receita', 'Receita bruta', 'variavel'],
  ['1.03', 'Convênios empresas (PJ)',        'receita', 'Receita bruta', 'variavel'],
  ['1.04', 'Bebidas e sobremesas',           'receita', 'Receita bruta', 'variavel'],
  ['1.05', 'Vendas entre empresas do grupo',  'receita', 'Receita bruta', 'variavel'],
  ['2.01', 'Simples Nacional (DAS)',         'despesa', 'Impostos sobre vendas', 'variavel'],
  ['2.02', 'Taxas de cartão e apps',         'despesa', 'Deduções', 'variavel'],
  ['3.01', 'Carnes',                         'despesa', 'CMV', 'variavel'],
  ['3.02', 'Hortifrúti',                     'despesa', 'CMV', 'variavel'],
  ['3.03', 'Mercearia',                      'despesa', 'CMV', 'variavel'],
  ['3.04', 'Bebidas para revenda',           'despesa', 'CMV', 'variavel'],
  ['3.05', 'Embalagens e descartáveis',      'despesa', 'CMV', 'variavel'],
  ['3.06', 'Gás de cozinha',                 'despesa', 'CMV', 'variavel'],
  ['3.07', 'Compras entre empresas do grupo', 'despesa', 'CMV', 'variavel'],
  ['4.01', 'Salários',                       'despesa', 'Pessoal', 'fixa'],
  ['4.02', 'Encargos (INSS, FGTS)',          'despesa', 'Pessoal', 'fixa'],
  ['4.03', 'Vale-transporte e refeição',     'despesa', 'Pessoal', 'fixa'],
  ['4.04', '13º e férias (provisão)',        'despesa', 'Pessoal', 'fixa'],
  ['4.05', 'Horas extras',                   'despesa', 'Pessoal', 'variavel'],
  ['5.01', 'Aluguel e condomínio',           'despesa', 'Ocupação', 'fixa'],
  ['5.02', 'Energia elétrica',               'despesa', 'Ocupação', 'fixa'],
  ['5.03', 'Água e esgoto',                  'despesa', 'Ocupação', 'fixa'],
  ['5.04', 'Manutenção e reparos',           'despesa', 'Ocupação', 'variavel'],
  ['6.01', 'Contabilidade',                  'despesa', 'Administrativas', 'fixa'],
  ['6.02', 'Sistemas e internet',            'despesa', 'Administrativas', 'fixa'],
  ['6.03', 'Marketing e divulgação',         'despesa', 'Administrativas', 'variavel'],
  ['7.01', 'Juros e tarifas bancárias',      'despesa', 'Financeiras', 'variavel'],
  ['7.02', 'Rendimentos de aplicação',       'receita', 'Financeiras', 'variavel']
].map(([codigo, nome, tipo, dre, natureza]) => ({ id: codigo, codigo, nome, tipo, dre, natureza, ativo: true })));

/* ---------- Centros de custo (unidade + setor) ---------- */
const CENTROS = dadoComum('CENTROS', () => [
  ['loja1', 'cozinha', 'Cozinha'], ['loja1', 'salao', 'Salão e caixa'], ['loja1', 'delivery', 'Delivery'],
  ['loja2', 'cozinha', 'Cozinha'], ['loja2', 'salao', 'Salão e caixa'], ['loja2', 'delivery', 'Delivery'],
  ['loja3', 'cozinha', 'Cozinha'], ['loja3', 'salao', 'Salão e caixa'], ['loja3', 'delivery', 'Delivery'],
  ['central', 'acougue', 'Açougue e cortes'], ['central', 'estoque', 'Armazenagem'], ['central', 'logistica', 'Entrega às lojas'],
  ['escritorio', 'adm', 'Administrativo'], ['escritorio', 'financeiro', 'Financeiro e RH']
].map(([unidade, setor, nome], i) => ({ id: unidade + '.' + setor, codigo: `${String(i + 1).padStart(2, '0')}`, unidade, empresa: UNIDADE_EMPRESA[unidade], setor, nome, ativo: true })));

/* ---------- Fornecedores ---------- */
const FORNECEDORES = dadoComum('FORNECEDORES', () => [
  ['f1', 'Frigorífico Exemplo Sul',     '12345678000195', 'Carnes',     'SP', 'boleto 14 dias', ['emp1']],
  ['f2', 'Distribuidora Verde Fresco',  '23456789000107', 'Hortifrúti', 'SP', 'pix na entrega', ['emp1', 'emp2', 'emp3']],
  ['f3', 'Atacado Mercearia Central',   '34567890000110', 'Mercearia',  'SP', 'boleto 28 dias', ['emp1', 'emp2', 'emp3']],
  ['f4', 'Bebidas Exemplo Ltda',        '45678901000128', 'Bebidas',    'SP', 'boleto 21 dias', ['emp1', 'emp2', 'emp3']],
  ['f5', 'Embalagens Modelo',           '56789012000130', 'Embalagens', 'SP', 'boleto 30 dias', ['emp2', 'emp3']],
  ['f6', 'Gás Exemplo Distribuidora',   '67890123000142', 'Gás',        'SP', 'pix na entrega', ['emp1', 'emp2', 'emp3']],
  ['f7', 'Escritório Contábil Modelo',  '78901234000155', 'Serviços',   'SP', 'boleto dia 10',  ['emp1', 'emp2', 'emp3']]
].map(([id, nome, cnpj, categoria, uf, prazo, empresas]) => ({ id, nome, cnpj, categoria, uf, prazo, empresas, contato: '', ativo: true })));

/* ---------- Insumos (o que se compra) ---------- */
// un: unidade de estoque · custo: custo médio por un · min: estoque mínimo (central)
const INSUMOS = dadoComum('INSUMOS', () => [
  ['i01', 'Picanha bovina',            'Carnes',     'kg', 69.90, 30, 'f1'],
  ['i02', 'Alcatra bovina',            'Carnes',     'kg', 44.50, 40, 'f1'],
  ['i03', 'Coxa e sobrecoxa de frango','Carnes',     'kg', 12.80, 60, 'f1'],
  ['i04', 'Linguiça toscana',          'Carnes',     'kg', 18.90, 25, 'f1'],
  ['i05', 'Filé de tilápia',           'Carnes',     'kg', 39.00, 15, 'f1'],
  ['i06', 'Arroz tipo 1',              'Mercearia',  'kg',  5.40, 150, 'f3'],
  ['i07', 'Feijão carioca',            'Mercearia',  'kg',  7.20, 80, 'f3'],
  ['i08', 'Óleo de soja 900 ml',       'Mercearia',  'un',  6.90, 48, 'f3'],
  ['i09', 'Farinha de mandioca',       'Mercearia',  'kg',  6.10, 20, 'f3'],
  ['i10', 'Alface crespa',             'Hortifrúti', 'un',  2.50, 40, 'f2'],
  ['i11', 'Tomate',                    'Hortifrúti', 'kg',  6.80, 40, 'f2'],
  ['i12', 'Batata',                    'Hortifrúti', 'kg',  4.20, 60, 'f2'],
  ['i13', 'Cebola',                    'Hortifrúti', 'kg',  4.90, 30, 'f2'],
  ['i14', 'Refrigerante lata 350 ml',  'Bebidas',    'un',  2.95, 240, 'f4'],
  ['i15', 'Suco natural laranja 1 L',  'Bebidas',    'un',  7.50, 30, 'f4'],
  ['i16', 'Marmitex alumínio nº 9',    'Embalagens', 'un',  0.62, 500, 'f5'],
  ['i17', 'Gás P45',                   'Gás',        'un', 410.00, 2, 'f6']
].map(([id, nome, categoria, un, custo, min, fornecedor]) => ({ id, codigo: id.toUpperCase(), nome, categoria, un, custo, min, fornecedor, ncm: '', ativo: true })));

/* ---------- Eventos da folha (proventos e descontos) ---------- */
// inc: incide em INSS / FGTS / IRRF
const EVENTOS = dadoComum('EVENTOS', () => [
  ['001', 'Salário base',                 'provento', 'fixo',       [1, 1, 1]],
  ['010', 'Hora extra 50%',               'provento', 'horas',      [1, 1, 1]],
  ['011', 'Hora extra 100% (domingo/feriado)', 'provento', 'horas', [1, 1, 1]],
  ['015', 'DSR sobre horas extras',       'provento', 'calculado',  [1, 1, 1]],
  ['020', 'Adicional noturno 20%',        'provento', 'horas',      [1, 1, 1]],
  ['030', 'Gratificação',                 'provento', 'valor',      [1, 1, 1]],
  ['040', 'Quebra de caixa',              'provento', 'valor',      [1, 1, 1]],
  ['100', 'Adiantamento salarial (vale)', 'desconto', 'valor',      [0, 0, 0]],
  ['101', 'INSS',                         'desconto', 'calculado',  [0, 0, 0]],
  ['102', 'IRRF',                         'desconto', 'calculado',  [0, 0, 0]],
  ['103', 'Vale-transporte (até 6%)',     'desconto', 'calculado',  [0, 0, 0]],
  ['104', 'Faltas',                       'desconto', 'dias',       [1, 1, 1]],
  ['105', 'Atrasos',                      'desconto', 'horas',      [1, 1, 1]],
  ['106', 'DSR sobre faltas',             'desconto', 'calculado',  [1, 1, 1]],
  ['110', 'Consumo na loja',              'desconto', 'valor',      [0, 0, 0]],
  ['200', '13º salário · 1ª parcela',     'provento', 'calculado',  [0, 1, 0]],
  ['201', '13º salário · 2ª parcela',     'provento', 'calculado',  [1, 1, 1]],
  ['300', 'Férias',                       'provento', 'calculado',  [1, 1, 1]],
  ['301', '1/3 constitucional de férias', 'provento', 'calculado',  [1, 1, 1]],
  ['900', 'FGTS do mês (8%)',             'informativo', 'calculado', [0, 0, 0]]
].map(([codigo, nome, tipo, forma, [inss, fgts, irrf]]) => ({ id: codigo, codigo, nome, tipo, forma, inss: !!inss, fgts: !!fgts, irrf: !!irrf, ativo: true })));

/* ---------- Datas relativas a hoje (para o exemplo parecer vivo) ---------- */
const hojeISO = () => new Date().toISOString().slice(0, 10);
const diasDaqui = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
// Gerador simples e repetível (mesmos números a cada carga)
let _semente = 7; const aleat = () => (_semente = (_semente * 9301 + 49297) % 233280) / 233280;

/* ---------- Contas a pagar ---------- */
const CONTAS_PAGAR = dadoComum('CONTAS_PAGAR', () => (() => {
  const base = [
    // fornecedor, categoria, unidade, centro, valor, venc (dias), doc
    ['f1', '3.01', 'central', 'central.acougue', 18450.00, -3, 'NF 4521 1/2'],
    ['f1', '3.01', 'central', 'central.acougue', 18450.00, 11, 'NF 4521 2/2'],
    ['f2', '3.02', 'loja1', 'loja1.cozinha', 1840.30, 0, 'NF 99812'],
    ['f2', '3.02', 'loja2', 'loja2.cozinha', 1322.10, 0, 'NF 99813'],
    ['f2', '3.02', 'loja3', 'loja3.cozinha', 968.75, 1, 'NF 99814'],
    ['f3', '3.03', 'loja1', 'loja1.cozinha', 3210.00, 6, 'NF 12034'],
    ['f3', '3.03', 'loja2', 'loja2.cozinha', 2480.40, 6, 'NF 12035'],
    ['f4', '3.04', 'loja2', 'loja2.salao', 1925.00, -8, 'NF 7781'],
    ['f5', '3.05', 'loja3', 'loja3.delivery', 740.00, 14, 'NF 3302'],
    ['f6', '3.06', 'loja1', 'loja1.cozinha', 1230.00, 2, 'Recibo 118'],
    ['f7', '6.01', 'escritorio', 'escritorio.adm', 2400.00, 4, 'Honorários'],
    [null, '5.01', 'loja1', 'loja1.salao', 9800.00, 5, 'Aluguel'],
    [null, '5.01', 'loja2', 'loja2.salao', 7800.00, 5, 'Aluguel'],
    [null, '5.01', 'loja3', 'loja3.salao', 6200.00, 5, 'Aluguel'],
    [null, '5.02', 'loja1', 'loja1.cozinha', 1890.00, 0, 'Energia'],
    [null, '5.02', 'central', 'central.estoque', 3120.00, 9, 'Energia'],
    [null, '2.01', 'loja1', 'loja1.salao', 7420.00, 12, 'DAS'],
    [null, '2.01', 'loja2', 'loja2.salao', 5180.00, 12, 'DAS'],
    [null, '2.01', 'loja3', 'loja3.salao', 3640.00, 12, 'DAS'],
    [null, '4.01', 'loja1', 'loja1.cozinha', 28400.00, 18, 'Folha'],
    [null, '7.01', 'escritorio', 'escritorio.financeiro', 189.90, -15, 'Tarifas'],
    ['f3', '3.03', 'loja3', 'loja3.cozinha', 1710.00, -12, 'NF 11877']
  ];
  const fornNome = { null: '' };
  return base.map(([forn, cat, un, cc, valor, d, doc], i) => {
    const pago = d < -9 || (d < 0 && i % 2 === 0);
    return { id: 'p' + (i + 1), fornecedor: forn, favorecido: forn ? (FORNECEDORES.find(f => f.id === forn) || {}).nome : ({ '5.01': 'Imobiliária (exemplo)', '5.02': 'Concessionária de energia', '2.01': 'Receita Federal', '4.01': 'Folha de pagamento', '7.01': 'Banco (exemplo)' })[cat] || 'Diversos',
      categoria: cat, unidade: un, empresa: UNIDADE_EMPRESA[un], centro: cc, documento: doc, valor, vencimento: diasDaqui(d),
      pagoEm: pago ? diasDaqui(d) : null, valorPago: pago ? valor : null, forma: pago ? 'Pix' : '' };
  });
})());

/* ---------- Clientes PJ (convênios) e consumo ---------- */
// fechamento: 'quinzenal' (1-15 e 16-fim) ou 'mensal'; prazo: dias para vencer o boleto
const CLIENTES_PJ = dadoComum('CLIENTES_PJ', () => [
  ['c1', 'Construtora Exemplo Ltda',      '10111222000130', 'loja1', 'quinzenal', 10, 25],
  ['c2', 'Clínica Modelo de Saúde',       '20222333000141', 'loja1', 'quinzenal', 15, 12],
  ['c3', 'Transportadora Fictícia S/A',   '30333444000152', 'loja2', 'quinzenal', 10, 30],
  ['c4', 'Escritório Contábil Exemplo',   '40444555000163', 'loja3', 'mensal',    10, 8],
  ['c5', 'Indústria de Peças Modelo',     '50555666000174', 'loja2', 'quinzenal', 7,  40]
].map(([id, nome, cnpj, unidade, fechamento, prazo, pessoas]) => ({ id, nome, cnpj, unidade, empresa: UNIDADE_EMPRESA[unidade], fechamento, prazo, pessoas, limite: pessoas * 30 * 25, email: '', ativo: true })));

// Consumo do período aberto (cada refeição já saiu com NFC-e em nome do cliente)
const CONSUMOS_PJ = dadoComum('CONSUMOS_PJ', () => (() => {
  const lista = []; let n = 1;
  CLIENTES_PJ.forEach(c => {
    const dias = 12;
    for (let d = dias; d >= 1; d--) {
      const qtd = Math.round(c.pessoas * (0.55 + aleat() * 0.35));
      for (let k = 0; k < Math.min(qtd, 4); k++) {
        const valor = +(qtd / Math.min(qtd, 4) * (24 + aleat() * 14)).toFixed(2);
        lista.push({ id: 'k' + n, cliente: c.id, unidade: c.unidade, empresa: c.empresa, data: diasDaqui(-d), refeicoes: Math.round(qtd / Math.min(qtd, 4)), valor, nfce: String(100000 + n++) });
      }
    }
  });
  return lista;
})());

// Fechamentos já feitos (etapas: fechado → nota → boleto → pago)
const FECHAMENTOS_PJ = dadoComum('FECHAMENTOS_PJ', () => [
  { id: 'fx1', cliente: 'c1', periodo: 'Quinzena anterior', valor: 9640.50, refeicoes: 312, etapa: 'boleto', nota: 'NF-e 2231', boleto: '34191.79001 01043.510047 91020.150008 1 99990000964050', vencimento: diasDaqui(2) },
  { id: 'fx2', cliente: 'c3', periodo: 'Quinzena anterior', valor: 11820.00, refeicoes: 401, etapa: 'pago', nota: 'NF-e 2229', boleto: '—', vencimento: diasDaqui(-3), pagoEm: diasDaqui(-3) },
  { id: 'fx3', cliente: 'c5', periodo: 'Quinzena anterior', valor: 14210.80, refeicoes: 498, etapa: 'boleto', nota: 'NF-e 2232', boleto: '—', vencimento: diasDaqui(-4) },
  { id: 'fx4', cliente: 'c2', periodo: 'Quinzena anterior', valor: 3980.00, refeicoes: 140, etapa: 'fechado', nota: '', boleto: '', vencimento: '' }
].map(f => ({ ...f, empresa: (CLIENTES_PJ.find(c => c.id === f.cliente) || {}).empresa, unidade: (CLIENTES_PJ.find(c => c.id === f.cliente) || {}).unidade })));

/* ---------- Outros recebíveis (cartões e aplicativos de delivery) ---------- */
const RECEBER_OUTROS = dadoComum('RECEBER_OUTROS', () => (() => {
  const r = []; let n = 1;
  ['loja1', 'loja2', 'loja3'].forEach((un, ui) => {
    [[-2, 'Cartão de crédito', 'Operadora (exemplo)'], [1, 'Cartão de débito', 'Operadora (exemplo)'], [3, 'Cartão de crédito', 'Operadora (exemplo)'],
     [6, 'Repasse delivery', 'App de delivery (exemplo)'], [13, 'Repasse delivery', 'App de delivery (exemplo)']].forEach(([d, origem, pagador]) => {
      const valor = +((3 - ui) * 1800 + aleat() * 2400).toFixed(2);
      r.push({ id: 'r' + n++, origem, pagador, unidade: un, empresa: UNIDADE_EMPRESA[un], vencimento: diasDaqui(d), valor, recebidoEm: d < 0 ? diasDaqui(d) : null });
    });
  });
  return r;
})());

/* ---------- Notas de entrada (XML) já lançadas ---------- */
const NOTAS_ENTRADA = dadoComum('NOTAS_ENTRADA', () => [
  { id: 'n1', numero: '4521', serie: '1', fornecedor: 'f1', empresa: 'emp1', unidade: 'central', emissao: diasDaqui(-17), valor: 36565.00, itens: 4, parcelas: 2, situacao: 'lançada' },
  { id: 'n5', numero: '12001', serie: '2', fornecedor: 'f3', empresa: 'emp1', unidade: 'central', emissao: diasDaqui(-6), valor: 6228.00, itens: 3, parcelas: 1, situacao: 'lançada' },
  { id: 'n2', numero: '99812', serie: '1', fornecedor: 'f2', empresa: 'emp1', unidade: 'loja1', emissao: diasDaqui(-1), valor: 1840.30, itens: 9, parcelas: 1, situacao: 'lançada' },
  { id: 'n3', numero: '99813', serie: '1', fornecedor: 'f2', empresa: 'emp2', unidade: 'loja2', emissao: diasDaqui(-1), valor: 1322.10, itens: 7, parcelas: 1, situacao: 'lançada' },
  { id: 'n4', numero: '12036', serie: '2', fornecedor: 'f3', empresa: 'emp3', unidade: 'loja3', emissao: diasDaqui(0), valor: 2104.55, itens: 12, parcelas: 1, situacao: 'falta vincular itens' }
]);

/* =====================================================================
   BLOCO 3 · estoque, transferências, ficha técnica e cardápio
   ===================================================================== */
const insumo = id => INSUMOS.find(i => i.id === id) || { nome: id, un: '', custo: 0 };
// Onde existe estoque (o escritório não guarda mercadoria)
const LOCAIS_ESTOQUE = ['central', 'loja1', 'loja2', 'loja3'];

/* ---------- Itens das compras feitas pela central (para dividir entre as lojas) ---------- */
const COMPRA_ITENS = dadoComum('COMPRA_ITENS', () => ({
  n1: [['i01', 200], ['i02', 300], ['i03', 500], ['i04', 150]],
  n5: [['i06', 600], ['i07', 300], ['i08', 120]]
}));

/* ---------- Transferências (central → lojas e entre lojas) ----------
   itens: [insumo, enviada, recebida] · custo: custo médio no dia do envio */
const TRANSFERENCIAS = dadoComum('TRANSFERENCIAS', () => (() => {
  const t = []; let n = 1;
  const nova = (dias, origem, destino, itens, compra, situacao = 'recebida', acertoEm = null) => t.push({
    id: 't' + n, numero: 'T-' + String(n++).padStart(4, '0'), data: diasDaqui(dias), origem, destino, compra,
    itens: itens.map(([i, q, r]) => ({ insumo: i, enviada: q, recebida: situacao === 'em trânsito' ? null : (r ?? q), custo: insumo(i).custo })),
    situacao, acertoEm, obs: '' });
  // Compra de carnes n1 (200 kg picanha, 300 alcatra, 500 frango, 150 linguiça), dividida
  nova(-16, 'central', 'loja1', [['i01', 50], ['i02', 70], ['i03', 120], ['i04', 35]], 'n1', 'recebida', diasDaqui(-2));
  nova(-16, 'central', 'loja2', [['i01', 45], ['i02', 65], ['i03', 110], ['i04', 30]], 'n1', 'recebida', diasDaqui(-2));
  nova(-16, 'central', 'loja3', [['i01', 35], ['i02', 55], ['i03', 100, 97.5], ['i04', 30]], 'n1', 'divergente', diasDaqui(-2));
  nova(-9, 'central', 'loja1', [['i01', 25], ['i03', 60]], 'n1');
  nova(-9, 'central', 'loja2', [['i01', 20], ['i03', 50]], 'n1');
  // Mercearia n5 (600 kg arroz, 300 feijão, 120 óleo)
  nova(-5, 'central', 'loja1', [['i06', 150], ['i07', 70], ['i08', 30]], 'n5');
  nova(-5, 'central', 'loja2', [['i06', 140], ['i07', 65], ['i08', 28]], 'n5');
  nova(-1, 'central', 'loja3', [['i06', 120], ['i07', 60], ['i08', 24]], 'n5', 'em trânsito');
  // Empréstimo entre lojas no meio da semana
  nova(-3, 'loja2', 'loja3', [['i11', 8], ['i13', 5]], null);
  nova(0, 'loja1', 'loja2', [['i14', 48]], null, 'em trânsito');
  return t;
})());

/* ---------- Saldo de estoque por local (exemplo) ----------
   consumo: média de uso por dia · usado para "dias de cobertura" */
const ESTOQUE = dadoComum('ESTOQUE', () => (() => {
  const r = [];
  INSUMOS.forEach(i => LOCAIS_ESTOQUE.forEach(local => {
    const central = local === 'central';
    if (!central && i.categoria === 'Gás') { r.push({ insumo: i.id, local, saldo: Math.round(aleat() * 3), min: 1, consumo: 0.15 }); return; }
    const min = central ? i.min : Math.max(1, Math.round(i.min / 4));
    const consumo = +(central ? 0 : min / 5).toFixed(2);
    let saldo = min * (aleat() < 0.18 ? 0.3 + aleat() * 0.6 : 1.05 + aleat() * 1.4);   // ~1 em 5 abaixo do mínimo
    if (i.un === 'un' || i.un === 'cx') saldo = Math.round(saldo); else saldo = +saldo.toFixed(1);
    r.push({ insumo: i.id, local, saldo, min, consumo });
  }));
  return r;
})());

/* ---------- Fichas técnicas (receitas de produção) ----------
   itens: [insumo, quantidade bruta, fator de correção (perda na limpeza/preparo)]
   rende: quanto sai pronto (kg) · porcao: gramas de referência */
const FICHAS = dadoComum('FICHAS', () => [
  ['fc01', 'Arroz branco',            'Guarnições', 12,  150, 35, [['i06', 5, 1], ['i08', 0.2, 1], ['i13', 0.3, 1.1]], 'Refogar a cebola no óleo, juntar o arroz lavado e água na proporção 1:2. Cozinhar tampado.'],
  ['fc02', 'Feijão carioca temperado','Guarnições', 10,  150, 90, [['i07', 4, 1], ['i04', 0.8, 1], ['i13', 0.3, 1.1]], 'Deixar de molho 8 h, cozinhar na pressão 30 min e temperar com linguiça e cebola refogadas.'],
  ['fc03', 'Picanha na brasa',        'Carnes',     7.5, 120, 40, [['i01', 10, 1.15]], 'Limpar a capa de gordura em excesso, porcionar em bifes de 2 cm, sal grosso e brasa forte.'],
  ['fc04', 'Frango assado',           'Carnes',     7,   180, 70, [['i03', 10, 1.05], ['i13', 0.5, 1.1]], 'Temperar na véspera; assar a 200 °C por 50 min virando na metade.'],
  ['fc05', 'Tilápia grelhada',        'Carnes',     4,   150, 25, [['i05', 5, 1]], 'Temperar com limão e sal, grelhar na chapa 4 min de cada lado.'],
  ['fc06', 'Salada verde',            'Saladas',    4,   80,  15, [['i10', 12, 1.3], ['i11', 2, 1.1], ['i13', 0.5, 1.1]], 'Higienizar as folhas, cortar o tomate em gomos e a cebola em rodelas finas.'],
  ['fc07', 'Batata frita',            'Guarnições', 3.5, 100, 30, [['i12', 6, 1.25], ['i08', 1, 1]], 'Descascar, cortar em palito, pré-fritar a 160 °C e finalizar a 180 °C na hora.'],
  ['fc08', 'Farofa da casa',          'Guarnições', 2.6, 40,  15, [['i09', 2, 1], ['i04', 0.5, 1], ['i13', 0.3, 1.1]], 'Dourar a linguiça e a cebola, juntar a farinha aos poucos mexendo sempre.']
].map(([id, nome, grupo, rende, porcao, tempo, itens, preparo]) => ({
  id, codigo: id.toUpperCase(), nome, grupo, rende, porcao, tempo, preparo, ativo: true,
  itens: itens.map(([i, qtd, fc]) => ({ insumo: i, qtd, fc }))
})));
// Custo de uma ficha (total e por kg pronto), sempre pelo custo médio atual dos insumos
const custoFicha = f => { const total = f.itens.reduce((a, it) => a + it.qtd * insumo(it.insumo).custo, 0); return { total, kg: f.rende ? total / f.rende : 0 }; };

/* ---------- Cardápio e produtos de venda ----------
   comp: [tipo 'ficha'|'insumo', id, quantidade por unidade vendida]
   Para produtos por kg a composição soma 1 kg (o "mix" do buffet).
   precos: por empresa (cada CNPJ pode praticar o seu) */
const IMPOSTO_EMPRESA = { emp1: 6.0, emp2: 6.0, emp3: 4.5 }; // % sobre a venda (exemplo; o contador confirma)
const TAXA_CARTAO = 2.4;     // % média das maquininhas (exemplo)
const META_CMV = { Buffet: 35, Marmitex: 35, Bebidas: 50 }; // CMV máximo desejado por grupo (% do preço)
const metaCMV = p => META_CMV[p.grupo] ?? 35;
const PRODUTOS_VENDA = dadoComum('PRODUTOS_VENDA', () => [
  ['p01', 'Buffet livre por kg',      'Buffet',     'kg', 8, [['ficha', 'fc01', .22], ['ficha', 'fc02', .18], ['ficha', 'fc03', .12], ['ficha', 'fc04', .16], ['ficha', 'fc05', .06], ['ficha', 'fc06', .10], ['ficha', 'fc07', .10], ['ficha', 'fc08', .06]], { emp1: 89.90, emp2: 84.90, emp3: 79.90 }],
  ['p02', 'Grelhados por kg',         'Buffet',     'kg', 5, [['ficha', 'fc03', .6], ['ficha', 'fc04', .4]], { emp1: 119.90, emp2: 114.90, emp3: 109.90 }],
  ['p03', 'Marmitex P (500 g)',       'Marmitex',   'un', 0, [['ficha', 'fc01', .14], ['ficha', 'fc02', .1], ['ficha', 'fc04', .14], ['ficha', 'fc06', .05], ['ficha', 'fc07', .05], ['ficha', 'fc08', .02], ['insumo', 'i16', 1]], { emp1: 24.90, emp2: 22.90, emp3: 21.90 }],
  ['p04', 'Marmitex G (800 g)',       'Marmitex',   'un', 0, [['ficha', 'fc01', .22], ['ficha', 'fc02', .16], ['ficha', 'fc03', .12], ['ficha', 'fc04', .12], ['ficha', 'fc06', .06], ['ficha', 'fc07', .08], ['ficha', 'fc08', .04], ['insumo', 'i16', 1]], { emp1: 34.90, emp2: 32.90, emp3: 31.90 }],
  ['p05', 'Refrigerante lata 350 ml', 'Bebidas',    'un', 0, [['insumo', 'i14', 1]], { emp1: 6.00, emp2: 6.00, emp3: 5.50 }],
  ['p06', 'Suco natural (copo 300 ml)','Bebidas',   'un', 0, [['insumo', 'i15', .3]], { emp1: 7.00, emp2: 7.00, emp3: 6.50 }]
].map(([id, nome, grupo, un, perda, comp, precos]) => ({ id, codigo: id.toUpperCase(), nome, grupo, un, perda, comp: comp.map(([tipo, ref, qtd]) => ({ tipo, ref, qtd })), precos, ativo: true })));
// Custo de 1 unidade vendida (ou 1 kg), já com a perda/sobra do buffet
const custoProduto = p => p.comp.reduce((a, c) => a + c.qtd * (c.tipo === 'ficha' ? custoFicha(FICHAS.find(f => f.id === c.ref) || { itens: [] }).kg : insumo(c.ref).custo), 0) * (1 + (p.perda || 0) / 100);
// Margem de contribuição de um preço numa empresa (preço − custo − imposto − cartão)
const margemProduto = (p, emp) => {
  const preco = p.precos[emp] || 0, custo = custoProduto(p);
  const desp = preco * ((IMPOSTO_EMPRESA[emp] || 0) + TAXA_CARTAO) / 100;
  return { preco, custo, desp, margem: preco - custo - desp, pct: preco ? (preco - custo - desp) / preco * 100 : 0, cmv: preco ? custo / preco * 100 : 0 };
};
// Preço sugerido para atingir um CMV desejado
const precoParaCMV = (custo, cmv) => cmv > 0 ? custo / (cmv / 100) : 0;
