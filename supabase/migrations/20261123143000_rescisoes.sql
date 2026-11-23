-- =====================================================================
-- Gran Sabor · rescisões (desligamento de colaborador)
--
-- rescisoes   um desligamento registrado: tipo (sem justa causa, pedido de
--             demissão, justa causa, acordo, fim da experiência), aviso
--             prévio, datas e o saldo do FGTS informado.
--
-- Só as ESCOLHAS ficam aqui. As verbas (saldo de salário, aviso, 13º,
-- férias, INSS, IRRF, FGTS e multa) são calculadas na hora pela regra única
-- (assets/js/rescisao.js), a partir do cadastro, dos lançamentos e da escala.
-- O valor a pagar mora nas contas a pagar geradas no registro.
--
-- Registrar é uma ação só (função registrar_rescisao), tudo ou nada:
--   1. confere se o cadastro do colaborador é o mesmo que a tela viu;
--   2. marca o colaborador como desligado, com a data de saída
--      (sai da folha e da escala na hora);
--   3. grava a rescisão e gera as contas a pagar: líquido ao colaborador e
--      guia do FGTS (depósito do mês + multa), com vencimento em 10 dias.
-- Desfazer (desfazer_rescisao) só enquanto nenhuma das contas foi paga.
--
-- Ao vivo: gatilho subir_versao + linha em dados_versao. Nenhum dado de
-- pessoa aqui: o repositório é público.
-- =====================================================================

create table public.rescisoes (
  id               uuid primary key default gen_random_uuid(),
  colaborador_id   uuid not null references public.colaboradores (id),
  tipo             text not null check (tipo in ('sem_justa_causa', 'pedido_demissao', 'justa_causa', 'acordo', 'fim_experiencia')),
  aviso            text not null default 'indenizado' check (aviso in ('indenizado', 'trabalhado', 'dispensado', 'descontado', 'nao_se_aplica')),
  data_aviso       date not null,
  data_saida       date not null,
  saldo_fgts       numeric(14, 2) check (saldo_fgts >= 0),
  conta_pagar_id   uuid references public.contas_pagar (id),
  conta_fgts_id    uuid references public.contas_pagar (id),
  obs              text not null default '' check (length(obs) <= 500),
  criado_em        timestamptz not null default now(),
  criado_por       uuid references auth.users (id) default auth.uid(),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references auth.users (id) default auth.uid(),
  check (data_saida >= data_aviso)
);
comment on table public.rescisoes is 'Desligamentos registrados; as verbas são recalculadas pela regra única, o valor pago mora nas contas a pagar';
comment on column public.rescisoes.saldo_fgts is 'Saldo do FGTS para fins rescisórios (extrato da Caixa). Vazio = a tela estima';
-- Um desligamento por colaborador: dois computadores registrando ao mesmo tempo, o segundo é barrado
create unique index rescisoes_um_por_colaborador on public.rescisoes (colaborador_id);
create index rescisoes_atualizado_em on public.rescisoes (atualizado_em);

/* ---------- Carimbo de alteração e versão (ao vivo) ---------- */
create trigger rescisoes_atualizacao before update on public.rescisoes
  for each row execute function public.marcar_atualizacao();
create trigger rescisoes_versao after insert or update or delete on public.rescisoes
  for each statement execute function public.subir_versao();
insert into public.dados_versao (tabela) values ('rescisoes') on conflict (tabela) do nothing;

/* ---------- Acesso: só usuário cadastrado e ativo (apagar só pela função desfazer) ---------- */
alter table public.rescisoes enable row level security;
create policy rescisoes_ver on public.rescisoes for select to authenticated using (public.usuario_ativo());
create policy rescisoes_incluir on public.rescisoes for insert to authenticated with check (public.usuario_ativo());
create policy rescisoes_alterar on public.rescisoes for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
grant select, insert, update on public.rescisoes to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rescisoes;
  end if;
end;
$$;

/* ---------- Registrar: tudo ou nada ---------- */
create or replace function public.registrar_rescisao(
  p_colaborador   uuid,
  p_visto_em      timestamptz,      -- atualizado_em do colaborador que a tela viu
  p_tipo          text,
  p_aviso         text,
  p_data_aviso    date,
  p_data_saida    date,
  p_saldo_fgts    numeric,
  p_obs           text,
  p_liquido       numeric,          -- líquido ao colaborador (calculado pela regra única)
  p_guia_fgts     numeric,          -- FGTS do mês + aviso + 13º + multa
  p_categoria     uuid,
  p_favorecido    text,
  p_vencimento    date
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_unidade uuid;
  v_id uuid := gen_random_uuid();
  v_conta uuid;
  v_fgts uuid;
begin
  if not public.usuario_ativo() then raise exception 'Sem permissão.'; end if;

  update public.colaboradores
     set situacao = 'desligado', demissao = p_data_saida
   where id = p_colaborador and atualizado_em = p_visto_em and situacao <> 'desligado'
  returning unidade_id into v_unidade;
  if v_unidade is null then
    raise exception 'O cadastro deste colaborador mudou em outra tela (ou ele já foi desligado). Nada foi gravado: confira e tente de novo.'
      using errcode = 'P0001';
  end if;

  insert into public.rescisoes (id, colaborador_id, tipo, aviso, data_aviso, data_saida, saldo_fgts, obs)
  values (v_id, p_colaborador, p_tipo, p_aviso, p_data_aviso, p_data_saida, p_saldo_fgts, coalesce(p_obs, ''));

  if p_liquido > 0 then
    insert into public.contas_pagar (unidade_id, categoria_id, favorecido, documento, valor, vencimento, obs, origem, chave_importacao)
    values (v_unidade, p_categoria, left(p_favorecido, 120), 'Rescisão (TRCT)', p_liquido, p_vencimento,
            'Líquido da rescisão. Gerado pela tela Rescisão.', 'folha', 'rescisao:' || v_id)
    returning id into v_conta;
  end if;
  if p_guia_fgts > 0 then
    insert into public.contas_pagar (unidade_id, categoria_id, favorecido, documento, valor, vencimento, obs, origem, chave_importacao)
    values (v_unidade, p_categoria, 'FGTS rescisório', 'Guia FGTS · rescisão', p_guia_fgts, p_vencimento,
            left('FGTS do mês, do aviso e do 13º + multa. ' || p_favorecido, 500), 'folha', 'rescisao-fgts:' || v_id)
    returning id into v_fgts;
  end if;
  update public.rescisoes set conta_pagar_id = v_conta, conta_fgts_id = v_fgts where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.registrar_rescisao(uuid, timestamptz, text, text, date, date, numeric, text, numeric, numeric, uuid, text, date) from public, anon;
grant execute on function public.registrar_rescisao(uuid, timestamptz, text, text, date, date, numeric, text, numeric, numeric, uuid, text, date) to authenticated;

/* ---------- Desfazer: só enquanto nada foi pago ---------- */
-- Roda como dono porque as contas a pagar não se apagam pela tela; aqui só as desta rescisão, e só se não pagas.
create or replace function public.desfazer_rescisao(p_id uuid, p_visto_em timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.rescisoes;
begin
  if not public.usuario_ativo() then raise exception 'Sem permissão.'; end if;
  select * into r from public.rescisoes where id = p_id and atualizado_em = p_visto_em for update;
  if not found then raise exception 'Esta rescisão mudou em outra tela. Nada foi desfeito: confira.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.contas_pagar where id in (r.conta_pagar_id, r.conta_fgts_id) and pago_em is not null) then
    raise exception 'Uma das contas desta rescisão já foi paga. Não dá para desfazer: a diferença vira acerto.' using errcode = 'P0001';
  end if;
  delete from public.rescisoes where id = p_id;
  delete from public.contas_pagar where id in (r.conta_pagar_id, r.conta_fgts_id);
  update public.colaboradores set situacao = 'ativo', demissao = null where id = r.colaborador_id;
end;
$$;
revoke all on function public.desfazer_rescisao(uuid, timestamptz) from public, anon;
grant execute on function public.desfazer_rescisao(uuid, timestamptz) to authenticated;
