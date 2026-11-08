/* =====================================================================
   Gran Sabor · exemplo.js — DADOS FICTÍCIOS compartilhados pelas telas
   Servem para aprovar telas e regras antes dos dados reais. Nomes, CNPJs,
   pessoas e valores são inventados. Quando os dados reais chegarem, cada
   tela passa a ler do banco e este arquivo deixa de ser usado.
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
const CATEGORIAS = [
  ['1.01', 'Vendas balcão (por kg)',         'receita', 'Receita bruta', 'variavel'],
  ['1.02', 'Vendas delivery',                'receita', 'Receita bruta', 'variavel'],
  ['1.03', 'Convênios empresas (PJ)',        'receita', 'Receita bruta', 'variavel'],
  ['1.04', 'Bebidas e sobremesas',           'receita', 'Receita bruta', 'variavel'],
  ['2.01', 'Simples Nacional (DAS)',         'despesa', 'Impostos sobre vendas', 'variavel'],
  ['2.02', 'Taxas de cartão e apps',         'despesa', 'Deduções', 'variavel'],
  ['3.01', 'Carnes',                         'despesa', 'CMV', 'variavel'],
  ['3.02', 'Hortifrúti',                     'despesa', 'CMV', 'variavel'],
  ['3.03', 'Mercearia',                      'despesa', 'CMV', 'variavel'],
  ['3.04', 'Bebidas para revenda',           'despesa', 'CMV', 'variavel'],
  ['3.05', 'Embalagens e descartáveis',      'despesa', 'CMV', 'variavel'],
  ['3.06', 'Gás de cozinha',                 'despesa', 'CMV', 'variavel'],
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
].map(([codigo, nome, tipo, dre, natureza]) => ({ id: codigo, codigo, nome, tipo, dre, natureza, ativo: true }));

/* ---------- Centros de custo (unidade + setor) ---------- */
const CENTROS = [
  ['loja1', 'cozinha', 'Cozinha'], ['loja1', 'salao', 'Salão e caixa'], ['loja1', 'delivery', 'Delivery'],
  ['loja2', 'cozinha', 'Cozinha'], ['loja2', 'salao', 'Salão e caixa'], ['loja2', 'delivery', 'Delivery'],
  ['loja3', 'cozinha', 'Cozinha'], ['loja3', 'salao', 'Salão e caixa'], ['loja3', 'delivery', 'Delivery'],
  ['central', 'acougue', 'Açougue e cortes'], ['central', 'estoque', 'Armazenagem'], ['central', 'logistica', 'Entrega às lojas'],
  ['escritorio', 'adm', 'Administrativo'], ['escritorio', 'financeiro', 'Financeiro e RH']
].map(([unidade, setor, nome], i) => ({ id: unidade + '.' + setor, codigo: `${String(i + 1).padStart(2, '0')}`, unidade, empresa: UNIDADE_EMPRESA[unidade], setor, nome, ativo: true }));

/* ---------- Fornecedores ---------- */
const FORNECEDORES = [
  ['f1', 'Frigorífico Exemplo Sul',     '12345678000195', 'Carnes',     'SP', 'boleto 14 dias', ['emp1']],
  ['f2', 'Distribuidora Verde Fresco',  '23456789000107', 'Hortifrúti', 'SP', 'pix na entrega', ['emp1', 'emp2', 'emp3']],
  ['f3', 'Atacado Mercearia Central',   '34567890000110', 'Mercearia',  'SP', 'boleto 28 dias', ['emp1', 'emp2', 'emp3']],
  ['f4', 'Bebidas Exemplo Ltda',        '45678901000128', 'Bebidas',    'SP', 'boleto 21 dias', ['emp1', 'emp2', 'emp3']],
  ['f5', 'Embalagens Modelo',           '56789012000130', 'Embalagens', 'SP', 'boleto 30 dias', ['emp2', 'emp3']],
  ['f6', 'Gás Exemplo Distribuidora',   '67890123000142', 'Gás',        'SP', 'pix na entrega', ['emp1', 'emp2', 'emp3']],
  ['f7', 'Escritório Contábil Modelo',  '78901234000155', 'Serviços',   'SP', 'boleto dia 10',  ['emp1', 'emp2', 'emp3']]
].map(([id, nome, cnpj, categoria, uf, prazo, empresas]) => ({ id, nome, cnpj, categoria, uf, prazo, empresas, contato: '', ativo: true }));

/* ---------- Insumos (o que se compra) ---------- */
// un: unidade de estoque · custo: custo médio por un · min: estoque mínimo (central)
const INSUMOS = [
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
].map(([id, nome, categoria, un, custo, min, fornecedor]) => ({ id, codigo: id.toUpperCase(), nome, categoria, un, custo, min, fornecedor, ncm: '', ativo: true }));

/* ---------- Eventos da folha (proventos e descontos) ---------- */
// inc: incide em INSS / FGTS / IRRF
const EVENTOS = [
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
].map(([codigo, nome, tipo, forma, [inss, fgts, irrf]]) => ({ id: codigo, codigo, nome, tipo, forma, inss: !!inss, fgts: !!fgts, irrf: !!irrf, ativo: true }));

/* ---------- Datas relativas a hoje (para o exemplo parecer vivo) ---------- */
const hojeISO = () => new Date().toISOString().slice(0, 10);
const diasDaqui = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
// Gerador simples e repetível (mesmos números a cada carga)
let _semente = 7; const aleat = () => (_semente = (_semente * 9301 + 49297) % 233280) / 233280;

/* ---------- Contas a pagar ---------- */
const CONTAS_PAGAR = (() => {
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
})();

/* ---------- Clientes PJ (convênios) e consumo ---------- */
// fechamento: 'quinzenal' (1-15 e 16-fim) ou 'mensal'; prazo: dias para vencer o boleto
const CLIENTES_PJ = [
  ['c1', 'Construtora Exemplo Ltda',      '10111222000130', 'loja1', 'quinzenal', 10, 25],
  ['c2', 'Clínica Modelo de Saúde',       '20222333000141', 'loja1', 'quinzenal', 15, 12],
  ['c3', 'Transportadora Fictícia S/A',   '30333444000152', 'loja2', 'quinzenal', 10, 30],
  ['c4', 'Escritório Contábil Exemplo',   '40444555000163', 'loja3', 'mensal',    10, 8],
  ['c5', 'Indústria de Peças Modelo',     '50555666000174', 'loja2', 'quinzenal', 7,  40]
].map(([id, nome, cnpj, unidade, fechamento, prazo, pessoas]) => ({ id, nome, cnpj, unidade, empresa: UNIDADE_EMPRESA[unidade], fechamento, prazo, pessoas, limite: pessoas * 30 * 25, email: '', ativo: true }));

// Consumo do período aberto (cada refeição já saiu com NFC-e em nome do cliente)
const CONSUMOS_PJ = (() => {
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
})();

// Fechamentos já feitos (etapas: fechado → nota → boleto → pago)
const FECHAMENTOS_PJ = [
  { id: 'fx1', cliente: 'c1', periodo: 'Quinzena anterior', valor: 9640.50, refeicoes: 312, etapa: 'boleto', nota: 'NF-e 2231', boleto: '34191.79001 01043.510047 91020.150008 1 99990000964050', vencimento: diasDaqui(2) },
  { id: 'fx2', cliente: 'c3', periodo: 'Quinzena anterior', valor: 11820.00, refeicoes: 401, etapa: 'pago', nota: 'NF-e 2229', boleto: '—', vencimento: diasDaqui(-3), pagoEm: diasDaqui(-3) },
  { id: 'fx3', cliente: 'c5', periodo: 'Quinzena anterior', valor: 14210.80, refeicoes: 498, etapa: 'boleto', nota: 'NF-e 2232', boleto: '—', vencimento: diasDaqui(-4) },
  { id: 'fx4', cliente: 'c2', periodo: 'Quinzena anterior', valor: 3980.00, refeicoes: 140, etapa: 'fechado', nota: '', boleto: '', vencimento: '' }
].map(f => ({ ...f, empresa: (CLIENTES_PJ.find(c => c.id === f.cliente) || {}).empresa, unidade: (CLIENTES_PJ.find(c => c.id === f.cliente) || {}).unidade }));

/* ---------- Outros recebíveis (cartões e aplicativos de delivery) ---------- */
const RECEBER_OUTROS = (() => {
  const r = []; let n = 1;
  ['loja1', 'loja2', 'loja3'].forEach((un, ui) => {
    [[-2, 'Cartão de crédito', 'Operadora (exemplo)'], [1, 'Cartão de débito', 'Operadora (exemplo)'], [3, 'Cartão de crédito', 'Operadora (exemplo)'],
     [6, 'Repasse delivery', 'App de delivery (exemplo)'], [13, 'Repasse delivery', 'App de delivery (exemplo)']].forEach(([d, origem, pagador]) => {
      const valor = +((3 - ui) * 1800 + aleat() * 2400).toFixed(2);
      r.push({ id: 'r' + n++, origem, pagador, unidade: un, empresa: UNIDADE_EMPRESA[un], vencimento: diasDaqui(d), valor, recebidoEm: d < 0 ? diasDaqui(d) : null });
    });
  });
  return r;
})();

/* ---------- Notas de entrada (XML) já lançadas ---------- */
const NOTAS_ENTRADA = [
  { id: 'n1', numero: '4521', serie: '1', fornecedor: 'f1', empresa: 'emp1', unidade: 'central', emissao: diasDaqui(-17), valor: 36900.00, itens: 4, parcelas: 2, situacao: 'lançada' },
  { id: 'n2', numero: '99812', serie: '1', fornecedor: 'f2', empresa: 'emp1', unidade: 'loja1', emissao: diasDaqui(-1), valor: 1840.30, itens: 9, parcelas: 1, situacao: 'lançada' },
  { id: 'n3', numero: '99813', serie: '1', fornecedor: 'f2', empresa: 'emp2', unidade: 'loja2', emissao: diasDaqui(-1), valor: 1322.10, itens: 7, parcelas: 1, situacao: 'lançada' },
  { id: 'n4', numero: '12036', serie: '2', fornecedor: 'f3', empresa: 'emp3', unidade: 'loja3', emissao: diasDaqui(0), valor: 2104.55, itens: 12, parcelas: 1, situacao: 'falta vincular itens' }
];
