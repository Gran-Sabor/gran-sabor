-- =====================================================================
-- Gran Sabor · caixas e vendas do PDV no banco (ao vivo)
-- Antes, o caixa aberto e as vendas ficavam só no computador que abriu.
-- Agora cada caixa (abertura, fundo de troco, sangrias, suprimentos,
-- fechamento) e cada venda (itens, pagamentos, NFC-e) mora numa linha do
-- banco, e a tela Início de qualquer computador vê na hora.
--
-- O registro inteiro fica em "dados" (o mesmo formato que as telas usam);
-- as colunas de busca (unidade, PDV, datas) são CALCULADAS a partir dele,
-- então o dado continua morando num lugar só.
-- Gravação com conferência: a tela só grava se atualizado_em ainda é o que
-- ela leu; se outro computador mudou antes, nada é gravado e a tela mostra
-- o valor novo.
-- Não se apaga caixa nem venda (venda cancelada continua, com a data do
-- cancelamento).
-- =====================================================================

create table public.caixas (
  id              text primary key check (length(id) between 3 and 60),
  dados           jsonb not null check (jsonb_typeof(dados) = 'object' and dados->>'id' = id),
  unidade         text generated always as (dados->>'unidade') stored,
  pdv             smallint generated always as ((dados->>'pdv')::smallint) stored,
  aberto_em       text generated always as (dados->>'abertoEm') stored,
  fechado_em      text generated always as (dados->>'fechadoEm') stored,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references auth.users (id) default auth.uid(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  check (unidade is not null and pdv between 1 and 20 and aberto_em is not null)
);
comment on table public.caixas is 'Caixas do PDV (um por abertura): fundo de troco, sangrias, suprimentos e conferência do fechamento';
-- Um PDV só pode ter UM caixa aberto: dois computadores abrindo ao mesmo tempo, o segundo é barrado
create unique index caixas_um_aberto_por_pdv on public.caixas (unidade, pdv) where fechado_em is null;
create index caixas_aberto_em on public.caixas (aberto_em);

create table public.vendas (
  id              text primary key check (length(id) between 2 and 60),
  dados           jsonb not null check (jsonb_typeof(dados) = 'object' and dados->>'id' = id),
  unidade         text generated always as (dados->>'unidade') stored,
  caixa           text generated always as (dados->>'caixa') stored references public.caixas (id),
  data            text generated always as (dados->>'data') stored,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references auth.users (id) default auth.uid(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  check (unidade is not null and data ~ '^\d{4}-\d{2}-\d{2}$')
);
comment on table public.vendas is 'Lançamentos do PDV: venda com NFC-e, convênio PJ, consumo de funcionário e cortesia';
create index vendas_data on public.vendas (data);
create index vendas_caixa on public.vendas (caixa);
create index vendas_atualizado_em on public.vendas (atualizado_em);
create index caixas_atualizado_em on public.caixas (atualizado_em);

/* ---------- Carimbo de alteração e versão (ao vivo) ---------- */
create trigger caixas_atualizacao before update on public.caixas
  for each row execute function public.marcar_atualizacao();
create trigger vendas_atualizacao before update on public.vendas
  for each row execute function public.marcar_atualizacao();

create trigger caixas_versao after insert or update or delete on public.caixas
  for each statement execute function public.subir_versao();
create trigger vendas_versao after insert or update or delete on public.vendas
  for each statement execute function public.subir_versao();

insert into public.dados_versao (tabela) values ('caixas'), ('vendas')
on conflict (tabela) do nothing;

/* ---------- Acesso: só usuário cadastrado e ativo (sem apagar) ---------- */
alter table public.caixas enable row level security;
alter table public.vendas enable row level security;

create policy caixas_ver on public.caixas for select to authenticated using (public.usuario_ativo());
create policy caixas_incluir on public.caixas for insert to authenticated with check (public.usuario_ativo());
create policy caixas_alterar on public.caixas for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

create policy vendas_ver on public.vendas for select to authenticated using (public.usuario_ativo());
create policy vendas_incluir on public.vendas for insert to authenticated with check (public.usuario_ativo());
create policy vendas_alterar on public.vendas for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

grant select, insert, update on public.caixas, public.vendas to authenticated;

/* ---------- Realtime ----------
   As telas escutam dados_versao (já publicada); as duas tabelas também entram
   na publicação, como pede a regra do projeto. */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.caixas, public.vendas;
  end if;
end;
$$;
