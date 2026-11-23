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

/* ---------- Alocação: unidade ou escritório ----------
   Categoria do escritório = custo do grupo, rateado entre as lojas no resultado.
   A regra do rateio (partes iguais ou proporcional ao faturamento) ainda está em aberto:
   fica para a tela da DRE, não para o cadastro. */
alter table public.categorias_financeiras
  add column if not exists alocacao text not null default 'unidade' check (alocacao in ('unidade', 'escritorio'));
comment on column public.categorias_financeiras.alocacao is 'unidade = fica na loja do lançamento; escritorio = rateado entre as lojas no resultado';

/* ---------- Contas a pagar: categoria obrigatória ----------
   Conta nova precisa de categoria, e quem tem categoria não pode ficar sem.
   As antigas sem categoria continuam podendo ser pagas (aparecem como "Sem categoria")
   até alguém editar e escolher; por isso é gatilho e não check. */
create or replace function public.exigir_categoria_pagar()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.categoria_id is null and (tg_op = 'INSERT' or old.categoria_id is not null) then
    raise exception 'Escolha a categoria: toda conta a pagar precisa de categoria financeira.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists contas_pagar_categoria on public.contas_pagar;
create trigger contas_pagar_categoria before insert or update of categoria_id on public.contas_pagar
  for each row execute function public.exigir_categoria_pagar();

/* ---------- Produto de venda → categoria financeira (receita) ----------
   A venda entra na DRE pela categoria do produto. Vazia = padrão
   (1.02 Convênios PJ para preço de convênio, senão 1.01 Vendas nas lojas). */
alter table public.produtos
  add column if not exists categoria_financeira_id uuid references public.categorias_financeiras (id);
comment on column public.produtos.categoria_financeira_id is 'Categoria de receita da venda na DRE; vazia = padrão (1.01 ou 1.02 se convênio)';
