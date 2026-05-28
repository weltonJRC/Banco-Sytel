-- Migration 008_front_views.sql
-- Cria as views de frontend com colunas mapeadas no padrão exato da Sytel e security_invoker = true

-- 1. View de Atendimentos Operação
create or replace view public.vw_cetesb_atendimentos_operacao_front
with (security_invoker = true)
as
select
    campanha as "Campanha",
    fila as "Fila",
    coalesce(usuario, '-') as "Usuário",
    numero_telefone as "Número de telefone",
    sessao_iniciada as "Sessão iniciada - Evento",
    duracao_fila_segundos as "Duração da fila - Total",
    duracao_fala_segundos as "Duração da fala - Total",
    descricao_resultado as "Descrição do resultado do usuário",
    resultado_usuario as "Resultado do usuário"
from public.cetesb_eventos
where tipo_relatorio = 'ATENDIMENTO_OPERACAO';

-- 2. View de URA CETESB
create or replace view public.vw_cetesb_ura_front
with (security_invoker = true)
as
select
    campanha as "Campanha",
    fila as "Fila",
    numero_telefone as "Número de telefone",
    sessao_iniciada as "Sessão iniciada - Evento",
    duracao_fila_segundos as "Duração da fila - Total",
    duracao_fala_segundos as "Duração da fala - Total",
    resultado_name as "Resultado",
    descricao_resultado as "Descrição do resultado do usuário"
from public.cetesb_eventos
where tipo_relatorio = 'URA';
