-- =====================================================================
-- Gran Sabor · unidades (lojas, central de carnes, escritório)
-- Cada unidade é um estabelecimento: tem o próprio CNPJ (matriz ou filial)
-- e inscrição estadual, porque a NFC-e é emitida por estabelecimento.
-- Unidades com a mesma raiz de CNPJ (8 primeiros caracteres) são da mesma empresa.
-- CNPJ aceita o formato novo alfanumérico (Receita, a partir de jul/2026).
-- Não se apaga unidade: desativa (ativo = false).
-- =====================================================================

-- Carimbo de alteração, reaproveitado pelas próximas tabelas
create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

create table public.unidades (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique check (codigo ~ '^[a-z0-9_]{2,20}$'),
  nome                text not null check (length(trim(nome)) between 2 and 60),
  tipo                text not null check (tipo in ('loja', 'central', 'escritorio')),
  ordem               smallint not null default 0,
  ativo               boolean not null default true,
  -- Fiscal
  cnpj                text check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  razao_social        text,
  nome_fantasia       text,
  inscricao_estadual  text,
  inscricao_municipal text,
  regime_tributario   text check (regime_tributario in ('simples', 'presumido', 'real')),
  -- Endereço
  cep                 text check (cep ~ '^[0-9]{8}$'),
  logradouro          text,
  numero              text,
  complemento         text,
  bairro              text,
  cidade              text,
  uf                  text check (uf ~ '^[A-Z]{2}$'),
  -- Contato
  telefone            text,
  email               text,
  -- Controle
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid references auth.users (id) default auth.uid()
);
comment on table public.unidades is 'Lojas, central de carnes e escritório da Gran Sabor (um estabelecimento por linha)';

create trigger unidades_atualizacao
  before update on public.unidades
  for each row execute function public.marcar_atualizacao();

alter table public.unidades enable row level security;

create policy unidades_ver on public.unidades
  for select to authenticated using (public.usuario_ativo());
create policy unidades_incluir on public.unidades
  for insert to authenticated with check (public.usuario_ativo());
create policy unidades_alterar on public.unidades
  for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

grant select, insert, update on public.unidades to authenticated;

-- As 5 unidades já conhecidas, só com nome (dados fiscais são preenchidos na tela)
insert into public.unidades (codigo, nome, tipo, ordem) values
  ('loja1',      'Loja 1',            'loja',       1),
  ('loja2',      'Loja 2',            'loja',       2),
  ('loja3',      'Loja 3',            'loja',       3),
  ('central',    'Central de carnes', 'central',    4),
  ('escritorio', 'Escritório',        'escritorio', 5)
on conflict (codigo) do nothing;
