-- Migration 005_functions.sql
-- Funções PostgreSQL otimizadas para performance no front-end
--
-- Estas funções substituem consultas O(N) que carregam todos os registros
-- para agrupamento no JavaScript. Aqui o GROUP BY roda nativamente no banco.

-- ═══════════════════════════════════════════════════════════
-- 1. get_monthly_summary()
-- Retorna agrupamento mensal com contagem por tipo de relatório
-- Usado pelo Dashboard para o gráfico de barras e tabela de cobertura
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_monthly_summary()
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


-- ═══════════════════════════════════════════════════════════
-- 2. get_filter_options(report_type text)
-- Retorna valores DISTINCT para preencher selects de filtro
-- Substitui 3 full table scans separados
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_filter_options(report_type text default null)
returns jsonb
language plpgsql
security invoker
stable
as $$
declare
  result jsonb;
  v_campanhas text[];
  v_filas text[];
  v_usuarios text[];
begin
  -- Campanhas distintas
  if report_type is not null then
    select array_agg(distinct campanha)
    into v_campanhas
    from public.cetesb_eventos
    where tipo_relatorio = report_type
      and campanha is not null;
  else
    select array_agg(distinct campanha)
    into v_campanhas
    from public.cetesb_eventos
    where campanha is not null;
  end if;

  -- Filas distintas
  if report_type is not null then
    select array_agg(distinct fila)
    into v_filas
    from public.cetesb_eventos
    where tipo_relatorio = report_type
      and fila is not null;
  else
    select array_agg(distinct fila)
    into v_filas
    from public.cetesb_eventos
    where fila is not null;
  end if;

  -- Usuários distintos (apenas para Atendimento, não para URA)
  if report_type is null or report_type != 'URA' then
    if report_type is not null then
      select array_agg(distinct usuario)
      into v_usuarios
      from public.cetesb_eventos
      where tipo_relatorio = report_type
        and usuario is not null
        and usuario != '-';
    else
      select array_agg(distinct usuario)
      into v_usuarios
      from public.cetesb_eventos
      where usuario is not null
        and usuario != '-';
    end if;
  else
    v_usuarios := array[]::text[];
  end if;

  result := jsonb_build_object(
    'campanhas', coalesce(to_jsonb(v_campanhas), '[]'::jsonb),
    'filas', coalesce(to_jsonb(v_filas), '[]'::jsonb),
    'usuarios', coalesce(to_jsonb(v_usuarios), '[]'::jsonb)
  );

  return result;
end;
$$;
