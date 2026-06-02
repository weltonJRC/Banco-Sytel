-- Migration 013_qualificacao_detalhada_atendimento.sql
-- Cria a função RPC get_qualificacao_detalhada_atendimento para o relatório consolidado
-- de qualificação por campanha, consumindo dados de public.cetesb_eventos.
--
-- ATENÇÃO: Esta migration é somente aditiva.
-- Nenhuma tabela, view, função, policy ou dado existente é alterado.
-- Aplique esta migration manualmente no Supabase SQL Editor.

-- ═══════════════════════════════════════════════════════════
-- 1. CRIAÇÃO DA FUNÇÃO RPC
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_qualificacao_detalhada_atendimento(
  data_inicio  timestamp,
  data_fim     timestamp,
  campanha_filter  text default null,
  resultado_filter text default null,
  fonte_filter     text default null,
  status_filter    text default null
)
returns table(
  campanha                      text,
  tipo                          text,
  qualificacao                  text,
  chamadas                      bigint,
  tma_soma_segundos             bigint,
  tma_media_segundos            numeric,
  pos_atendimento_soma_segundos bigint,
  pos_atendimento_media_segundos numeric,
  periodo_inicio                timestamp,
  periodo_fim                   timestamp
)
language sql
security definer
stable
set search_path = public
as $$
  select
    e.campanha::text                                                               as campanha,
    'Inbound'::text                                                                as tipo,
    coalesce(
      nullif(trim(e.descricao_resultado), ''),
      nullif(trim(e.resultado_usuario),   ''),
      'SEM QUALIFICAÇÃO'
    )::text                                                                        as qualificacao,
    count(*)::bigint                                                               as chamadas,
    coalesce(sum(e.duracao_fala_segundos), 0)::bigint                             as tma_soma_segundos,
    coalesce(round(avg(e.duracao_fala_segundos)::numeric, 2), 0)                  as tma_media_segundos,
    0::bigint                                                                      as pos_atendimento_soma_segundos,
    0::numeric                                                                     as pos_atendimento_media_segundos,
    data_inicio                                                                    as periodo_inicio,
    data_fim                                                                       as periodo_fim
  from public.cetesb_eventos e
  where
    e.tipo_relatorio = 'ATENDIMENTO_OPERACAO'
    and e.sessao_iniciada >= data_inicio
    and e.sessao_iniciada <  data_fim
    and (campanha_filter  is null or e.campanha           = campanha_filter)
    and (resultado_filter is null or (
          coalesce(nullif(trim(e.descricao_resultado), ''), nullif(trim(e.resultado_usuario), ''), 'SEM QUALIFICAÇÃO')
          ilike '%' || resultado_filter || '%'
        ))
    and (fonte_filter     is null or e.fonte_oficial      = fonte_filter)
    and (status_filter    is null or e.status_validacao   = status_filter)
  group by
    e.campanha,
    coalesce(
      nullif(trim(e.descricao_resultado), ''),
      nullif(trim(e.resultado_usuario),   ''),
      'SEM QUALIFICAÇÃO'
    )
  order by
    e.campanha,
    count(*) desc,
    coalesce(
      nullif(trim(e.descricao_resultado), ''),
      nullif(trim(e.resultado_usuario),   ''),
      'SEM QUALIFICAÇÃO'
    );
$$;

-- ═══════════════════════════════════════════════════════════
-- 2. CONCESSÃO DE PERMISSÃO PARA USUÁRIOS AUTENTICADOS
-- ═══════════════════════════════════════════════════════════

grant execute on function public.get_qualificacao_detalhada_atendimento(
  timestamp, timestamp, text, text, text, text
) to authenticated;
