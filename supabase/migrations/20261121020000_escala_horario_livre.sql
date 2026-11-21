-- =====================================================================
-- Gran Sabor · escala com horário livre
-- Além dos turnos (M, T, I, C), entrada e saída podem ser digitadas:
--   escala_padrao: horário próprio do colaborador (vale nos dias de trabalho)
--   escala_dias:   horário de um dia só (troca, hora diferente, "outro horário")
-- =====================================================================
alter table public.escala_padrao add column entrada time, add column saida time;
alter table public.escala_padrao add constraint escala_padrao_horario_check
  check ((entrada is null) = (saida is null) and (entrada is null or entrada <> saida));

alter table public.escala_dias add column entrada time, add column saida time;

-- A regra antiga exigia turno no dia de trabalho; agora basta turno OU entrada e saída
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.escala_dias'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%turno IS NOT NULL%' loop
    execute format('alter table public.escala_dias drop constraint %I', r.conname);
  end loop;
end;
$$;
alter table public.escala_dias add constraint escala_dias_trabalho_check
  check (tipo <> 'turno' or turno is not null or (entrada is not null and saida is not null));
alter table public.escala_dias add constraint escala_dias_horario_check
  check ((entrada is null) = (saida is null) and (entrada is null or entrada <> saida));
