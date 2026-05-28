# Checklist de Implantação Manual - Portal CETESB

Este checklist descreve detalhadamente cada etapa manual necessária para configurar, rodar, migrar e homologar o **Portal CETESB - Retenção Histórica** no seu ambiente real de produção.

---

## 📋 Checklist de Ações

### 1. Infraestrutura do Banco de Dados
- [ ] **Criar ou Subir Supabase Self-Hosted (ou Supabase Cloud)**:
  - Crie uma conta no [Supabase](https://supabase.com) ou suba um contêiner Docker local self-hosted.
- [ ] **Criar Projeto e Ambiente**:
  - Crie um novo projeto chamado `Portal CETESB` no painel do Supabase.
- [ ] **Obter Credenciais de API**:
  - Acesse `Project Settings` > `API`.
  - Copie a **URL do projeto** (`NEXT_PUBLIC_SUPABASE_URL`).
  - Copie a **Chave Anônima** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
  - Copie a **Chave de Serviço** (`SUPABASE_SERVICE_ROLE_KEY` - Service Role, segura para scripts backend).

### 2. Configurações Locais
- [ ] **Configurar arquivo `.env`**:
  - Na raiz do seu projeto `cetesb-portal`, abra o arquivo `.env`.
  - Preencha as chaves copiadas anteriormente:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=seu_link_aqui.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
    SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_aqui
    ```
- [ ] **Instalar Dependências de Produção**:
  - Execute no seu terminal:
    ```bash
    npm install
    ```

### 3. Aplicação do Schema e Migrações SQL
- [ ] **Aplicar Schemas no SQL Editor**:
  - No menu lateral do Supabase, acesse **SQL Editor** e crie uma nova query chamada `001_schema`.
  - Copie todo o conteúdo do arquivo [supabase/migrations/001_schema.sql](file:///c:/Users/DEV02/Desktop/CETESB/cetesb-portal/supabase/migrations/001_schema.sql), cole no editor e clique em **Run**.
- [ ] **Aplicar Views**:
  - Crie uma query chamada `002_views`.
  - Copie o conteúdo de [supabase/migrations/002_views.sql](file:///c:/Users/DEV02/Desktop/CETESB/cetesb-portal/supabase/migrations/002_views.sql), cole e execute (**Run**).
- [ ] **Aplicar Row Level Security (RLS)**:
  - Crie uma query chamada `003_rls`.
  - Copie o conteúdo de [supabase/migrations/003_rls.sql](file:///c:/Users/DEV02/Desktop/CETESB/cetesb-portal/supabase/migrations/003_rls.sql), cole e execute (**Run**).
- [ ] **Aplicar Índices Otimizados**:
  - Crie uma query chamada `004_indexes`.
  - Copie o conteúdo de [supabase/migrations/004_indexes.sql](file:///c:/Users/DEV02/Desktop/CETESB/cetesb-portal/supabase/migrations/004_indexes.sql), cole e execute (**Run**).
- [ ] **Habilitar Triggers de Perfil Automático**:
  - Crie uma query chamada `005_seed_profiles`.
  - Copie o conteúdo de [supabase/migrations/005_seed_profiles.sql](file:///c:/Users/DEV02/Desktop/CETESB/cetesb-portal/supabase/migrations/005_seed_profiles.sql), cole e execute (**Run**).
- [ ] **Aplicar Modelo para Telefone Completo (Migration 007)**:
  - Crie uma query chamada `007_add_full_phone`.
  - Copie o conteúdo de [supabase/migrations/007_add_full_phone.sql](file:///c:/Users/DEV02/Desktop/CETESB/cetesb-portal/supabase/migrations/007_add_full_phone.sql), cole e execute (**Run**). Isso adicionará a coluna de telefone completo e migrará instantaneamente as linhas existentes a partir do `raw_payload`.
- [ ] **Aplicar Views de Frontend Otimizadas (Migration 008)**:
  - Crie uma query chamada `008_front_views`.
  - Copie o conteúdo de [supabase/migrations/008_front_views.sql](file:///c:/Users/DEV02/Desktop/CETESB/cetesb-portal/supabase/migrations/008_front_views.sql), cole e execute (**Run**). Isso substituirá as views padrão por views no formato exato dos relatórios Sytel com suporte a RLS.

### 4. Controle de Acessos (Usuários)
- [ ] **Criar Usuários no Supabase Auth Panel**:
  - Vá em **Authentication** > **Users** no painel do Supabase.
  - Clique em **Add User** > **Create User** e insira e-mail e senha.
  - Crie as contas correspondentes ao seu teste (ex: `admin@jrc.local` com senha complexa).
- [ ] **Criar Usuário Oficial da CETESB**:
  - Vá em **Authentication** > **Users**.
  - Crie o usuário de consulta:
    - **Email**: `cetesb@jrc.local` (ou outro e-mail definido, correspondente à variável `NEXT_PUBLIC_CETESB_LOGIN_EMAIL` do `.env`)
    - **Senha**: `Cetesb123`
  - Copie o **UUID** gerado para esse usuário.
- [ ] **Popular Tabela de Perfis (`public.profiles`)**:
  - Vá em **SQL Editor** e crie uma nova query chamada `seed_cetesb_user`.
  - Insira o registro do perfil da CETESB colando o UUID copiado:
    ```sql
    insert into public.profiles (
        id,
        nome,
        email,
        perfil,
        ativo
    )
    values (
        'UUID_DO_USUARIO_COPIADO',
        'CETESB',
        'cetesb@jrc.local',
        'cetesb_consulta',
        true
    );
    ```
    Execute a query (**Run**).
  - Garanta também que os outros usuários cadastrados tenham seus perfis correspondentes vinculados na tabela `profiles`.
  - Certifique-se de associar pelo menos um usuário ao perfil `jrc_admin`.

### 5. Preparação e Carga dos Dados Físicos
- [ ] **Organizar os Arquivos Excel**:
  - Copie as duas planilhas originais fornecidas pela JRC/Sytel e cole-as na pasta `cetesb-portal/data/raw/`.
  - Verifique se os nomes dos arquivos estão idênticos a:
    1. `Dados Detalhados - KPI 6 MESES.XLSX` (2025)
    2. `Relatório Detalhado - ATENDIMENTOS OPERAÇÃO_20260527-163621.XLSX` (2026)
- [ ] **Inspecionar as Planilhas (Verificação Estática)**:
  - No terminal da pasta `cetesb-portal`, execute:
    ```bash
    npm run inspect:excel
    ```
  - Valide se todas as abas e colunas necessárias foram listadas no relatório gerado no terminal.
- [ ] **Executar a Importação Real no Supabase**:
  - Execute no seu terminal:
    ```bash
    npm run import:excel
    ```
  - Verifique o resumo de importação no terminal. Confirme se as linhas lidas foram gravadas na base Supabase real e o arquivo registrou `SUCESSO` na auditoria.
- [ ] **Validar os Dados no Banco**:
  - Rode a validação executando:
    ```bash
    npm run validate:data
    ```
  - Confirme se não há erros graves, linhas duplicadas prováveis fora do esperado ou falhas de data.

### 6. Ativação e Homologação do Frontend
- [ ] **Desativar Modo Mock local**:
  - Abra o arquivo `.env` na raiz do projeto.
  - Altere a variável central de dados para `false`:
    ```env
    NEXT_PUBLIC_USE_MOCK_DATA=false
    MOCK_AUTH=false
    ```
- [ ] **Executar Ambiente Local de Desenvolvimento**:
  - Suba o portal local executando:
    ```bash
    npm run dev
    ```
  - Acesse no seu navegador: `http://localhost:3000`.
- [ ] **Testar Fluxo de Acesso Real**:
  - Faça login com as credenciais reais criadas no painel do Supabase Auth.
  - Verifique se os dados renderizados no Dashboard, Relatório de Atendimento, URA e Auditoria agora são puxados dinamicamente do banco real do Supabase.
- [ ] **Validar Mascaramento de Telefone**:
  - Certifique-se de que os números de telefone aparecem em formato `119****2885` na interface e na auditoria.
- [ ] **Testar Exportação**:
  - Clique em **Exportar Excel** e **Exportar CSV** nos relatórios para garantir que a planilha final seja gerada respeitando filtros com telefones devidamente mascarados.

### 7. Deploy em Servidor Próprio JRC
- [ ] **Buildar a Aplicação**:
  - Crie a build de produção otimizada executando:
    ```bash
    npm run build
    ```
- [ ] **Sincronizar Servidor**:
  - Siga as etapas de publicação detalhadas em [docs/DEPLOY_SERVIDOR_PROPRIO.md](file:///c:/Users/DEV02/Desktop/CETESB/cetesb-portal/docs/DEPLOY_SERVIDOR_PROPRIO.md).
- [ ] **Configurar HTTPS e Domínio**:
  - Configure os certificados de segurança SSL Let's Encrypt para proteger as chamadas da API do portal.
- [ ] **Ativar Backup do PostgreSQL**:
  - Garanta que as rotinas de backup diário estejam configuradas no Supabase.
- [ ] **Liberar o Acesso**:
  - Forneça os usuários e senhas de perfis `cetesb_gestao` ou `cetesb_consulta` criados para a equipe da CETESB.
