# Checklist de Segurança e RLS — Portal CETESB

Este documento apresenta a análise de conformidade de Row Level Security (RLS), proteção de dados corporativos e políticas de segurança aplicadas no banco de dados Supabase para o **Portal CETESB - Retenção Histórica**.

---

## 🔒 1. Row Level Security (RLS) no Supabase

Todas as tabelas do banco de dados expostas na API pública do Supabase devem possuir políticas de RLS ativadas para garantir a restrição de acessos conforme o perfil do usuário logado.

### A. Tabela `public.profiles`
- **RLS Ativado**: Sim.
- **Políticas**:
  - `jrc_admin` possui privilégio total de leitura, escrita e deleção de perfis.
  - Usuários autenticados comuns (`cetesb_consulta`, `cetesb_gestao`, `jrc_auditoria`, `jrc_operacao`) podem ler apenas o seu próprio perfil.
  - A escrita e alteração de perfil é vedada a qualquer usuário que não seja `jrc_admin`.

### B. Tabela `public.cetesb_eventos`
- **RLS Ativado**: Sim.
- **Políticas**:
  - Usuários autenticados autorizados (`jrc_admin`, `jrc_operacao`, `jrc_auditoria`, `cetesb_gestao`, `cetesb_consulta`) podem realizar consultas (SELECT).
  - Escrita e deleção de dados é permitida apenas à chave de serviço do sistema (`service_role` via scripts de importação controlados), impossibilitando injeções ou adulterações a partir de requisições client-side do navegador.

### C. Views de Frontend (`public.vw_cetesb_atendimentos_operacao_front` & `public.vw_cetesb_ura_front`)
- **Segurança**: Definidas com `security_invoker = true`.
- **Funcionamento**: Isto assegura que as views respeitem rigorosamente as mesmas políticas de RLS e permissões aplicadas na tabela física `public.cetesb_eventos`.
- **Vantagem**: Caso um token não autenticado ou inválido tente realizar uma busca direta na view, o PostgreSQL recusará ou retornará zero registros.

---

## 🛡️ 2. Proteção de Dados e Controles Adicionais

- **Mapeamento de Telefones**: Telefones reais em formato limpo (`numero_telefone`) estão armazenados de forma estruturada para atender à solicitação final de auditoria da CETESB.
- **Hash SHA-256**: A tabela mantém a coluna `numero_telefone_hash` gerada irreversivelmente via SHA-256 no momento da importação. Isso permite buscas exatas indexadas sem expor o número real em tela para auditores que tenham perfil restrito (e.g. `jrc_auditoria`).
- **Prevenção de Injeções SQL**: Toda a comunicação client-side com as views e tabelas do Supabase é realizada através da biblioteca oficial `@supabase/supabase-js`, utilizando ORM baseada em PostgREST que parametrizará todas as consultas, prevenindo vulnerabilidades de injeção.
- **Criptografia em Trânsito**: Todas as rotas de comunicação com a API REST do Supabase (`vrpvaftryrqmmrgztwde.supabase.co`) trafegam exclusivamente via HTTPS com criptografia TLS 1.3 de alta performance.
