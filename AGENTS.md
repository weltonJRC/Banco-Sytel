<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# JRC AI-First Rules - Portal CETESB Retencao Historica

## Identidade do repositorio
Apesar do nome historico `Banco-Sytel`, este repositorio contem o **Portal CETESB - Retencao Historica**. Nao o tratar como repositorio de configuracao atual do Sytel, PABX ou banco operacional do contact center.

## Escopo de dados
- O portal trabalha com dados historicos recuperados/retidos para consulta, auditoria e exportacao.
- Dados historicos nao devem ser interpretados como configuracao ou estado operacional CURRENT do Sytel.
- Preservar a proveniencia por periodo/fonte e nao reconciliar divergencias silenciosamente.

## Seguranca e privacidade
- Nunca commitar `.env`, credenciais Supabase, service-role keys, secrets de sessao, senhas, planilhas reais, dumps, exports reais ou logs com PII.
- Nao documentar senha inicial ou credencial reutilizavel em README, issue, prompt ou commit.
- Exportacoes e dados de chamadas podem conter informacoes pessoais; minimizar e mascarar conforme as regras do projeto.
- Credenciais server-side nunca devem ser expostas ao frontend.

## Side effects de dados
- `inspect:excel` e uma atividade de leitura/inspecao.
- `import:excel` escreve na base real quando configurado: nao executar sem confirmar ambiente, fonte, hash/deduplicacao e autorizacao explicita.
- `validate:data` pode consultar dados reais: confirmar ambiente antes de executar e nunca copiar dados sensiveis para logs de revisao.
- Mudancas de importacao devem preservar idempotencia/deduplicacao, validacao e auditabilidade.
- Alteracoes destrutivas de schema/dados exigem plano de rollback e autorizacao explicita.

## Workflow AI-first
1. Ler `AGENTS.md`, `ARCHITECTURE.md` e `README.md` antes de alterar codigo.
2. Consultar codigo CURRENT e documentacao do projeto; nao assumir comportamento pelo nome do repositorio.
3. Mudancas arquiteturais ou de contrato de dados exigem design antes da implementacao.
4. Trabalhar em branch/worktree isolado; `main` nao e area inicial de trabalho.
5. Implementar a menor mudanca segura, preservando proveniencia e privacidade.
6. Para runtime, executar `npm run test` e verificacoes aplicaveis; operacoes contra dados reais so com ambiente/autorizacao confirmados.
7. Revisar diff para secrets, PII, credenciais, alteracoes de importacao/exportacao e efeitos destrutivos.
8. Abrir Pull Request antes de merge.

## Estados tecnicos
Diferenciar `CURRENT`, `HML`, `PRODUCAO`, `BASELINE_VALIDADO`, `HISTORICO`, `EXPERIMENTAL` e `LEGADO/DEPRECATED`.
