-- =====================================================================
-- Gran Sabor · categorias de produto em dois níveis: grupo principal › subgrupo
-- Ex.: Bebidas › Cervejas lata 350 ml, Bebidas › Refrigerantes 2 litros, Bebidas › Águas.
-- pai_id vazio = grupo principal; preenchido = subgrupo daquele grupo. Só dois níveis:
-- o pai precisa ser grupo principal, e quem já tem subgrupos não vira subgrupo.
-- O produto (ou insumo) continua ligado à categoria mais específica; relatórios somam
-- pelo grupo principal através do pai_id. A reorganização é feita pela tela (dado real).
-- =====================================================================

alter table public.categorias_produto add column pai_id uuid references public.categorias_produto (id);
alter table public.categorias_produto add constraint categorias_produto_pai_diferente check (pai_id is null or pai_id <> id);
create index categorias_produto_pai on public.categorias_produto (pai_id);
comment on column public.categorias_produto.pai_id is 'Grupo principal desta categoria (vazio = ela é um grupo principal)';

create or replace function public.categoria_produto_nivel()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pai_id is not null then
    if exists (select 1 from public.categorias_produto where id = new.pai_id and pai_id is not null) then
      raise exception 'O grupo principal escolhido já é um subgrupo. Escolha um grupo principal.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.categorias_produto where pai_id = new.id) then
      raise exception 'Esta categoria tem subgrupos: ela precisa continuar como grupo principal.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger categorias_produto_nivel before insert or update of pai_id on public.categorias_produto
  for each row execute function public.categoria_produto_nivel();
