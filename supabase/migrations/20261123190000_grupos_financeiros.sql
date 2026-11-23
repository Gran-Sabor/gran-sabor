/* =====================================================================
   Grupos financeiros (cadastro próprio): o grupo é o número antes do
   ponto no código da categoria (4 = Folha de pagamento → 4.07 Férias).
   - Renomear o grupo: todas as categorias dele mudam junto (o nome do
     grupo na categoria é mantido pelo gatilho, nunca digitado à mão).
   - Código automático e sequencial: categoria nova (ou trocada de grupo)
     ganha o último código do grupo + 1. Os lançamentos apontam para a categoria (id), então
     contas a pagar/receber, resumos e DRE acompanham sozinhos.
   - Categoria nova sem grupo escolhido (importação do fluxo, da DRE):
     o grupo vem do número do código; se não existir, é criado.
   ===================================================================== */
create table public.grupos_financeiros (
  id              uuid primary key default gen_random_uuid(),
  numero          smallint not null unique check (numero between 1 and 99),
  nome            text not null unique check (length(trim(nome)) between 1 and 60),
  dre             text not null default 'Despesas' check (length(trim(dre)) between 1 and 40),
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid()
);
comment on table public.grupos_financeiros is 'Grupos das categorias financeiras (número = prefixo do código); dre = linha padrão das categorias novas';

-- Grupos que já existem nas categorias (o nome mais usado em cada número)
insert into public.grupos_financeiros (numero, nome, dre)
select distinct on (n) n, grupo, dre
  from (select split_part(codigo, '.', 1)::smallint n, grupo, dre, count(*) over (partition by split_part(codigo, '.', 1), grupo) q
          from public.categorias_financeiras) x
 order by n, q desc, grupo
on conflict do nothing;

alter table public.categorias_financeiras add column grupo_id uuid references public.grupos_financeiros (id);
update public.categorias_financeiras c set grupo_id = g.id, grupo = g.nome
  from public.grupos_financeiros g where g.numero = split_part(c.codigo, '.', 1)::smallint;

-- Mantém categoria ↔ grupo coerentes (grupo_id, nome do grupo e prefixo do código)
create or replace function public.categoria_no_grupo()
returns trigger language plpgsql set search_path = '' as $$
declare g public.grupos_financeiros; n smallint; s int;
begin
  if new.grupo_id is null then
    if coalesce(new.codigo, '') = '' then
      raise exception 'Escolha o grupo da categoria.' using errcode = 'P0001';
    end if;
    n := split_part(new.codigo, '.', 1)::smallint;
    select * into g from public.grupos_financeiros where numero = n;
    if not found then
      insert into public.grupos_financeiros (numero, nome, dre) values (n, coalesce(nullif(trim(new.grupo), ''), 'Grupo ' || n), new.dre)
      returning * into g;
    end if;
    new.grupo_id := g.id;
  else
    select * into g from public.grupos_financeiros where id = new.grupo_id;
  end if;
  new.grupo := g.nome;
  -- código automático e sequencial: sem código, ou mudou de grupo → o último do grupo + 1
  if coalesce(new.codigo, '') = '' or split_part(new.codigo, '.', 1)::smallint <> g.numero then
    select coalesce(max(split_part(codigo, '.', 2)::int), 0) + 1 into s
      from public.categorias_financeiras where split_part(codigo, '.', 1)::smallint = g.numero and id <> new.id;
    new.codigo := g.numero || '.' || lpad(s::text, 2, '0');
  end if;
  return new;
end;
$$;
create trigger categorias_financeiras_grupo before insert or update of grupo_id, codigo, grupo on public.categorias_financeiras
  for each row execute function public.categoria_no_grupo();

-- Renomear o grupo leva o nome novo para todas as categorias dele
create or replace function public.grupo_renomeado()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.nome <> old.nome then
    update public.categorias_financeiras set grupo = new.nome where grupo_id = new.id;
  end if;
  if new.numero <> old.numero then
    raise exception 'O número do grupo não muda (ele é o começo do código das categorias). Crie um grupo novo e mova as categorias.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger grupos_financeiros_atualizacao before update on public.grupos_financeiros
  for each row execute function public.marcar_atualizacao();
create trigger grupos_financeiros_renomear after update on public.grupos_financeiros
  for each row execute function public.grupo_renomeado();
create trigger grupos_financeiros_versao after insert or update or delete on public.grupos_financeiros
  for each statement execute function public.subir_versao();
insert into public.dados_versao (tabela) values ('grupos_financeiros') on conflict (tabela) do nothing;

alter table public.grupos_financeiros enable row level security;
create policy grupos_financeiros_ver on public.grupos_financeiros for select to authenticated using (public.usuario_ativo());
create policy grupos_financeiros_incluir on public.grupos_financeiros for insert to authenticated with check (public.usuario_ativo());
create policy grupos_financeiros_alterar on public.grupos_financeiros for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
grant select, insert, update on public.grupos_financeiros to authenticated;

-- Realtime: as telas escutam dados_versao (já publicada); a tabela entra também, pelo padrão do projeto
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.grupos_financeiros;
  end if;
end;
$$;

-- Categoria e grupo não se apagam (sem permissão de exclusão): desativa-se ("Ativa"/"Ativo")
revoke delete on public.categorias_financeiras, public.grupos_financeiros from authenticated, anon;
