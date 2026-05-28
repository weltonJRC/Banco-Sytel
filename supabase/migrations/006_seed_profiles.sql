-- Migration 005_seed_profiles.sql
-- Script de auxílio para associar contas criadas no Supabase Auth com a tabela public.profiles

-- NOTA: Como o Supabase Auth gera o 'uuid' automaticamente na criação do usuário via painel ou api,
-- este script demonstra como inserir os perfis correspondentes vinculando-os ao ID gerado.

/*
-- EXEMPLOS DE INSERÇÃO MANUAL APÓS A CRIAÇÃO DOS USUÁRIOS NO SUPABASE AUTH PANEL:

-- 1. Perfil Admin JRC
insert into public.profiles (id, nome, email, perfil, ativo)
values (
    'UUID_DO_USUARIO_ADMIN_CRIADO_NO_SUPABASE', -- Substituir pelo ID real do Auth
    'Administrador JRC',
    'admin@jrc.local',
    'jrc_admin',
    true
)
on conflict (id) do update
set nome = excluded.nome, perfil = excluded.perfil, ativo = excluded.ativo;

-- 2. Perfil Operação JRC
insert into public.profiles (id, nome, email, perfil, ativo)
values (
    'UUID_DO_USUARIO_OPERACAO_CRIADO_NO_SUPABASE',
    'Operador JRC',
    'operacao@jrc.local',
    'jrc_operacao',
    true
);

-- 3. Perfil Auditoria JRC
insert into public.profiles (id, nome, email, perfil, ativo)
values (
    'UUID_DO_USUARIO_AUDITORIA_CRIADO_NO_SUPABASE',
    'Auditor JRC',
    'auditoria@jrc.local',
    'jrc_auditoria',
    true
);

-- 4. Perfil Consulta CETESB (Visualização Simples)
insert into public.profiles (id, nome, email, perfil, ativo)
values (
    'UUID_DO_USUARIO_CETESB_CONSULTA_CRIADO_NO_SUPABASE',
    'Consulta CETESB',
    'cetesb.consulta@cetesb.sp.gov.br',
    'cetesb_consulta',
    true
);

-- 5. Perfil Gestão CETESB (Dashboard + Relatórios)
insert into public.profiles (id, nome, email, perfil, ativo)
values (
    'UUID_DO_USUARIO_CETESB_GESTAO_CRIADO_NO_SUPABASE',
    'Gestor CETESB',
    'cetesb.gestao@cetesb.sp.gov.br',
    'cetesb_gestao',
    true
);
*/

-- Trigger para automatizar a criação do perfil a partir de novos registros na tabela auth.users do Supabase (OPCIONAL)
-- Esse trigger cria automaticamente um perfil 'cetesb_consulta' quando um novo usuário se cadastra,
-- permitindo que você apenas mude o perfil no banco depois.

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, nome, email, perfil, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'perfil', 'cetesb_consulta'),
    true
  );
  return new;
end;
$$;

-- Para ativar o trigger automático, remova os comentários abaixo:
-- create or replace trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();
