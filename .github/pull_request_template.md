## Objetivo

Descreva a mudanca e o conjunto de dados/fluxo afetado.

## Classificacao

- Estado alvo: CURRENT / HML / PRODUCAO / HISTORICO / EXPERIMENTAL / LEGADO
- [ ] Altera inspecao/importacao de planilhas.
- [ ] Altera hash/deduplicacao/normalizacao.
- [ ] Altera schema ou acesso Supabase.
- [ ] Altera exportacao/retencao/privacidade.

## Dados, seguranca e side effects

- [ ] Confirmei proveniencia e periodo dos dados afetados.
- [ ] Nao introduzi `.env`, senha, service-role key, secret, planilha/export real ou PII desnecessaria.
- [ ] Operacao que escreve em base real so foi executada com ambiente e autorizacao explicitos.
- [ ] Mudancas de importacao preservam idempotencia/deduplicacao e auditabilidade.

## Verificacoes executadas

Marque apenas o que foi realmente executado:
- [ ] `npm run test`
- [ ] `npm run inspect:excel`
- [ ] `npm run validate:data`
- [ ] Importacao HML/controlada
- [ ] Nao aplicavel — somente documentacao

Resultados:
```text
NAO_EXECUTADO ou resultados reais aqui.
```

## Evidencias

Informe evidencias sem colar dados pessoais, credenciais ou planilhas reais.

## Rollback

Descreva rollback de codigo e, se houver side effect de dados, estrategia de reversao/auditoria.

## Checklist final

- [ ] Revisei o diff completo.
- [ ] Nao alterei `main` diretamente como area inicial de trabalho.
- [ ] Nao confundi dado HISTORICO com estado CURRENT do Sytel.
- [ ] Nao classifiquei como `BASELINE_VALIDADO` sem evidencia.
