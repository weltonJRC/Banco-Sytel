-- Migration 007_add_full_phone.sql
-- Adiciona coluna numero_telefone e migra dados em massa a partir do raw_payload

-- 1. Adiciona o campo de telefone completo na tabela principal
alter table public.cetesb_eventos
add column if not exists numero_telefone text;

-- 2. Migra os dados em lote do raw_payload para a nova coluna diretamente no PostgreSQL
update public.cetesb_eventos
set numero_telefone = raw_payload->>'Número de telefone'
where numero_telefone is null;
