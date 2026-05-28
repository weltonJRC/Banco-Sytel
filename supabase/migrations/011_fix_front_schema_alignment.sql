-- Migration 011_fix_front_schema_alignment.sql
-- Garante o alinhamento completo entre as views de front-end, RPCs e nomes de colunas técnicos.
-- Esta migration descarta as views com nomes visuais (acentos/espaços/hifens) e as recria com nomenclatura técnica minúscula para evitar erros 42703 e timeouts 57014.

-- ═══════════════════════════════════════════════════════════
-- 1. DROP DAS VIEWS ANTERIORES E CRIAÇÃO DAS NOVAS VIEWS
-- ═══════════════════════════════════════════════════════════

drop view if exists public.vw_cetesb_atendimentos_operacao_front cascade;
create or replace view public.vw_cetesb_atendimentos_operacao_front
with (security_invoker = true)
as
select
    id,
    campanha,
    fila,
    coalesce(usuario, '-') as usuario,
    numero_telefone,
    sessao_iniciada,
    duracao_fila_segundos,
    duracao_fala_segundos,
    descricao_resultado,
    resultado_usuario,
    fonte_oficial,
    fonte_oficial as fonte_exibicao,
    status_validacao,
    ano,
    mes
from public.cetesb_eventos
where tipo_relatorio = 'ATENDIMENTO_OPERACAO';

drop view if exists public.vw_cetesb_ura_front cascade;
create or replace view public.vw_cetesb_ura_front
with (security_invoker = true)
as
select
    id,
    campanha,
    fila,
    numero_telefone,
    sessao_iniciada,
    duracao_fila_segundos,
    duracao_fala_segundos,
    resultado_name as resultado_nome,
    descricao_resultado,
    fonte_oficial,
    fonte_oficial as fonte_exibicao,
    status_validacao,
    ano,
    mes
from public.cetesb_eventos
where tipo_relatorio = 'URA';

-- ═══════════════════════════════════════════════════════════
-- 2. RECRIAÇÃO E OTIMIZAÇÃO DAS RPCS DO DASHBOARD (Security Definer para Performance)
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_dashboard_totals()
returns table(
  total_registros bigint,
  total_atendimentos bigint,
  total_ura bigint,
  primeira_data timestamp,
  ultima_data timestamp
)
language sql
security definer
stable
as $$
  select
    count(*) as total_registros,
    count(*) filter (where tipo_relatorio = 'ATENDIMENTO_OPERACAO') as total_atendimentos,
    count(*) filter (where tipo_relatorio = 'URA') as total_ura,
    min(sessao_iniciada) as primeira_data,
    max(sessao_iniciada) as ultima_data
  from public.cetesb_eventos;
$$;

create or replace function public.get_dashboard_source_summary()
returns table(
  fonte_exibicao text,
  total bigint
)
language sql
security definer
stable
as $$
  select
    case
      when fonte_oficial = 'EXCEL_2025' then 'CETESB 2025 - URA/Atendimento'
      when fonte_oficial = 'SYTEL_2026' then 'CETESB 2026 - Atendimento'
      else fonte_oficial
    end as fonte_exibicao,
    count(*) as total
  from public.cetesb_eventos
  group by fonte_oficial;
$$;

create or replace function public.get_dashboard_monthly_summary()
returns table(
  ano int,
  mes int,
  atendimentos bigint,
  ura bigint,
  total bigint
)
language sql
security definer
stable
as $$
  select
    ano,
    mes,
    count(*) filter (where tipo_relatorio = 'ATENDIMENTO_OPERACAO') as atendimentos,
    count(*) filter (where tipo_relatorio = 'URA') as ura,
    count(*) as total
  from public.cetesb_eventos
  group by ano, mes
  order by ano, mes;
$$;

-- ═══════════════════════════════════════════════════════════
-- 3. RECRIAÇÃO E OTIMIZAÇÃO DA RPC DE FILTROS (Security Definer para Evitar timeouts 57014)
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_filter_options(report_type text default null)
returns jsonb
language plpgsql
security definer
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

-- ═══════════════════════════════════════════════════════════
-- 4. CONCESSÃO DE PERMISSÕES (GRANTS)
-- ═══════════════════════════════════════════════════════════

grant usage on schema public to authenticated;

grant select on public.vw_cetesb_atendimentos_operacao_front to authenticated;
grant select on public.vw_cetesb_ura_front to authenticated;

grant execute on function public.get_dashboard_totals() to authenticated;
grant execute on function public.get_dashboard_source_summary() to authenticated;
grant execute on function public.get_dashboard_monthly_summary() to authenticated;
grant execute on function public.get_filter_options(text) to authenticated;
