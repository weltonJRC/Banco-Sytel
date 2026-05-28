# Checklist Pré-Commit — Portal CETESB

Este checklist serve como um guia rápido a ser executado por desenvolvedores da JRC antes de realizar commits no repositório do **Portal CETESB - Retenção Histórica**.

---

## 🚫 1. Arquivos Proibidos no Repositório

Certifique-se de que nenhum dos seguintes arquivos está rastreado ou sendo adicionado ao Git:

- [ ] **Variáveis de Ambiente**: `.env` ou `.env.local`
- [ ] **Planilhas Reais de Origem**: Qualquer arquivo `.xlsx` ou `.csv` contendo dados reais na pasta `/data/raw/` ou no diretório raiz do projeto (apenas `.gitkeep` deve existir no repositório)
- [ ] **Dados em Telefone Aberto**: Nossos mocks em `/data/mock/` ou arquivos JSON em logs e testes **não** devem conter números de telefones reais abertos
- [ ] **Dumps de Banco**: Arquivos de dump ou scripts SQL gerados com dados reais do banco
- [ ] **Módulos**: A pasta `node_modules/` e pastas temporárias como `.next/` e `tsconfig.tsbuildinfo`

---

## 🔒 2. Cybersegurança e Auditoria

- [ ] **Prevenção de Hardcoding**: A senha oficial da CETESB (`Cetesb123`) ou tokens de service role do Supabase **não** estão explícitos em nenhum script, documentação ou arquivos de mockup.
- [ ] **Env Guards**: O guard `assertMockAllowed()` em `/lib/validators.ts` impede a execução acidental de comandos mock em ambiente de produção (`APP_ENV=production`).
- [ ] **Verificação de Chaves Ocultas**: Todos os campos técnicos que identificam metadados internos de arquivos ou bancos de dados (`status_validacao`, `raw_payload`, etc.) estão devidamente escondidos na interface visual e nas views do Supabase.

---

## ⚡ 3. Comandos de Validação Obrigatórios

Execute os comandos a seguir em ordem no terminal do projeto para atestar a conformidade técnica da base de código:

1. **Checar Compilação de Tipos TypeScript**:
   ```bash
   npm run typecheck
   ```
   *Resultado esperado*: Nenhuma mensagem de erro de tipos.

2. **Executar a Suíte de Testes Unitários**:
   ```bash
   npm run test
   ```
   *Resultado esperado*: Todos os 35 testes passando com sucesso.

3. **Validar Dados e Integridade (Supabase)**:
   ```bash
   npm run validate:data
   ```
   *Resultado esperado*: Volumetria correta (222.191 registros) e views do frontend íntegras.

4. **Gerar Build de Produção do Next.js**:
   ```bash
   npm run build
   ```
   *Resultado esperado*: Build empacotada com sucesso e sem avisos de linter críticos.

5. **Inspecionar Status do Repositório**:
   ```bash
   git status
   ```
   *Resultado esperado*: Apenas arquivos fonte de código (React, TypeScript, CSS e documentação em markdown) estão listados como modificados ou não-rastreados.
