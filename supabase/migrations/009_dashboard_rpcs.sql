-- Migration 009_dashboard_rpcs.sql
-- Cria a função get_dashboard_monthly_summary() para suportar relatórios mensais no dashboard sem parâmetros.
-- Ela mapeia diretamente a agregação por ano, mes e tipo_relatorio de forma performática.

create or replace function public.get_dashboard_monthly_summary()
returns table(ano int, mes int, tipo text, total bigint)
language sql
security invoker
stable
as $$
  select
    e.ano,
    e.mes,
    e.tipo_relatorio as tipo,
    count(*) as total
  from public.cetesb_eventos e
  group by e.ano, e.mes, e.tipo_relatorio
  order by e.ano, e.mes;
$$;
