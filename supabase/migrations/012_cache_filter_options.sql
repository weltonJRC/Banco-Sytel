-- Migration 012_cache_filter_options.sql
-- Otimiza drasticamente o tempo de resposta da obtenção de filtros únicos na tabela cetesb_eventos de 222k registros.
-- Cria uma tabela de cache dedicada e funções RPC de alto desempenho (Security Definer).

-- ═══════════════════════════════════════════════════════════
-- 1. CRIAÇÃO DA TABELA DE CACHE
-- ═══════════════════════════════════════════════════════════

create table if not exists public.cetesb_filter_options_cache (
  report_type text primary key,
  options jsonb not null,
  updated_at timestamp default now()
);

-- Habilita RLS na tabela de cache por segurança
alter table public.cetesb_filter_options_cache enable row level security;

-- Política de leitura para qualquer usuário autenticado
create policy "Usuarios autenticados leem o cache de filtros"
on public.cetesb_filter_options_cache
for select
to authenticated
using (true);

-- ═══════════════════════════════════════════════════════════
-- 2. CRIAÇÃO DA FUNÇÃO DE ATUALIZAÇÃO MANUAL (REFRESH) DO CACHE
-- ═══════════════════════════════════════════════════════════

create or replace function public.refresh_filter_options_cache()
returns void
language plpgsql
security definer
as $$
declare
  v_campanhas_at text[];
  v_filas_at text[];
  v_usuarios_at text[];
  
  v_campanhas_ura text[];
  v_filas_ura text[];
begin
  -- 1. Obter e cachear filtros únicos para ATENDIMENTO_OPERACAO
  select array_agg(distinct campanha order by campanha)
  into v_campanhas_at
  from public.cetesb_eventos
  where tipo_relatorio = 'ATENDIMENTO_OPERACAO' and campanha is not null;

  select array_agg(distinct fila order by fila)
  into v_filas_at
  from public.cetesb_eventos
  where tipo_relatorio = 'ATENDIMENTO_OPERACAO' and fila is not null;

  select array_agg(distinct usuario order by usuario)
  into v_usuarios_at
  from public.cetesb_eventos
  where tipo_relatorio = 'ATENDIMENTO_OPERACAO' and usuario is not null and usuario != '-';

  insert into public.cetesb_filter_options_cache (report_type, options, updated_at)
  values (
    'ATENDIMENTO_OPERACAO',
    jsonb_build_object(
      'campanhas', coalesce(to_jsonb(v_campanhas_at), '[]'::jsonb),
      'filas', coalesce(to_jsonb(v_filas_at), '[]'::jsonb),
      'usuarios', coalesce(to_jsonb(v_usuarios_at), '[]'::jsonb),
      'fontes', '["EXCEL_2025", "SYTEL_2026"]'::jsonb,
      'statuses', '["VALIDADO", "PENDENTE", "DIVERGENTE"]'::jsonb
    ),
    now()
  )
  on conflict (report_type) do update
  set options = excluded.options, updated_at = excluded.updated_at;

  -- 2. Obter e cachear filtros únicos para URA
  select array_agg(distinct campanha order by campanha)
  into v_campanhas_ura
  from public.cetesb_eventos
  where tipo_relatorio = 'URA' and campanha is not null;

  select array_agg(distinct fila order by fila)
  into v_filas_ura
  from public.cetesb_eventos
  where tipo_relatorio = 'URA' and fila is not null;

  insert into public.cetesb_filter_options_cache (report_type, options, updated_at)
  values (
    'URA',
    jsonb_build_object(
      'campanhas', coalesce(to_jsonb(v_campanhas_ura), '[]'::jsonb),
      'filas', coalesce(to_jsonb(v_filas_ura), '[]'::jsonb),
      'usuarios', '[]'::jsonb,
      'fontes', '["EXCEL_2025", "SYTEL_2026"]'::jsonb,
      'statuses', '["VALIDADO", "PENDENTE", "DIVERGENTE"]'::jsonb
    ),
    now()
  )
  on conflict (report_type) do update
  set options = excluded.options, updated_at = excluded.updated_at;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- 3. CRIAÇÃO DA RPC DE FILTROS RECONFIGURADA PARA CONSUMIR DO CACHE
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_filter_options(report_type text default null)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_options jsonb;
begin
  if report_type is not null then
    select options
    into v_options
    from public.cetesb_filter_options_cache
    where public.cetesb_filter_options_cache.report_type = $1;
  else
    -- Consolidação inteligente das opções (União) caso nenhum tipo de relatório seja especificado
    select jsonb_build_object(
      'campanhas', (select jsonb_agg(distinct x) from (select jsonb_array_elements_text(options->'campanhas') x from public.cetesb_filter_options_cache) t),
      'filas', (select jsonb_agg(distinct x) from (select jsonb_array_elements_text(options->'filas') x from public.cetesb_filter_options_cache) t),
      'usuarios', (select jsonb_agg(distinct x) from (select jsonb_array_elements_text(options->'usuarios') x from public.cetesb_filter_options_cache) t),
      'fontes', '["EXCEL_2025", "SYTEL_2026"]'::jsonb,
      'statuses', '["VALIDADO", "PENDENTE", "DIVERGENTE"]'::jsonb
    ) into v_options;
  end if;
  
  return coalesce(v_options, jsonb_build_object(
    'campanhas', '[]'::jsonb,
    'filas', '[]'::jsonb,
    'usuarios', '[]'::jsonb,
    'fontes', '["EXCEL_2025", "SYTEL_2026"]'::jsonb,
    'statuses', '["VALIDADO", "PENDENTE", "DIVERGENTE"]'::jsonb
  ));
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- 4. INICIALIZAÇÃO DO CACHE E GRANTS
-- ═══════════════════════════════════════════════════════════

-- Executa a primeira carga para popular a tabela de cache imediatamente
select public.refresh_filter_options_cache();

-- Garante as permissões de acesso para a role authenticated
grant select on public.cetesb_filter_options_cache to authenticated;
grant execute on function public.refresh_filter_options_cache() to authenticated;
grant execute on function public.get_filter_options(text) to authenticated;
