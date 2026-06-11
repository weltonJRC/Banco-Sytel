-- Migration 014_chamadas_por_hora.sql
-- Cria a função RPC get_chamadas_por_hora para o novo relatório consolidado
-- agrupado por data, campanha, fila e hora do atendimento.
--
-- ATENÇÃO: Esta migration é somente aditiva.
-- Nenhuma tabela, view, função, policy ou dado existente é alterado.
-- Aplique esta migration no Supabase SQL Editor.

-- ═══════════════════════════════════════════════════════════
-- 1. CRIAÇÃO DA FUNÇÃO RPC
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_chamadas_por_hora(
  data_inicio      timestamp,
  data_fim         timestamp,
  campanha_filter  text default null,
  fila_filter      text default null,
  fonte_filter     text default null,
  status_filter    text default null
)
returns table(
  data                          date,
  campanha                      text,
  midia                         text,
  fila                          text,
  hora                          int,
  total                         bigint,
  enfileiradas                  bigint,
  em_fila                       bigint,
  conectadas_agente             bigint,
  abandonadas                   bigint,
  expiradas_na_fila             bigint,
  derrubadas                    bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    e.sessao_iniciada::date                                                        as data,
    e.campanha::text                                                               as campanha,
    'Voice'::text                                                                  as midia,
    e.fila::text                                                                   as fila,
    extract(hour from e.sessao_iniciada)::int                                      as hora,
    count(*)::bigint                                                               as total,
    count(*) filter (where e.fila is not null and e.fila != '')::bigint            as enfileiradas,
    count(*) filter (where e.duracao_fila_segundos > 0)::bigint                     as em_fila,
    count(*) filter (where e.duracao_fala_segundos > 0 or (e.usuario is not null and e.usuario != '-'))::bigint as conectadas_agente,
    
    count(*) filter (where 
      e.resultado_nome = 'Receptiva Abandonada' 
      or (e.tipo_relatorio = 'ATENDIMENTO_OPERACAO' and (e.descricao_resultado in ('CLIENTE DESLIGOU', 'CLIENTE NÃO DIGITOU OPÇÃO') or e.resultado_usuario = '322'))
    )::bigint                                                                      as abandonadas,
    
    count(*) filter (where 
      e.resultado_nome = 'Receptiva Derrubada' 
      or (e.tipo_relatorio = 'ATENDIMENTO_OPERACAO' and (e.descricao_resultado = 'Chamada Desconectada' or e.resultado_usuario = '-1') and e.duracao_fala_segundos = 0)
    )::bigint                                                                      as expiradas_na_fila,
    
    count(*) filter (where 
      e.resultado_nome = 'Receptiva Derrubada' 
      or (e.tipo_relatorio = 'ATENDIMENTO_OPERACAO' and (e.descricao_resultado in ('Chamada Desconectada', 'LIGAÇÃO MUDA') or e.resultado_usuario in ('361', '321', '-1')))
    )::bigint                                                                      as status_derrubadas
  from public.cetesb_eventos e
  where
    e.sessao_iniciada >= data_inicio
    and e.sessao_iniciada <= data_fim
    and (campanha_filter is null or e.campanha = campanha_filter)
    and (fila_filter is null or e.fila = fila_filter)
    and (fonte_filter is null or e.fonte_oficial = fonte_filter)
    and (status_filter is null or e.status_validacao = status_filter)
  group by
    e.sessao_iniciada::date,
    e.campanha,
    e.fila,
    extract(hour from e.sessao_iniciada)::int
  order by
    e.sessao_iniciada::date asc,
    e.campanha asc,
    e.fila asc,
    extract(hour from e.sessao_iniciada)::int asc;
$$;

-- ═══════════════════════════════════════════════════════════
-- 2. CONCESSÃO DE PERMISSÃO PARA USUÁRIOS AUTENTICADOS
-- ═══════════════════════════════════════════════════════════

grant execute on function public.get_chamadas_por_hora(
  timestamp, timestamp, text, text, text, text
) to authenticated;
