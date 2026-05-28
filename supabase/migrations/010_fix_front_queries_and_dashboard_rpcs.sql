-- Migration 010_fix_front_queries_and_dashboard_rpcs.sql
-- Ajusta as views de front-end para retornar nomes técnicos em minúsculas (evita erros 42703 e wildcard spaces).
-- Cria/atualiza todas as funções RPC otimizadas de estatísticas de dashboard e filtros.
-- Garante permissões adequadas (Grants) para a role authenticated.

-- 1. View para Atendimentos Operação (Nome de colunas em minúsculas)
create or replace view public.vw_cetesb_atendimentos_operacao_front
with (security_invoker = true)
as
select
    campanha,
    fila,
    coalesce(usuario, '-') as usuario,
    numero_telefone,
    sessao_iniciada,
    duracao_fila_segundos,
    duracao_fala_segundos,
    descricao_resultado,
    resultado_usuario
from public.cetesb_eventos
where tipo_relatorio = 'ATENDIMENTO_OPERACAO';

-- 2. View para URA CETESB (Nome de colunas em minúsculas)
create or replace view public.vw_cetesb_ura_front
with (security_invoker = true)
as
select
    campanha,
    fila,
    numero_telefone,
    sessao_iniciada,
    duracao_fila_segundos,
    duracao_fala_segundos,
    resultado_name as resultado_nome,
    descricao_resultado
from public.cetesb_eventos
where tipo_relatorio = 'URA';

-- 3. Função RPC get_dashboard_totals()
create or replace function public.get_dashboard_totals()
returns table(
  total_registros bigint,
  total_atendimentos bigint,
  total_ura bigint,
  primeira_data timestamp,
  ultima_data timestamp
)
language sql
security invoker
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

-- 4. Função RPC get_dashboard_source_summary()
create or replace function public.get_dashboard_source_summary()
returns table(
  fonte_exibicao text,
  total bigint
)
language sql
security invoker
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

-- 5. Função RPC get_dashboard_monthly_summary()
create or replace function public.get_dashboard_monthly_summary()
returns table(
  ano int,
  mes int,
  tipo text,
  total bigint
)
language sql
security invoker
stable
as $$
  select
    ano,
    mes,
    tipo_relatorio as tipo,
    count(*) as total
  from public.cetesb_eventos
  group by ano, mes, tipo_relatorio
  order by ano, mes;
$$;

-- 6. Concessão de permissões de leitura e execução (Grants)
grant select on public.vw_cetesb_atendimentos_operacao_front to authenticated;
grant select on public.vw_cetesb_ura_front to authenticated;

grant execute on function public.get_dashboard_totals to authenticated;
grant execute on function public.get_dashboard_source_summary to authenticated;
grant execute on function public.get_dashboard_monthly_summary to authenticated;
grant execute on function public.get_filter_options to authenticated;
