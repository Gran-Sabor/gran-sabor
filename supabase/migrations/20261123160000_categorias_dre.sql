/* =====================================================================
   Categorias financeiras pela DRE (planilha de DRE da Gran Sabor)
   - Linhas do resultado passam a ser as da DRE: Vendas brutas, Impostos,
     Custos · Mercadoria, Custos · Pessoal, Despesas, Resultado financeiro,
     Passivo anterior, Investimentos. Converte as categorias que já existem.
   - origem ganha 'dre' (categorias criadas pelo botão "Importar DRE").
   Só estrutura: as categorias entram pela tela, nunca por migração.
   A tabela já está no Realtime e no gatilho de versão (20261116010000).
   ===================================================================== */
alter table public.categorias_financeiras alter column dre set default 'Despesas';

alter table public.categorias_financeiras drop constraint if exists categorias_financeiras_origem_check;
alter table public.categorias_financeiras add constraint categorias_financeiras_origem_check
  check (origem in ('tela', 'fluxo', 'dre'));

update public.categorias_financeiras set dre = case
    when grupo = 'Dívidas anteriores' then 'Passivo anterior'
    when dre = 'Receita bruta' then 'Vendas brutas'
    when dre = 'Impostos sobre vendas' then 'Impostos'
    when dre = 'CMV' then 'Custos · Mercadoria'
    when dre = 'Pessoal' then 'Custos · Pessoal'
    when dre in ('Deduções', 'Ocupação', 'Administrativas') then 'Despesas'
    when dre = 'Financeiras' and grupo = 'Bancário' then 'Despesas'
    when dre = 'Financeiras' then 'Resultado financeiro'
    else dre end
where dre in ('Receita bruta', 'Impostos sobre vendas', 'CMV', 'Pessoal', 'Deduções', 'Ocupação', 'Administrativas', 'Financeiras')
   or grupo = 'Dívidas anteriores';
