-- =====================================================================
-- Gran Sabor · eventos da folha e holerites do contador
--
-- eventos_folha        cadastro de eventos (os códigos da folha do contador:
--                      001 salário, 024 hora extra 50%, 770 INSS...). Cada
--                      evento diz se é provento, desconto ou informativo, as
--                      incidências e a categoria financeira (DRE). Não se
--                      apaga: inativa. "revisado" marca o que já foi conferido.
-- holerites_contador   cada holerite da "Folha de Pagamento Analítica" do
--                      contador (PDF), um por pessoa, competência e tipo
--                      (mensal, adiantamento, férias, 13º, rescisão). Guarda os
--                      totais, as bases e todos os itens (jsonb) para o
--                      histórico e o comparativo mês a mês. Importar de novo o
--                      mesmo mês substitui.
-- colaboradores        ganha a matrícula no contador e o CNPJ da empresa que
--                      registra (o holerite traz os dois).
--
-- Os dados entram pela tela (Folha e holerites › Importar holerites (PDF)):
-- nada de nome, salário ou CNPJ real aqui.
-- Tudo ao vivo: cada tabela sobe a versão em dados_versao a cada gravação e
-- entra na publicação supabase_realtime.
-- =====================================================================

/* ---------- Eventos da folha ---------- */
create table public.eventos_folha (
  id                      uuid primary key default gen_random_uuid(),
  codigo                  text not null unique check (codigo ~ '^[0-9]{3}$'),
  nome                    text not null check (length(trim(nome)) between 1 and 60),
  tipo                    text not null check (tipo in ('provento', 'desconto', 'informativo')),
  forma                   text not null default 'calculado' check (forma in ('fixo', 'horas', 'dias', 'valor', 'calculado')),
  inss                    boolean not null default false,
  fgts                    boolean not null default false,
  irrf                    boolean not null default false,
  categoria_financeira_id uuid references public.categorias_financeiras (id),
  origem                  text not null default 'contador' check (origem in ('contador', 'sistema')),
  revisado                boolean not null default false,   -- incidências e categoria conferidas
  ativo                   boolean not null default true,
  obs                     text not null default '' check (length(obs) <= 200),
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  atualizado_por          uuid references auth.users (id) default auth.uid()
);
comment on table public.eventos_folha is 'Eventos da folha (códigos do contador). Não se apaga: inativa';

/* ---------- Holerites do contador ---------- */
create table public.holerites_contador (
  id                  uuid primary key default gen_random_uuid(),
  competencia         date not null check (extract(day from competencia) = 1),   -- 1º dia do mês
  tipo                text not null check (tipo in ('mensal', 'adiantamento', 'ferias', 'decimo', 'rescisao', 'outro')),
  cnpj                text not null check (cnpj ~ '^[0-9]{14}$'),
  matricula_contador  text not null check (matricula_contador ~ '^[0-9]{1,10}$'),
  colaborador_id      uuid references public.colaboradores (id) on delete set null,
  nome                text not null check (length(trim(nome)) between 2 and 80),
  cargo               text not null default '' check (length(cargo) <= 60),
  admissao            date,
  salario             numeric(12, 2) not null default 0,
  horas_mes           numeric(6, 2),
  vencimentos         numeric(12, 2) not null default 0,
  descontos           numeric(12, 2) not null default 0,
  liquido             numeric(12, 2) not null default 0,
  base_inss           numeric(12, 2) not null default 0,
  valor_inss          numeric(12, 2) not null default 0,
  base_fgts           numeric(12, 2) not null default 0,
  valor_fgts          numeric(12, 2) not null default 0,
  base_irrf           numeric(12, 2) not null default 0,
  valor_irrf          numeric(12, 2) not null default 0,
  itens               jsonb not null default '[]' check (jsonb_typeof(itens) = 'array'),   -- [{codigo, nome, tipo, ref, valor}]
  obs                 text not null default '' check (length(obs) <= 500),                 -- férias, afastamento...
  arquivo             text not null default '' check (length(arquivo) <= 120),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid references auth.users (id) default auth.uid(),
  unique (cnpj, matricula_contador, competencia, tipo)
);
comment on table public.holerites_contador is 'Holerites da folha do contador (PDF importado pela tela): histórico e comparativo';
create index holerites_contador_colaborador on public.holerites_contador (colaborador_id, competencia);
create index holerites_contador_competencia on public.holerites_contador (competencia);

/* ---------- Colaborador: matrícula no contador e empresa que registra ---------- */
alter table public.colaboradores
  add column matricula_contador text check (matricula_contador ~ '^[0-9]{1,10}$'),
  add column empresa_cnpj text check (empresa_cnpj ~ '^[0-9]{14}$');
create unique index colaboradores_matricula_contador on public.colaboradores (empresa_cnpj, matricula_contador)
  where empresa_cnpj is not null and matricula_contador is not null;

/* ---------- Carimbo, versão, RLS e políticas ---------- */
do $$
declare t text;
begin
  foreach t in array array['eventos_folha', 'holerites_contador'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.marcar_atualizacao()', t || '_atualizacao', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each statement execute function public.subir_versao()', t || '_versao', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.usuario_ativo())', t || '_ver', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.usuario_ativo())', t || '_incluir', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo())', t || '_alterar', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    insert into public.dados_versao (tabela) values (t) on conflict (tabela) do nothing;
  end loop;
end;
$$;

-- Holerite importado errado (mês ou arquivo trocado): pode ser apagado e importado de novo
create policy holerites_contador_apagar on public.holerites_contador for delete to authenticated using (public.usuario_ativo());
grant delete on public.holerites_contador to authenticated;

/* ---------- Realtime ---------- */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.eventos_folha, public.holerites_contador;
  end if;
end;
$$;
