-- =====================================================================
-- Gran Sabor · colaboradores, escala, faltas e freelancers
--
-- colaboradores         cadastro dos funcionários (a empresa vem da unidade)
-- escala_turnos         turnos de trabalho (M, T, I, C...): entrada, saída, intervalo
-- escala_funcionamento  horário de abertura e fechamento de cada unidade por dia da semana
--                       e o mínimo de pessoas ao mesmo tempo
-- escala_padrao         folgas de cada colaborador (folga fixa, domingo alternado, ciclo 5x1, 12x36...)
-- escala_dias           exceção de um dia: troca de turno, folga, falta, atestado, falta abonada,
--                       trabalho em outra unidade. A falta desconta na folha (sem lançar de novo).
-- feriados              feriados (nacionais já entram; municipais pela tela)
-- freelancers           cadastro de freelancers (diaristas)
-- freela_diarias        cada diária: unidade, dia, horário, quem cobre, valor e a conta a pagar gerada
--
-- Tudo ao vivo: cada tabela sobe a versão em dados_versao a cada gravação e as
-- telas abertas releem pelo Supabase Realtime. Nenhum dado de pessoa aqui:
-- o repositório é público. Os colaboradores entram pela tela.
-- =====================================================================

/* ---------- Colaboradores ---------- */
create table public.colaboradores (
  id              uuid primary key default gen_random_uuid(),
  matricula       text not null unique check (matricula ~ '^[0-9]{1,6}$'),
  nome            text not null check (length(trim(nome)) between 2 and 80),
  cpf             text check (cpf ~ '^[0-9]{11}$'),
  cargo           text not null default 'atendente' check (length(trim(cargo)) between 1 and 40),
  unidade_id      uuid not null references public.unidades (id),
  admissao        date,                                   -- vazia = ainda não informada (folha conta o mês cheio)
  aniversario     text check (aniversario ~ '^[0-3][0-9]/[01][0-9]$'),   -- dd/mm
  demissao        date,
  salario         numeric(12, 2) not null default 0 check (salario >= 0),
  vt              numeric(8, 2) not null default 0 check (vt >= 0),
  optante_vt      boolean not null default false,
  dependentes     smallint not null default 0 check (dependentes between 0 and 20),
  turno           text not null default 'M' check (turno ~ '^[A-Z]{1,3}$'),
  situacao        text not null default 'ativo' check (situacao in ('ativo', 'ferias', 'afastado', 'desligado')),
  pix             text not null default '' check (length(pix) <= 80),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  check (demissao is null or admissao is null or demissao >= admissao)
);
comment on table public.colaboradores is 'Funcionários: alimentam escala, folha, adiantamento, 13º, férias e PDV (consumo). Não se apaga: desliga';

/* ---------- Turnos ---------- */
create table public.escala_turnos (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique check (codigo ~ '^[A-Z]{1,3}$' and codigo not in ('F', 'FA', 'AT', 'AB')),
  nome            text not null check (length(trim(nome)) between 2 and 30),
  entrada         time not null,
  saida           time not null,
  intervalo_min   smallint not null default 60 check (intervalo_min between 0 and 240),
  ordem           smallint not null default 0,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid()
);
comment on table public.escala_turnos is 'Turnos da escala; saída menor que a entrada = passa da meia-noite';

-- Turnos de partida (horários ajustáveis na tela Configuração da escala)
insert into public.escala_turnos (codigo, nome, entrada, saida, intervalo_min, ordem) values
  ('M', 'Manhã',         '06:00', '14:20', 60, 1),
  ('I', 'Intermediário', '10:00', '18:20', 60, 2),
  ('T', 'Tarde',         '14:00', '22:20', 60, 3),
  ('C', 'Comercial',     '08:00', '17:48', 60, 4)
on conflict (codigo) do nothing;

/* ---------- Funcionamento de cada unidade ---------- */
create table public.escala_funcionamento (
  id              uuid primary key default gen_random_uuid(),
  unidade_id      uuid not null references public.unidades (id),
  dia_semana      smallint not null check (dia_semana between 0 and 6),   -- 0 = domingo
  aberta          boolean not null default true,
  abre            time,
  fecha           time,
  minimo          smallint not null default 1 check (minimo between 0 and 50),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  unique (unidade_id, dia_semana),
  check (not aberta or (abre is not null and fecha is not null))
);
comment on table public.escala_funcionamento is 'Abertura, fechamento e mínimo de pessoas de cada unidade por dia da semana';

/* ---------- Padrão de folgas de cada colaborador ---------- */
-- semanal: folgas = dias fixos (1 = seg ... 6 = sáb) + regra do domingo
-- ciclo:   trabalha N dias, folga M (5x1, 4x2, 12x36 = 1x1), contando de um dia de folga (ciclo_ref)
create table public.escala_padrao (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null unique references public.colaboradores (id) on delete cascade,
  regime          text not null default 'semanal' check (regime in ('semanal', 'ciclo')),
  folgas          smallint[] not null default '{}',
  domingo         text not null default 'folga' check (domingo in ('folga', 'trabalha', 'alternado', 'dois_um')),
  domingo_ref     date,
  ciclo_trabalho  smallint check (ciclo_trabalho between 1 and 13),
  ciclo_folga     smallint check (ciclo_folga between 1 and 6),
  ciclo_ref       date,
  turno_sabado    text check (turno_sabado ~ '^[A-Z]{1,3}$'),
  turno_domingo   text check (turno_domingo ~ '^[A-Z]{1,3}$'),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  check (folgas <@ array[1, 2, 3, 4, 5, 6]::smallint[]),
  check (domingo not in ('alternado', 'dois_um') or domingo_ref is not null),
  check (regime <> 'ciclo' or (ciclo_trabalho is not null and ciclo_folga is not null and ciclo_ref is not null))
);
comment on table public.escala_padrao is 'Regra de folgas de cada colaborador; o turno padrão fica no cadastro do colaborador';

/* ---------- Exceções do dia (troca, folga, falta, atestado) ---------- */
create table public.escala_dias (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores (id) on delete cascade,
  data            date not null,
  tipo            text not null check (tipo in ('turno', 'folga', 'falta', 'atestado', 'abonada')),
  turno           text check (turno ~ '^[A-Z]{1,3}$'),
  unidade_id      uuid references public.unidades (id),   -- trabalhou em outra unidade (vazio = a dele)
  obs             text not null default '' check (length(obs) <= 200),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid(),
  unique (colaborador_id, data),
  check (tipo <> 'turno' or turno is not null)
);
comment on table public.escala_dias is 'Exceções da escala por dia. falta = desconta dia + DSR na folha; atestado e abonada não descontam';
create index escala_dias_data on public.escala_dias (data);

/* ---------- Feriados ---------- */
create table public.feriados (
  id              uuid primary key default gen_random_uuid(),
  data            date not null unique,
  nome            text not null check (length(trim(nome)) between 2 and 60),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid()
);
comment on table public.feriados is 'Feriados: trabalho no feriado vira hora extra 100% ou folga compensatória';

-- Feriados nacionais (municipais e estaduais entram pela tela)
insert into public.feriados (data, nome) values
  ('2026-11-15', 'Proclamação da República'), ('2026-11-20', 'Consciência Negra'), ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Confraternização Universal'), ('2027-03-26', 'Sexta-feira Santa'), ('2027-04-21', 'Tiradentes'),
  ('2027-05-01', 'Dia do Trabalho'), ('2027-09-07', 'Independência'), ('2027-10-12', 'Nossa Senhora Aparecida'),
  ('2027-11-02', 'Finados'), ('2027-11-15', 'Proclamação da República'), ('2027-11-20', 'Consciência Negra'),
  ('2027-12-25', 'Natal')
on conflict (data) do nothing;

/* ---------- Freelancers ---------- */
create table public.freelancers (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) between 2 and 80),
  cpf             text check (cpf ~ '^[0-9]{11}$'),
  telefone        text not null default '' check (length(telefone) <= 20),
  pix             text not null default '' check (length(pix) <= 80),
  funcao          text not null default '' check (length(funcao) <= 40),
  diaria          numeric(10, 2) not null default 0 check (diaria >= 0),
  ativo           boolean not null default true,
  obs             text not null default '' check (length(obs) <= 200),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) default auth.uid()
);
comment on table public.freelancers is 'Diaristas chamados para cobrir falta, folga, férias ou movimento alto';

create table public.freela_diarias (
  id                    uuid primary key default gen_random_uuid(),
  freelancer_id         uuid not null references public.freelancers (id),
  unidade_id            uuid not null references public.unidades (id),
  data                  date not null,
  entrada               time not null,
  saida                 time not null,
  funcao                text not null default '' check (length(funcao) <= 40),
  motivo                text not null default 'demanda' check (motivo in ('falta', 'folga', 'ferias', 'demanda', 'evento', 'outro')),
  cobre_colaborador_id  uuid references public.colaboradores (id),
  valor                 numeric(10, 2) not null default 0 check (valor >= 0),
  situacao              text not null default 'combinada' check (situacao in ('combinada', 'trabalhou', 'nao_veio', 'cancelada')),
  conta_pagar_id        uuid references public.contas_pagar (id) on delete set null,
  obs                   text not null default '' check (length(obs) <= 200),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  atualizado_por        uuid references auth.users (id) default auth.uid(),
  check (conta_pagar_id is null or situacao = 'trabalhou')
);
comment on table public.freela_diarias is 'Diárias de freelancer; o pagamento vira conta a pagar (origem freela)';
create index freela_diarias_data on public.freela_diarias (data);

-- Conta a pagar gerada pela diária do freelancer
alter table public.contas_pagar drop constraint if exists contas_pagar_origem_check;
alter table public.contas_pagar add constraint contas_pagar_origem_check
  check (origem in ('tela', 'fluxo', 'xml', 'folha', 'freela'));

/* ---------- Carimbo de alteração e versão (ao vivo) ---------- */
do $$
declare t text;
begin
  foreach t in array array['colaboradores', 'escala_turnos', 'escala_funcionamento', 'escala_padrao', 'escala_dias',
                           'feriados', 'freelancers', 'freela_diarias'] loop
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

-- Apagar: só o que não deixa rastro de pagamento (colaborador e freelancer não se apagam: desativa)
create policy escala_dias_apagar on public.escala_dias for delete to authenticated using (public.usuario_ativo());
create policy escala_padrao_apagar on public.escala_padrao for delete to authenticated using (public.usuario_ativo());
create policy escala_turnos_apagar on public.escala_turnos for delete to authenticated using (public.usuario_ativo());
create policy feriados_apagar on public.feriados for delete to authenticated using (public.usuario_ativo());
create policy freela_diarias_apagar on public.freela_diarias for delete to authenticated
  using (public.usuario_ativo() and conta_pagar_id is null);
grant delete on public.escala_dias, public.escala_padrao, public.escala_turnos, public.feriados, public.freela_diarias to authenticated;
