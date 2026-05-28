-- Migration 004_indexes.sql
-- Adiciona índices de performance para acelerar buscas, paginação e filtros no Portal CETESB

-- Índices essenciais na tabela 'cetesb_eventos'

-- Filtros de Data de Atendimento e Sessão Iniciada (Muito comum para relatórios)
create index if not exists idx_cetesb_eventos_sessao_iniciada on public.cetesb_eventos(sessao_iniciada desc);
create index if not exists idx_cetesb_eventos_data_atendimento on public.cetesb_eventos(data_atendimento);

-- Filtro por tipo de relatório (Atendimento vs URA)
create index if not exists idx_cetesb_eventos_tipo_relatorio on public.cetesb_eventos(tipo_relatorio);

-- Filtro por fonte de dados (2025 Excel vs 2026 Sytel)
create index if not exists idx_cetesb_eventos_fonte_oficial on public.cetesb_eventos(fonte_oficial);

-- Filtros operacionais combinados para buscas eficientes na tabela
create index if not exists idx_cetesb_eventos_campanha on public.cetesb_eventos(campanha);
create index if not exists idx_cetesb_eventos_fila on public.cetesb_eventos(fila);
create index if not exists idx_cetesb_eventos_usuario on public.cetesb_eventos(usuario);

-- Filtro por status de validação
create index if not exists idx_cetesb_eventos_status_validacao on public.cetesb_eventos(status_validacao);

-- Índice composto para consultas rápidas do dashboard (Tipo + Fonte + Ano/Mês)
create index if not exists idx_cetesb_eventos_dash_summary on public.cetesb_eventos(tipo_relatorio, fonte_oficial, ano, mes);

-- Busca rápida de auditoria por número de telefone hasheado
create index if not exists idx_cetesb_eventos_tel_hash on public.cetesb_eventos(numero_telefone_hash);
