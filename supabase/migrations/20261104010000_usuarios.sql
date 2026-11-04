-- =====================================================================
-- Gran Sabor · usuários do sistema
-- Quem pode entrar: só quem está nesta tabela com ativo = true.
-- O usuário é criado pelo painel do Supabase (Authentication › Users ›
-- Add user); o cadastro público fica DESLIGADO. Ao criar o usuário,
-- a linha aqui nasce sozinha (gatilho abaixo).
-- Toda tabela futura usa public.usuario_ativo() nas suas regras (RLS).
-- =====================================================================

create table public.usuarios (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  nome       text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
comment on table public.usuarios is 'Pessoas que podem entrar no sistema Gran Sabor';

alter table public.usuarios enable row level security;

-- Está logado e ativo? (base das regras de todas as tabelas)
create or replace function public.usuario_ativo()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.usuarios u where u.id = auth.uid() and u.ativo);
$$;
revoke all on function public.usuario_ativo() from public, anon;
grant execute on function public.usuario_ativo() to authenticated;

-- Regras: o usuário sempre vê a própria linha (para o sistema saber se está ativo);
-- quem está ativo vê a lista. Alterar usuários fica para a tela de Usuários.
create policy usuarios_ver_o_proprio on public.usuarios
  for select to authenticated using (id = auth.uid());
create policy usuarios_ativos_veem_todos on public.usuarios
  for select to authenticated using (public.usuario_ativo());

grant select on public.usuarios to authenticated;

-- Novo usuário no Supabase → nova linha em usuarios
create or replace function public.novo_usuario()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.novo_usuario() from public, anon, authenticated;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.novo_usuario();

-- Usuários criados antes desta migração
insert into public.usuarios (id, email, nome)
select id, email, coalesce(raw_user_meta_data ->> 'nome', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;
