# Portal CETESB - Retenção Histórica

O **Portal CETESB - Retenção Histórica** é uma solução web corporativa completa construída pela JRC para consolidar e disponibilizar para consulta da CETESB as bases históricas recuperadas da operação de atendimento humano e URA do ano de 2025 (planilha física recuperada) e do ano de 2026 (exportações do call center Sytel), que foram perdidas devido a falhas na retenção original no RVAggregator.

A solução é integrada **100% à base de dados real do Supabase**, consultando as tabelas e views estruturadas de produção de forma segura e veloz, oferecendo filtros avançados, paginação rápida e exportação customizada de relatórios legíveis para arquivos CSV e planilhas Excel (.xlsx).

---

## 🚀 Como Iniciar

A aplicação funciona diretamente conectada ao banco real do Supabase. Siga as instruções abaixo para configurá-la localmente:

### 1. Instalar as dependências
Abra o terminal na pasta `cetesb-portal` e execute:
```bash
npm install
```

### 2. Configurar o arquivo `.env`
Crie um arquivo `.env` na raiz do projeto (copie o modelo de `.env.example`) e preencha as variáveis de acesso reais obtidas no painel do Supabase:
```env
APP_ENV=development

NEXT_PUBLIC_SUPABASE_URL=https://sua-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_aqui

NEXT_PUBLIC_EXPORT_MAX_ROWS=10000
EXPORT_MAX_ROWS=10000

APP_NAME="Portal CETESB - Retenção Histórica"

NEXT_PUBLIC_CETESB_LOGIN_EMAIL=cetesb@jrc.local
```

### 3. Rodar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse no seu navegador: [http://localhost:3000](http://localhost:3000).

---

## 🔑 Acesso de Usuário CETESB

O Portal foi desenhado sob medida para um único usuário corporativo de consulta para a CETESB:
* **Usuário no Front-end**: `Cetesb`
* **Mapeamento de E-mail Interno**: `cetesb@jrc.local` (configurado na variável `NEXT_PUBLIC_CETESB_LOGIN_EMAIL` no `.env`)
* **Perfil do Usuário**: `cetesb_consulta`
* **Senha inicial**: `Cetesb123` (criada manualmente no painel Supabase Auth)

---

## ⚡ Comandos e Utilitários de CLI

Oferecemos scripts de terminal prontos para gerenciar e auditar os dados históricos reais:

### 1. Inspecionar Planilhas Físicas
Analisa os arquivos colocados na pasta `/data/raw/` sem alterar o banco de dados. Exibe as abas encontradas, colunas físicas de cada aba, total exato de linhas e períodos de datas:
```bash
npm run inspect:excel
```

### 2. Importar Dados para o Supabase Real
Executa o hashing SHA-256 do arquivo físico (bloqueia duplicados), valida dados, mascara telefones na base de dados, converte durações para segundos e grava em lotes no Supabase PostgreSQL:
```bash
npm run import:excel
```

### 3. Auditar e Validar Integridade da Base
Executa uma auditoria completa na base real conectado ao Supabase, exibindo totais acumulados por mês, fonte oficial e tipo de relatório, além de validar se todas as colunas de frontend estão estruturadas perfeitamente:
```bash
npm run validate:data
```

### 4. Rodar Testes de Conformidade
Executa os testes unitários de segurança baseados no framework **Vitest**:
```bash
npm run test
```

---

## 🔒 Regras de Segurança e Versionamento (Git)

Para manter a conformidade de cybersegurança e proteção de dados, atente-se rigorosamente às regras de bloqueio antes de qualquer commit:
* **NÃO versionar credenciais**: Os arquivos `.env` e chaves privadas estão estritamente bloqueados no `.gitignore`.
* **NÃO versionar planilhas reais**: As planilhas físicas inseridas na pasta `/data/raw/` são ignoradas pelo Git. Apenas o arquivo `.gitkeep` deve ser mantido no repositório.
* **NÃO expor dados sensíveis**: Não commite backups, dumps SQL, logs locais (`*.log`) ou bases geradas na sua máquina.
