-- =====================================================================
-- Gran Sabor · férias e contrato de experiência (com avisos de prazo)
--
-- ferias                 cada férias programada: período aquisitivo, início, dias,
--                        abono, dia em que o aviso foi entregue ao colaborador
--                        (a lei pede 30 dias antes) e a conta a pagar do recibo
--                        (paga até 2 dias antes do início).
-- contratos_experiencia  um por colaborador: início, 1º período e prorrogação
--                        (45+45, 30+60, 90...; no máximo 90 dias no total),
--                        termo de prorrogação assinado e a decisão
--                        (efetivado ou encerrado) com a data.
--
-- Os prazos (vencimento das férias, aviso, pagamento, fim da experiência)
-- são calculados na tela (assets/js/prazos-rh.js) a partir destas tabelas e
-- do cadastro do colaborador: nada de data congelada.
-- Tudo ao vivo: cada tabela sobe a versão em dados_versao a cada gravação e
-- entra na publicação supabase_realtime. Nenhum dado de pessoa aqui.
-- =====================================================================

/* ---------- Férias ---------- */
create table public.ferias (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores (id),
  aquisitivo      date not null,                          -- início do período aquisitivo
  inicio          date not null,
  dias            smallint not null check (dias between 5 and 30),
  abono           boolean not null default false,         -- vendeu 10 dias
  aviso_em        date,                                   -- aviso de férias entregue ao colaborador
  conta_pagar_id  uuid references public.contas_pagar (id) on delete set null,
  obs             text not null default '' check (length(obs) <= 200),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  check (inicio >= aquisitivo)
);
comment on table public.ferias is 'Férias programadas e gozadas; a escala marca os dias sozinha e o recibo vira conta a pagar (chave ferias:<id>)';
create index ferias_colaborador on public.ferias (colaborador_id, inicio);

/* ---------- Contrato de experiência ---------- */
create table public.contratos_experiencia (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null unique references public.colaboradores (id),
  inicio          date not null,                          -- normalmente a admissão
  dias_1          smallint not null default 45 check (dias_1 between 1 and 90),
  dias_2          smallint not null default 45 check (dias_2 between 0 and 89),
  prorrogado_em   date,                                   -- termo de prorrogação assinado
  situacao        text not null default 'vigente' check (situacao in ('vigente', 'efetivado', 'encerrado')),
  decidido_em     date,                                   -- efetivado em / último dia (encerrado)
  obs             text not null default '' check (length(obs) <= 200),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  check (dias_1 + dias_2 <= 90),
  check (situacao = 'vigente' or decidido_em is not null),
  check (prorrogado_em is null or dias_2 > 0)
);
comment on table public.contratos_experiencia is 'Contrato de experiência (até 90 dias, uma prorrogação). Sem linha: a tela supõe 45+45 desde a admissão';

/* ---------- Carimbo, versão, RLS e políticas ---------- */
do $$
declare t text;
begin
  foreach t in array array['ferias', 'contratos_experiencia'] loop
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

-- Cancelar férias: só enquanto o recibo não foi pago
create policy ferias_apagar on public.ferias for delete to authenticated
  using (public.usuario_ativo() and (conta_pagar_id is null
         or exists (select 1 from public.contas_pagar p where p.id = conta_pagar_id and p.pago_em is null)));
create policy contratos_experiencia_apagar on public.contratos_experiencia for delete to authenticated using (public.usuario_ativo());
grant delete on public.ferias, public.contratos_experiencia to authenticated;

-- A conta a pagar do recibo de férias some junto com o cancelamento (só se não foi paga).
-- Nenhuma outra conta a pagar pode ser apagada por aqui.
create policy contas_pagar_apagar_ferias on public.contas_pagar for delete to authenticated
  using (public.usuario_ativo() and pago_em is null and origem = 'folha' and chave_importacao like 'ferias:%');
grant delete on public.contas_pagar to authenticated;

/* ---------- Realtime ---------- */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ferias, public.contratos_experiencia;
  end if;
end;
$$;
