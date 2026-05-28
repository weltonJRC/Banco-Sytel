-- Migration 002_views.sql
-- Cria as views especificadas para o front-end com security_invoker = true

-- 1. View para Atendimentos Operação (Atendimento Humano)
create or replace view public.vw_cetesb_atendimentos_operacao
with (security_invoker = true)
as
select
    id,
    campanha,
    fila,
    coalesce(usuario, '-') as usuario,
    numero_telefone_mascarado as numero_telefone,
    sessao_iniciada,
    duracao_fila_segundos,
    duracao_fala_segundos,
    descricao_resultado,
    coalesce(resultado_usuario, '-') as resultado_usuario,
    fonte_oficial,
    arquivo_origem,
    status_validacao
from public.cetesb_eventos
where tipo_relatorio = 'ATENDIMENTO_OPERACAO';

-- 2. View para URA CETESB
create or replace view public.vw_cetesb_ura
with (security_invoker = true)
as
select
    id,
    campanha,
    fila,
    numero_telefone_mascarado as numero_telefone,
    sessao_iniciada,
    duracao_fila_segundos,
    duracao_fala_segundos,
    resultado_nome,
    descricao_resultado,
    fonte_oficial,
    arquivo_origem,
    status_validacao
from public.cetesb_eventos
where tipo_relatorio = 'URA';

-- 3. View para Auditoria de Cargas
create or replace view public.vw_cetesb_auditoria
with (security_invoker = true)
as
select
    id,
    source_system,
    source_type,
    file_name,
    file_hash_sha256,
    reference_start_date,
    reference_end_date,
    imported_at,
    imported_by,
    import_status,
    total_rows,
    notes
from public.import_files
order by imported_at desc;
