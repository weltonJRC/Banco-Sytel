-- Migration 001_schema.sql
-- Cria as tabelas principais para o Portal CETESB - Retenção Histórica

-- 1. Tabela de Perfis de Usuários (Integrada com Supabase Auth)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    nome text not null,
    email text not null,
    perfil text not null, -- jrc_admin, jrc_operacao, jrc_auditoria, cetesb_consulta, cetesb_gestao
    ativo boolean default true,
    created_at timestamp default now()
);

-- 2. Tabela Principal de Eventos Consolidados (Atendimento Humano & URA)
create table if not exists public.cetesb_eventos (
    id bigserial primary key,
    tenant text not null default 'CETESB',
    tipo_relatorio text not null, -- ATENDIMENTO_OPERACAO, URA
    fonte_oficial text not null, -- EXCEL_2025, SYTEL_2026
    arquivo_origem text,
    hash_arquivo text,
    status_validacao text default 'PENDENTE', -- VALIDADO, PENDENTE, DIVERGENTE, ERRO
    
    campanha text,
    fila text,
    usuario text, -- Omitido ou null para URA
    
    numero_telefone_mascarado text,
    numero_telefone_hash text, -- SHA-256 para buscas e conciliações seguras
    
    sessao_iniciada timestamp,
    data_atendimento date generated always as (sessao_iniciada::date) stored,
    ano int generated always as (extract(year from sessao_iniciada)::int) stored,
    mes int generated always as (extract(month from sessao_iniciada)::int) stored,
    
    duracao_fila_segundos int,
    duracao_fala_segundos int,
    
    resultado_nome text, -- Exclusivo da URA
    descricao_resultado text, -- Descrição livre do resultado
    resultado_usuario text, -- Preenchido no Sytel 2026
    
    raw_payload jsonb, -- Dados originais completos da linha
    created_at timestamp default now()
);

-- 3. Tabela de Auditoria de Arquivos Importados
create table if not exists public.import_files (
    id bigserial primary key,
    source_system text not null, -- JRC_RECOVERED, SYTEL_EXPORT, etc.
    source_type text not null, -- EXCEL, CSV, API
    file_name text not null,
    file_path text,
    file_hash_sha256 text not null unique, -- Impede dupla importação física do mesmo arquivo
    reference_start_date date,
    reference_end_date date,
    imported_at timestamp default now(),
    imported_by text, -- Nome/Email de quem importou
    import_status text default 'PENDENTE', -- PENDENTE, PROCESSANDO, SUCESSO, ERRO
    total_rows int,
    notes text
);

-- 4. Tabela de Cobertura Mensal de Dados
create table if not exists public.monthly_coverage (
    id bigserial primary key,
    ano int not null,
    mes int not null,
    periodo_inicio date,
    periodo_fim date,
    fonte_principal text, -- EXCEL_2025, SYTEL_2026
    arquivo_origem text,
    total_linhas int,
    status text, -- OK, PARCIAL, LACUNA
    observacao text,
    validated_by text,
    validated_at timestamp,
    constraint unique_ano_mes_fonte unique (ano, mes, fonte_principal)
);
