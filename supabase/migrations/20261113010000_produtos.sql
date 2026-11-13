-- =====================================================================
-- Gran Sabor · produtos de venda (cardápio) e preço por loja
-- Um produto é o que se vende no caixa (Refeição por kg, marmitex, bebida...).
-- O preço fica por loja (cada loja é um estabelecimento com o seu CNPJ),
-- numa tabela à parte: produto sem preço numa loja não aparece no caixa dela.
-- O custo NÃO mora aqui: vem da ficha técnica / insumos (próximos pacotes).
-- Convênio PJ (preço combinado com empresa cliente) não é venda ao consumidor:
-- fica marcado em "convenio" e sai com NF-e + boleto no fechamento do período.
-- Os dados reais entram pela tela (botão "Importar planilha"), nunca pelo
-- repositório, que é público.
-- Não se apaga produto: desativa (ativo = false).
-- =====================================================================

create table public.produtos (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique check (length(trim(codigo)) between 1 and 20),
  nome            text not null check (length(trim(nome)) between 1 and 80),
  categoria       text not null default 'Sem categoria' check (length(trim(categoria)) between 1 and 60),
  vende_por       text not null default 'un' check (vende_por in ('un', 'kg')),
  convenio        boolean not null default false,
  ativo           boolean not null default true,
  origem          text not null default 'tela' check (origem in ('tela', 'saipos')),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid()
);
comment on table public.produtos is 'Produtos de venda (cardápio) da Gran Sabor; código = código do PDV (Saipos) quando importado';
comment on column public.produtos.convenio is 'Preço de convênio PJ: não é venda ao consumidor (sem NFC-e; NF-e + boleto no fechamento)';

create trigger produtos_atualizacao
  before update on public.produtos
  for each row execute function public.marcar_atualizacao();

create table public.produto_precos (
  produto_id      uuid not null references public.produtos (id) on delete cascade,
  unidade_id      uuid not null references public.unidades (id),
  preco           numeric(10, 2) not null check (preco > 0),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  primary key (produto_id, unidade_id)
);
comment on table public.produto_precos is 'Preço de venda de cada produto em cada loja (por kg quando o produto é vendido por kg)';
create index produto_precos_unidade on public.produto_precos (unidade_id);

create trigger produto_precos_atualizacao
  before update on public.produto_precos
  for each row execute function public.marcar_atualizacao();

-- Acesso: só usuário cadastrado e ativo
alter table public.produtos enable row level security;
alter table public.produto_precos enable row level security;

create policy produtos_ver on public.produtos
  for select to authenticated using (public.usuario_ativo());
create policy produtos_incluir on public.produtos
  for insert to authenticated with check (public.usuario_ativo());
create policy produtos_alterar on public.produtos
  for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

create policy produto_precos_ver on public.produto_precos
  for select to authenticated using (public.usuario_ativo());
create policy produto_precos_incluir on public.produto_precos
  for insert to authenticated with check (public.usuario_ativo());
create policy produto_precos_alterar on public.produto_precos
  for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
-- Tirar o preço de uma loja = o produto deixa de ser vendido lá
create policy produto_precos_tirar on public.produto_precos
  for delete to authenticated using (public.usuario_ativo());

grant select, insert, update on public.produtos to authenticated;
grant select, insert, update, delete on public.produto_precos to authenticated;
