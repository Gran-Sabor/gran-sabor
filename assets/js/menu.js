/* =====================================================================
   Gran Sabor · menu.js — mapa das telas (menu lateral)
   arquivo: null → tela ainda não feita (abre o aviso "em construção").
   O id de cada tela será o mesmo usado nas permissões por perfil (fase final).
   ===================================================================== */
const MENU = [
  { id: 'inicio', nome: 'Início', icone: 'inicio', arquivo: 'pages/inicio.html' },
  { grupo: 'Vendas', icone: 'vendas', itens: [
    { id: 'caixa',          nome: 'Frente de caixa (PDV)' },
    { id: 'delivery',       nome: 'Delivery' },
    { id: 'faturamento_pj', nome: 'Faturamento empresas (PJ)' },
    { id: 'vendas_dia',     nome: 'Vendas do dia' },
    { id: 'fechamento_cx',  nome: 'Abertura e fechamento de caixa' }
  ]},
  { grupo: 'Cozinha e produção', icone: 'cozinha', itens: [
    { id: 'ficha_tecnica',  nome: 'Ficha técnica' },
    { id: 'producao',       nome: 'Produção do dia' },
    { id: 'cortes',         nome: 'Cortes de carne (central)' }
  ]},
  { grupo: 'Estoque', icone: 'estoque', itens: [
    { id: 'posicao',        nome: 'Posição de estoque' },
    { id: 'movimentos',     nome: 'Movimentações' },
    { id: 'transferencias', nome: 'Transferências entre unidades' },
    { id: 'perdas',         nome: 'Perdas e consumo interno' },
    { id: 'inventario',     nome: 'Inventário' }
  ]},
  { grupo: 'Compras', icone: 'compras', itens: [
    { id: 'pedidos_compra', nome: 'Pedidos de compra' },
    { id: 'notas_entrada',  nome: 'Notas de entrada' },
    { id: 'sugestao',       nome: 'Sugestão de compra' }
  ]},
  { grupo: 'Financeiro', icone: 'financeiro', itens: [
    { id: 'pagar',          nome: 'Contas a pagar' },
    { id: 'receber',        nome: 'Contas a receber' },
    { id: 'fluxo',          nome: 'Fluxo de caixa' },
    { id: 'conciliacao',    nome: 'Extratos e conciliação' },
    { id: 'dividas',        nome: 'Dívidas e empréstimos' }
  ]},
  { grupo: 'Fiscal', icone: 'fiscal', itens: [
    { id: 'notas_emitidas', nome: 'Cupons e notas emitidas' },
    { id: 'pendencias_fis', nome: 'Pendências fiscais' },
    { id: 'conferencia',    nome: 'Conferência vendas × notas × caixa' }
  ]},
  { grupo: 'Pessoas e RH', icone: 'pessoas', itens: [
    { id: 'colaboradores',  nome: 'Colaboradores' },
    { id: 'escala',         nome: 'Escala' },
    { id: 'ponto',          nome: 'Ponto e horas extras' },
    { id: 'holerites',      nome: 'Holerites' },
    { id: 'ferias',         nome: 'Férias' },
    { id: 'folha',          nome: 'Fechamento da folha' }
  ]},
  { grupo: 'Marketing', icone: 'marketing', itens: [
    { id: 'campanhas',      nome: 'Campanhas e promoções' },
    { id: 'comunicados',    nome: 'Comunicados' },
    { id: 'clientes_fieis', nome: 'Clientes e fidelidade' }
  ]},
  { grupo: 'Indicadores', icone: 'indicadores', itens: [
    { id: 'resultado',      nome: 'Resultado (DRE gerencial)' },
    { id: 'cmv',            nome: 'CMV por kg e por prato' },
    { id: 'comparativo',    nome: 'Comparativo entre unidades' },
    { id: 'orcamento',      nome: 'Orçamento e metas' }
  ]},
  { grupo: 'Cadastros', icone: 'cadastros', itens: [
    { id: 'unidades',       nome: 'Empresas e unidades' },
    { id: 'produtos',       nome: 'Cardápio e produtos' },
    { id: 'insumos',        nome: 'Insumos' },
    { id: 'fornecedores',   nome: 'Fornecedores' },
    { id: 'clientes',       nome: 'Clientes e convênios' },
    { id: 'plano_contas',   nome: 'Plano de contas' }
  ]},
  { grupo: 'Configurações', icone: 'config', itens: [
    { id: 'usuarios',       nome: 'Usuários e acessos' },
    { id: 'auditoria',      nome: 'Auditoria' },
    { id: 'backups',        nome: 'Backups' }
  ]}
];

/* Empresas do grupo. Seleção "todas" = visão consolidada. */
const UNIDADES = [
  { id: 'todas',    nome: 'Consolidado (todas)' },
  { id: 'loja1',    nome: 'Loja 1' },
  { id: 'loja2',    nome: 'Loja 2' },
  { id: 'loja3',    nome: 'Loja 3' },
  { id: 'central',  nome: 'Central de carnes' },
  { id: 'escritorio', nome: 'Escritório' }
];

/* Todas as telas numa lista só (para abas e busca) */
const TELAS = MENU.flatMap(m => m.itens ? m.itens.map(i => ({ ...i, grupo: m.grupo })) : [m]);
const acharTela = id => TELAS.find(t => t.id === id);
const enderecoTela = t => t.arquivo || 'pages/em-construcao.html?t=' + encodeURIComponent(t.nome) + '&g=' + encodeURIComponent(t.grupo || '');
