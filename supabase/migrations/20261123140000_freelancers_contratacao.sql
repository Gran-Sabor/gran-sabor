-- =====================================================================
-- Gran Sabor · contratação e controle de freelancers
--
-- freelancers     + ficha de contratação: documentos conferidos, termo de
--                   prestação de serviço assinado, bloqueio (não chamar mais)
-- freela_diarias  + avaliação do dia (1 a 5) e horário que de fato trabalhou
-- gerar_pagamento_freela(...)  gera UMA conta a pagar para uma ou mais
--                   diárias de uma vez (tudo ou nada): confere se cada diária
--                   ainda é a mesma que a pessoa viu, se trabalhou e se não tem
--                   conta. Se algo mudou, não grava nada.
--
-- Tabelas já estão no ao vivo (dados_versao + gatilho subir_versao) desde a
-- migração da escala; aqui só entram colunas e a função.
-- =====================================================================

/* ---------- Ficha de contratação ---------- */
alter table public.freelancers
  add column if not exists doc_identidade    boolean not null default false,   -- documento com foto conferido
  add column if not exists doc_endereco      boolean not null default false,   -- comprovante de endereço conferido
  add column if not exists termo_assinado_em date,                              -- termo de prestação de serviço autônomo
  add column if not exists bloqueado         boolean not null default false,
  add column if not exists motivo_bloqueio   text not null default '' check (length(motivo_bloqueio) <= 200);
comment on column public.freelancers.bloqueado is 'Bloqueado: não aparece para nova diária (motivo obrigatório na tela)';
comment on column public.freelancers.termo_assinado_em is 'Data do termo de prestação de serviço autônomo assinado (sem vínculo de emprego)';

/* ---------- Controle do dia ---------- */
alter table public.freela_diarias
  add column if not exists avaliacao     smallint check (avaliacao between 1 and 5),
  add column if not exists entrada_real  time,
  add column if not exists saida_real    time;
comment on column public.freela_diarias.avaliacao is 'Nota do dia (1 a 5) dada pela unidade; média aparece no cadastro do freelancer';

-- Mais de uma diária pode apontar para a mesma conta a pagar (pagamento junto da semana)
create index if not exists freela_diarias_conta on public.freela_diarias (conta_pagar_id);
create index if not exists freela_diarias_freelancer on public.freela_diarias (freelancer_id, data);

/* ---------- Pagamento: uma conta a pagar para várias diárias, tudo ou nada ---------- */
-- p_diarias e p_fotos andam juntos: p_fotos[i] = atualizado_em da diária p_diarias[i] que a tela mostrou.
-- Todas precisam ser do mesmo freelancer e da mesma unidade (a conta é de uma unidade).
create or replace function public.gerar_pagamento_freela(
  p_diarias uuid[], p_fotos timestamptz[], p_vencimento date, p_categoria uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n int; v_fl uuid; v_un uuid; v_total numeric(14, 2); v_conta uuid := gen_random_uuid();
  v_nome text; v_pix text; v_datas text;
begin
  if not public.usuario_ativo() then raise exception 'Usuário sem acesso'; end if;
  if p_diarias is null or cardinality(p_diarias) = 0 or cardinality(p_diarias) <> cardinality(p_fotos) then
    raise exception 'Lista de diárias inválida';
  end if;
  if p_vencimento is null then raise exception 'Informe o vencimento'; end if;

  -- trava as diárias até o fim (duas telas gerando ao mesmo tempo: a segunda espera e encontra a conta)
  perform 1 from public.freela_diarias where id = any (p_diarias) for update;

  select count(*), min(freelancer_id::text)::uuid, min(unidade_id::text)::uuid, sum(valor)
    into v_n, v_fl, v_un, v_total
    from public.freela_diarias d
    join unnest(p_diarias, p_fotos) as f(id, foto) on f.id = d.id
   where d.atualizado_em = f.foto and d.situacao = 'trabalhou' and d.conta_pagar_id is null and d.valor > 0;
  if v_n <> cardinality(p_diarias) then
    raise exception 'DIARIA_MUDOU' using hint = 'Uma ou mais diárias mudaram em outra tela, já têm pagamento ou não estão como "trabalhou".';
  end if;
  if (select count(distinct freelancer_id) from public.freela_diarias where id = any (p_diarias)) > 1
     or (select count(distinct unidade_id) from public.freela_diarias where id = any (p_diarias)) > 1 then
    raise exception 'Junte só diárias do mesmo freelancer e da mesma unidade';
  end if;

  select nome, pix into v_nome, v_pix from public.freelancers where id = v_fl;
  select string_agg(to_char(data, 'DD/MM'), ', ' order by data) into v_datas from public.freela_diarias where id = any (p_diarias);

  insert into public.contas_pagar (id, unidade_id, categoria_id, favorecido, documento, valor, vencimento, obs, origem, chave_importacao)
  values (v_conta, v_un, p_categoria, left('Freelancer · ' || v_nome, 120),
          left(case when v_n = 1 then 'Diária ' else v_n || ' diárias ' end || v_datas, 60),
          v_total, p_vencimento,
          left(v_nome || case when v_pix <> '' then ' · Pix ' || v_pix else '' end || ' · ' || v_datas, 500),
          'freela', 'freela:' || v_conta);

  update public.freela_diarias set conta_pagar_id = v_conta where id = any (p_diarias);
  return v_conta;
end;
$$;
revoke all on function public.gerar_pagamento_freela(uuid[], timestamptz[], date, uuid) from public, anon;
grant execute on function public.gerar_pagamento_freela(uuid[], timestamptz[], date, uuid) to authenticated;
comment on function public.gerar_pagamento_freela is 'Gera uma conta a pagar (origem freela) para diárias trabalhadas do mesmo freelancer e unidade; tudo ou nada';
