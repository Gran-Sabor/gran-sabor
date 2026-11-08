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
