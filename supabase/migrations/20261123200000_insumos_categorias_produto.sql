-- =====================================================================
-- Gran Sabor · categorias de produto e insumos (matéria-prima) no banco
-- Separa o que se VENDE (produtos, cardápio do caixa) do que se COMPRA
-- (insumos: matéria-prima, bebida de revenda, embalagem, limpeza, gás...).
--
-- categorias_produto: Bebidas, Carnes, Hortifrúti... com código próprio
--   (1, 2, 3...; sequência separada das categorias financeiras), uso
--   (venda · compra · ambos) e "revisada" para a Fernanda conferir.
--   Renomear leva o nome novo para todos os produtos e insumos dela.
-- insumos: código automático e sequencial (I0001, I0002...), bloqueado;
--   categoria financeira obrigatória (o XML divide o contas a pagar por ela);
--   controla_estoque escolhe quem entra no estoque (despesa normalmente não).
-- insumo_codigos: código de barras / código de cada fornecedor (marca) → um
--   insumo interno, para o XML achar o insumo e rastrear quem fornece.
-- Nada se apaga: inativa-se ("Ativo"). Dados reais entram pela tela.
-- =====================================================================

/* ---------- Categorias de produto ---------- */
create table public.categorias_produto (
  id              uuid primary key default gen_random_uuid(),
  codigo          smallint not null unique check (codigo between 1 and 9999),
  nome            text not null check (length(trim(nome)) between 1 and 60),
  uso             text not null default 'venda' check (uso in ('venda', 'compra', 'ambos')),
  revisada        boolean not null default false,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid()
);
create unique index categorias_produto_nome on public.categorias_produto (lower(trim(nome)));
comment on table public.categorias_produto is 'Categorias de produto (venda) e de insumo (compra); código sequencial próprio; revisada = conferida pela Fernanda';

-- Código automático (o último + 1) e que nunca muda
create or replace function public.categoria_produto_codigo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('categorias_produto.codigo'));
    select coalesce(max(codigo), 0) + 1 into new.codigo from public.categorias_produto;
  elsif new.codigo <> old.codigo then
    raise exception 'O código da categoria não muda.' using errcode = 'P0001';
  end if;
  new.nome := trim(new.nome);
  return new;
end;
$$;
create trigger categorias_produto_codigo before insert or update of codigo, nome on public.categorias_produto
  for each row execute function public.categoria_produto_codigo();
create trigger categorias_produto_atualizacao before update on public.categorias_produto
  for each row execute function public.marcar_atualizacao();

-- As categorias que já existem nos produtos (vindas da Saipos) viram categorias de venda, por ordem alfabética
insert into public.categorias_produto (codigo, nome, uso)
select 0, categoria, 'venda' from (select distinct trim(categoria) categoria from public.produtos) x order by categoria;

-- Categorias de compra mais comuns (genéricas; a Fernanda revisa, renomeia ou inativa)
insert into public.categorias_produto (codigo, nome, uso)
select 0, n, 'compra' from unnest(array['Carnes', 'Hortifrúti', 'Mercearia', 'Bebidas', 'Embalagens', 'Gás', 'Limpeza']) with ordinality t(n, o)
 where not exists (select 1 from public.categorias_produto c where lower(c.nome) = lower(t.n))
 order by o;
-- Bebida é comprada e vendida
update public.categorias_produto set uso = 'ambos' where lower(nome) = 'bebidas' and uso = 'venda';

/* ---------- Produto de venda ligado à categoria ---------- */
alter table public.produtos add column categoria_produto_id uuid references public.categorias_produto (id);
alter table public.produtos add column controla_estoque boolean not null default false;
comment on column public.produtos.controla_estoque is 'Produto de revenda que entra no estoque (ex.: bebida em lata); o normal é o estoque ser do insumo';
update public.produtos p set categoria_produto_id = c.id from public.categorias_produto c where lower(c.nome) = lower(trim(p.categoria));
create index produtos_categoria_produto on public.produtos (categoria_produto_id);

/* ---------- Insumos (o que se compra) ---------- */
create table public.insumos (
  id                       uuid primary key default gen_random_uuid(),
  codigo                   text not null unique,
  nome                     text not null check (length(trim(nome)) between 1 and 80),
  categoria_produto_id     uuid not null references public.categorias_produto (id),
  categoria                text not null default '',
  unidade                  text not null default 'kg' check (unidade in ('kg', 'g', 'l', 'ml', 'un', 'cx', 'pct', 'fd')),
  categoria_financeira_id  uuid not null references public.categorias_financeiras (id),
  controla_estoque         boolean not null default true,
  custo_medio              numeric(14, 4) not null default 0 check (custo_medio >= 0),
  estoque_minimo           numeric(14, 3) not null default 0 check (estoque_minimo >= 0),
  ncm                      text check (ncm is null or ncm ~ '^[0-9]{0,8}$'),
  ativo                    boolean not null default true,
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now(),
  atualizado_por           uuid references auth.users (id) default auth.uid()
);
create unique index insumos_nome on public.insumos (lower(trim(nome)));
comment on table public.insumos is 'Insumos e matéria-prima (o que se compra); código automático I0001...; custo médio vem das notas de entrada';

-- Código automático (I + sequência), nunca muda
create or replace function public.insumo_codigo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('insumos.codigo'));
    select 'I' || lpad((coalesce(max(substr(codigo, 2)::int), 0) + 1)::text, 4, '0') into new.codigo
      from public.insumos where codigo ~ '^I[0-9]+$';
  elsif new.codigo <> old.codigo then
    raise exception 'O código do insumo não muda.' using errcode = 'P0001';
  end if;
  new.nome := trim(new.nome);
  return new;
end;
$$;
create trigger insumos_codigo before insert or update of codigo, nome on public.insumos
  for each row execute function public.insumo_codigo();
create trigger insumos_atualizacao before update on public.insumos
  for each row execute function public.marcar_atualizacao();


/* ---------- Códigos de cada fornecedor → um insumo interno ----------
   O mesmo arroz (I0006) vem de vários fornecedores e marcas, cada um com o seu código de barras (EAN)
   e o seu código na nota (cProd). Cada linha liga um desses códigos ao insumo interno: a leitura do XML
   acha o insumo pelo código de barras ou pelo CNPJ + código do fornecedor, e o histórico mostra
   quem fornece cada insumo. fator = quantas unidades de estoque vêm em 1 unidade da nota (fardo 10 × 1 kg = 10). */
create table public.insumo_codigos (
  id                 uuid primary key default gen_random_uuid(),
  insumo_id          uuid not null references public.insumos (id),
  fornecedor_cnpj    text check (fornecedor_cnpj is null or fornecedor_cnpj ~ '^[0-9]{14}$'),
  fornecedor_nome    text not null check (length(trim(fornecedor_nome)) between 1 and 120),
  codigo_barras      text check (codigo_barras is null or codigo_barras ~ '^[0-9]{8,14}$'),
  codigo_fornecedor  text check (codigo_fornecedor is null or length(trim(codigo_fornecedor)) between 1 and 60),
  descricao          text check (descricao is null or length(descricao) <= 120),
  marca              text check (marca is null or length(marca) <= 60),
  unidade_compra     text not null default 'un' check (length(trim(unidade_compra)) between 1 and 10),
  fator              numeric(14, 4) not null default 1 check (fator > 0),
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references auth.users (id) default auth.uid(),
  check (codigo_barras is not null or codigo_fornecedor is not null)
);
comment on table public.insumo_codigos is 'Código de barras / código do fornecedor (marca) ligado ao insumo interno; o XML acha o insumo por aqui';
-- Um código de barras (ou código de um fornecedor) aponta para um insumo só
create unique index insumo_codigos_barras on public.insumo_codigos (codigo_barras) where ativo and codigo_barras is not null;
create unique index insumo_codigos_fornecedor on public.insumo_codigos (coalesce(fornecedor_cnpj, lower(trim(fornecedor_nome))), lower(trim(codigo_fornecedor)))
  where ativo and codigo_fornecedor is not null;
create index insumo_codigos_insumo on public.insumo_codigos (insumo_id);
create trigger insumo_codigos_atualizacao before update on public.insumo_codigos
  for each row execute function public.marcar_atualizacao();

/* ---------- Categoria (texto) sempre igual à do cadastro ----------
   Produto: quem manda só o texto (importação da Saipos) acha a categoria pelo nome ou cria uma nova
   (uso venda, ainda não revisada). Insumo: categoria_produto_id é obrigatória. */
create or replace function public.item_na_categoria()
returns trigger language plpgsql set search_path = '' as $$
declare c public.categorias_produto;
begin
  if new.categoria_produto_id is null or (tg_op = 'UPDATE' and new.categoria is distinct from old.categoria
                                           and new.categoria_produto_id is not distinct from old.categoria_produto_id) then
    if coalesce(trim(new.categoria), '') = '' then
      raise exception 'Escolha a categoria.' using errcode = 'P0001';
    end if;
    select * into c from public.categorias_produto where lower(nome) = lower(trim(new.categoria));
    if not found then
      insert into public.categorias_produto (codigo, nome, uso)
      values (0, trim(new.categoria), case when tg_table_name = 'insumos' then 'compra' else 'venda' end)
      returning * into c;
    end if;
    new.categoria_produto_id := c.id;
  else
    select * into c from public.categorias_produto where id = new.categoria_produto_id;
  end if;
  new.categoria := c.nome;
  return new;
end;
$$;
create trigger produtos_categoria before insert or update of categoria, categoria_produto_id on public.produtos
  for each row execute function public.item_na_categoria();
create trigger insumos_categoria before insert or update of categoria, categoria_produto_id on public.insumos
  for each row execute function public.item_na_categoria();

-- Renomear a categoria leva o nome novo para todos os produtos e insumos dela
create or replace function public.categoria_produto_renomeada()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.nome <> old.nome then
    update public.produtos set categoria = new.nome where categoria_produto_id = new.id;
    update public.insumos set categoria = new.nome where categoria_produto_id = new.id;
  end if;
  return new;
end;
$$;
create trigger categorias_produto_renomeada after update of nome on public.categorias_produto
  for each row execute function public.categoria_produto_renomeada();

/* ---------- Ao vivo, acesso e nada de apagar ---------- */
create trigger categorias_produto_versao after insert or update or delete on public.categorias_produto
  for each statement execute function public.subir_versao();
create trigger insumos_versao after insert or update or delete on public.insumos
  for each statement execute function public.subir_versao();
create trigger insumo_codigos_versao after insert or update or delete on public.insumo_codigos
  for each statement execute function public.subir_versao();
insert into public.dados_versao (tabela) values ('categorias_produto'), ('insumos'), ('insumo_codigos') on conflict (tabela) do nothing;

alter table public.categorias_produto enable row level security;
alter table public.insumos enable row level security;
alter table public.insumo_codigos enable row level security;
create policy categorias_produto_ver on public.categorias_produto for select to authenticated using (public.usuario_ativo());
create policy categorias_produto_incluir on public.categorias_produto for insert to authenticated with check (public.usuario_ativo());
create policy categorias_produto_alterar on public.categorias_produto for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy insumos_ver on public.insumos for select to authenticated using (public.usuario_ativo());
create policy insumos_incluir on public.insumos for insert to authenticated with check (public.usuario_ativo());
create policy insumos_alterar on public.insumos for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy insumo_codigos_ver on public.insumo_codigos for select to authenticated using (public.usuario_ativo());
create policy insumo_codigos_incluir on public.insumo_codigos for insert to authenticated with check (public.usuario_ativo());
create policy insumo_codigos_alterar on public.insumo_codigos for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
grant select, insert, update on public.categorias_produto, public.insumos, public.insumo_codigos to authenticated;
revoke delete on public.categorias_produto, public.insumos, public.insumo_codigos, public.produtos from authenticated, anon;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.categorias_produto, public.insumos, public.insumo_codigos;
  end if;
end;
$$;
