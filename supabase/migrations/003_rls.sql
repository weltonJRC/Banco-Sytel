-- Migration 003_rls.sql
-- Habilita e define políticas de Row Level Security (RLS) para as tabelas principais
--
-- IMPORTANTE: Aplicar SOMENTE quando Supabase Auth estiver configurado.
-- Veja docs/SUPABASE_SETUP.md para instruções.

-- Ativando RLS nas tabelas
alter table public.profiles enable row level security;
alter table public.cetesb_eventos enable row level security;
alter table public.import_files enable row level security;
alter table public.monthly_coverage enable row level security;

-- ═══════════════════════════════════════════════════════════
-- Função auxiliar SECURITY DEFINER para lookup de perfil
-- Evita self-referencing recursivo nas políticas de profiles
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_user_role(user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select perfil
  from public.profiles
  where id = user_id
    and ativo = true
  limit 1;
$$;

create or replace function public.is_user_active(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and ativo = true
  );
$$;

-- ═══════════════════════════════════════════════════════════
-- 1. Políticas para a Tabela 'profiles'
-- Usa get_user_role() para evitar self-referencing
-- ═══════════════════════════════════════════════════════════

-- Qualquer autenticado pode ler seu próprio perfil
create policy "Usuarios podem ler seu proprio perfil"
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
);

-- Admins, auditores e gestores podem listar todos os perfis
create policy "Administradores consultam perfis"
on public.profiles
for select
to authenticated
using (
    public.get_user_role(auth.uid()) in ('jrc_admin', 'jrc_auditoria', 'cetesb_gestao')
);

-- Usuários podem atualizar próprio perfil (nome apenas)
create policy "Usuarios atualizam proprio perfil"
on public.profiles
for update
to authenticated
using (
    id = auth.uid()
);

-- Somente admins JRC podem inserir/atualizar/deletar qualquer perfil
create policy "Admins JRC modificam perfis"
on public.profiles
for all
to authenticated
using (
    public.get_user_role(auth.uid()) = 'jrc_admin'
);


-- ═══════════════════════════════════════════════════════════
-- 2. Políticas para a Tabela Principal 'cetesb_eventos'
-- ═══════════════════════════════════════════════════════════

create policy "usuarios autorizados consultam eventos"
on public.cetesb_eventos
for select
to authenticated
using (
    public.is_user_active(auth.uid())
    and public.get_user_role(auth.uid()) in (
        'jrc_admin',
        'jrc_operacao',
        'jrc_auditoria',
        'cetesb_consulta',
        'cetesb_gestao'
    )
);

create policy "Admins e Operadores JRC modificam eventos"
on public.cetesb_eventos
for all
to authenticated
using (
    public.get_user_role(auth.uid()) in ('jrc_admin', 'jrc_operacao')
);


-- ═══════════════════════════════════════════════════════════
-- 3. Políticas para a Tabela 'import_files'
-- ═══════════════════════════════════════════════════════════

create policy "usuarios autorizados consultam arquivos de importacao"
on public.import_files
for select
to authenticated
using (
    public.is_user_active(auth.uid())
    and public.get_user_role(auth.uid()) in (
        'jrc_admin',
        'jrc_operacao',
        'jrc_auditoria',
        'cetesb_consulta',
        'cetesb_gestao'
    )
);

create policy "Admins e Operadores JRC modificam import_files"
on public.import_files
for all
to authenticated
using (
    public.get_user_role(auth.uid()) in ('jrc_admin', 'jrc_operacao')
);


-- ═══════════════════════════════════════════════════════════
-- 4. Políticas para a Tabela 'monthly_coverage'
-- ═══════════════════════════════════════════════════════════

create policy "usuarios autorizados consultam cobertura mensal"
on public.monthly_coverage
for select
to authenticated
using (
    public.is_user_active(auth.uid())
    and public.get_user_role(auth.uid()) in (
        'jrc_admin',
        'jrc_operacao',
        'jrc_auditoria',
        'cetesb_consulta',
        'cetesb_gestao'
    )
);

create policy "Admins e Operadores JRC modificam monthly_coverage"
on public.monthly_coverage
for all
to authenticated
using (
    public.get_user_role(auth.uid()) in ('jrc_admin', 'jrc_operacao')
);
