-- =====================================================================
-- Gran Sabor · financeiro no banco
-- categorias financeiras, contas bancárias, contas a pagar, contas a receber
-- e extrato bancário (com conciliação).
--
-- Tudo ao vivo: cada tabela, ao ser gravada, sobe a "versão" dela em
-- dados_versao (uma linha por tabela, um aviso por gravação, mesmo que a
-- gravação tenha milhares de linhas). As telas abertas escutam dados_versao
-- pelo Supabase Realtime e releem só o que mudou.
--
-- Os dados reais (fluxo de caixa, extrato) entram pela tela (botões
-- "Importar"), nunca por aqui: o repositório é público.
-- A empresa de cada lançamento vem da unidade (lojas, central, escritório).
-- =====================================================================

/* ---------- Versão de cada tabela (o "sino" das telas ao vivo) ---------- */
create table public.dados_versao (
  tabela         text primary key,
  versao         bigint not null default 0,
  atualizado_em  timestamptz not null default now()
);
comment on table public.dados_versao is 'Uma linha por tabela: sobe a cada gravação; as telas escutam pelo Realtime e releem a tabela';

create or replace function public.subir_versao()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.dados_versao as v (tabela, versao, atualizado_em)
  values (tg_table_name, 1, now())
  on conflict (tabela) do update set versao = v.versao + 1, atualizado_em = now();
  return null;
end;
$$;
revoke all on function public.subir_versao() from public, anon, authenticated;

alter table public.dados_versao enable row level security;
create policy dados_versao_ver on public.dados_versao
  for select to authenticated using (public.usuario_ativo());
grant select on public.dados_versao to authenticated;

/* ---------- Categorias financeiras ---------- */
-- grupo: bloco do fluxo de caixa (CMV, Folha de pagamento, Despesas fixas...)
-- dre: linha do resultado gerencial onde a categoria soma
create table public.categorias_financeiras (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique check (codigo ~ '^[0-9]{1,2}\.[0-9]{2,3}$'),
  nome            text not null check (length(trim(nome)) between 1 and 80),
  grupo           text not null default 'Outros' check (length(trim(grupo)) between 1 and 60),
  tipo            text not null check (tipo in ('receita', 'despesa')),
  dre             text not null default 'Administrativas' check (length(trim(dre)) between 1 and 40),
  natureza        text not null default 'variavel' check (natureza in ('fixa', 'variavel')),
  ativo           boolean not null default true,
  origem          text not null default 'tela' check (origem in ('tela', 'fluxo')),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  unique (tipo, grupo, nome)
);
comment on table public.categorias_financeiras is 'Plano de contas gerencial: usado em contas a pagar, a receber e no resultado (DRE)';

/* ---------- Contas bancárias (e caixas) ---------- */
-- unidade vazia = conta usada por mais de uma unidade (ex.: conta do grupo)
create table public.contas_bancarias (
  id                uuid primary key default gen_random_uuid(),
  apelido           text not null unique check (length(trim(apelido)) between 2 and 40),
  tipo              text not null default 'corrente' check (tipo in ('corrente', 'poupanca', 'caixa', 'maquininha', 'aplicacao')),
  banco             text,
  agencia           text,
  conta             text,
  titular           text,
  unidade_id        uuid references public.unidades (id),
  saldo_inicial     numeric(14, 2) not null default 0,
  saldo_inicial_em  date,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references auth.users (id) default auth.uid()
);
comment on table public.contas_bancarias is 'Contas bancárias, caixas e maquininhas: de onde sai e para onde entra o dinheiro';

/* ---------- Contas a pagar ---------- */
create table public.contas_pagar (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         uuid not null references public.unidades (id),
  categoria_id       uuid references public.categorias_financeiras (id),
  favorecido         text not null default '' check (length(favorecido) <= 120),
  documento          text not null default '' check (length(documento) <= 60),
  valor              numeric(14, 2) not null check (valor > 0),
  vencimento         date not null,
  pago_em            date,
  valor_pago         numeric(14, 2) check (valor_pago >= 0),
  forma              text not null default '',
  conta_bancaria_id  uuid references public.contas_bancarias (id),
  obs                text not null default '',
  origem             text not null default 'tela' check (origem in ('tela', 'fluxo', 'xml', 'folha')),
  chave_importacao   text unique,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references auth.users (id) default auth.uid(),
  check ((pago_em is null) = (valor_pago is null))
);
comment on table public.contas_pagar is 'Contas a pagar por unidade (a empresa vem da unidade). Vindas do fluxo de caixa já entram pagas no dia';
comment on column public.contas_pagar.chave_importacao is 'Identifica a linha importada (planilha, XML) para importar de novo sem duplicar';
create index contas_pagar_vencimento on public.contas_pagar (vencimento);
create index contas_pagar_atualizado on public.contas_pagar (atualizado_em);
create index contas_pagar_unidade on public.contas_pagar (unidade_id);

/* ---------- Contas a receber ---------- */
-- valor = a receber; valor_recebido = o que entrou. valor_vendido = venda que gerou o
-- recebimento (vazio quando a origem só traz o recebido, como o fluxo de caixa antigo).
create table public.contas_receber (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         uuid not null references public.unidades (id),
  categoria_id       uuid references public.categorias_financeiras (id),
  cliente            text not null default '' check (length(cliente) <= 120),
  documento          text not null default '' check (length(documento) <= 60),
  forma              text not null default '',
  valor_vendido      numeric(14, 2) check (valor_vendido >= 0),
  valor              numeric(14, 2) not null check (valor > 0),
  vencimento         date not null,
  recebido_em        date,
  valor_recebido     numeric(14, 2) check (valor_recebido >= 0),
  conta_bancaria_id  uuid references public.contas_bancarias (id),
  obs                text not null default '',
  origem             text not null default 'tela' check (origem in ('tela', 'fluxo', 'pdv', 'pj')),
  chave_importacao   text unique,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references auth.users (id) default auth.uid(),
  check ((recebido_em is null) = (valor_recebido is null))
);
comment on table public.contas_receber is 'Contas a receber por unidade; do fluxo de caixa vem só o recebido por dia e forma (sem o vendido)';
create index contas_receber_vencimento on public.contas_receber (vencimento);
create index contas_receber_atualizado on public.contas_receber (atualizado_em);
create index contas_receber_unidade on public.contas_receber (unidade_id);

/* ---------- Extrato bancário ---------- */
-- valor: positivo = entrada (crédito), negativo = saída (débito). saldo = saldo após a linha.
-- ordem: posição da linha dentro do dia, como veio do banco (é ela que fecha o saldo, não a hora).
-- Conciliar = ligar a linha a uma conta a pagar (saída) ou a receber (entrada).
create table public.extrato_lancamentos (
  id                 uuid primary key default gen_random_uuid(),
  conta_bancaria_id  uuid not null references public.contas_bancarias (id),
  data               date not null,
  hora               time,
  documento          text not null default '',
  historico          text not null default '',
  favorecido         text not null default '',
  cpf_cnpj           text not null default '',
  valor              numeric(14, 2) not null check (valor <> 0),
  saldo              numeric(14, 2),
  ordem              integer not null default 0,
  chave              text not null,
  conta_pagar_id     uuid references public.contas_pagar (id) on delete set null,
  conta_receber_id   uuid references public.contas_receber (id) on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references auth.users (id) default auth.uid(),
  unique (conta_bancaria_id, chave),
  check (conta_pagar_id is null or conta_receber_id is null),
  check (conta_pagar_id is null or valor < 0),
  check (conta_receber_id is null or valor > 0)
);
comment on table public.extrato_lancamentos is 'Linhas do extrato bancário importado (OFX ou CSV), com a conciliação';
create index extrato_conta_data on public.extrato_lancamentos (conta_bancaria_id, data);
-- Uma conta a pagar/receber só pode estar ligada a uma linha do extrato
create unique index extrato_um_pagar on public.extrato_lancamentos (conta_pagar_id) where conta_pagar_id is not null;
create unique index extrato_um_receber on public.extrato_lancamentos (conta_receber_id) where conta_receber_id is not null;

/* ---------- Carimbo de alteração e versão (ao vivo) ---------- */
create trigger categorias_financeiras_atualizacao before update on public.categorias_financeiras
  for each row execute function public.marcar_atualizacao();
create trigger contas_bancarias_atualizacao before update on public.contas_bancarias
  for each row execute function public.marcar_atualizacao();
create trigger contas_pagar_atualizacao before update on public.contas_pagar
  for each row execute function public.marcar_atualizacao();
create trigger contas_receber_atualizacao before update on public.contas_receber
  for each row execute function public.marcar_atualizacao();
create trigger extrato_lancamentos_atualizacao before update on public.extrato_lancamentos
  for each row execute function public.marcar_atualizacao();

create trigger categorias_financeiras_versao after insert or update or delete on public.categorias_financeiras
  for each statement execute function public.subir_versao();
create trigger contas_bancarias_versao after insert or update or delete on public.contas_bancarias
  for each statement execute function public.subir_versao();
create trigger contas_pagar_versao after insert or update or delete on public.contas_pagar
  for each statement execute function public.subir_versao();
create trigger contas_receber_versao after insert or update or delete on public.contas_receber
  for each statement execute function public.subir_versao();
create trigger extrato_lancamentos_versao after insert or update or delete on public.extrato_lancamentos
  for each statement execute function public.subir_versao();

insert into public.dados_versao (tabela) values
  ('categorias_financeiras'), ('contas_bancarias'), ('contas_pagar'), ('contas_receber'), ('extrato_lancamentos')
on conflict (tabela) do nothing;

/* ---------- Acesso: só usuário cadastrado e ativo ---------- */
alter table public.categorias_financeiras enable row level security;
alter table public.contas_bancarias enable row level security;
alter table public.contas_pagar enable row level security;
alter table public.contas_receber enable row level security;
alter table public.extrato_lancamentos enable row level security;

create policy categorias_financeiras_ver on public.categorias_financeiras for select to authenticated using (public.usuario_ativo());
create policy categorias_financeiras_incluir on public.categorias_financeiras for insert to authenticated with check (public.usuario_ativo());
create policy categorias_financeiras_alterar on public.categorias_financeiras for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

create policy contas_bancarias_ver on public.contas_bancarias for select to authenticated using (public.usuario_ativo());
create policy contas_bancarias_incluir on public.contas_bancarias for insert to authenticated with check (public.usuario_ativo());
create policy contas_bancarias_alterar on public.contas_bancarias for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

create policy contas_pagar_ver on public.contas_pagar for select to authenticated using (public.usuario_ativo());
create policy contas_pagar_incluir on public.contas_pagar for insert to authenticated with check (public.usuario_ativo());
create policy contas_pagar_alterar on public.contas_pagar for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

create policy contas_receber_ver on public.contas_receber for select to authenticated using (public.usuario_ativo());
create policy contas_receber_incluir on public.contas_receber for insert to authenticated with check (public.usuario_ativo());
create policy contas_receber_alterar on public.contas_receber for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

create policy extrato_ver on public.extrato_lancamentos for select to authenticated using (public.usuario_ativo());
create policy extrato_incluir on public.extrato_lancamentos for insert to authenticated with check (public.usuario_ativo());
create policy extrato_alterar on public.extrato_lancamentos for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
-- Extrato importado na conta errada: dá para apagar as linhas ainda não conciliadas
create policy extrato_apagar on public.extrato_lancamentos for delete to authenticated
  using (public.usuario_ativo() and conta_pagar_id is null and conta_receber_id is null);

grant select, insert, update on public.categorias_financeiras, public.contas_bancarias, public.contas_pagar, public.contas_receber to authenticated;
grant select, insert, update, delete on public.extrato_lancamentos to authenticated;

/* ---------- Realtime: as telas escutam a versão das tabelas ---------- */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.dados_versao;
  end if;
end;
$$;
