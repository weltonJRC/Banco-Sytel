# Importador de Arquivos Excel - Guia Operacional

Este documento descreve detalhadamente o mapeamento de colunas, regras de transformação e procedimentos para rodar a carga pesada de dados Excel históricos no banco **Supabase** do **Portal CETESB**.

---

## 📂 Arquivos de Origem Mapeados

O portal possui scripts preparados para carregar dados históricos de duas planilhas físicas guardadas na pasta `/data/raw/`:

1. **`Dados Detalhados - KPI 6 MESES.XLSX` (Histórico de 2025)**:
   - Contém a aba de atendimento humano: `Relatório Detalhado - ATENDIMEN`
   - Contém a aba de URA eletrônica: `Relatório Detalhado - URA CETE`
2. **`Relatório Detalhado - ATENDIMENTOS OPERAÇÃO_20260527-163621.XLSX` (Operação de 2026)**:
   - Contém a aba de atendimento humano: `Relatório Detalhado - ATENDIMEN`

---

## 🗺️ Tabela de Mapeamento de Colunas

Os cabeçalhos originais das planilhas são mapeados automaticamente de forma *Case Insensitive* para os campos do PostgreSQL:

### 1. Atendimento Humano (2025 e 2026)
Aba: `Relatório Detalhado - ATENDIMEN`

| Cabeçalho na Planilha | Campo Alvo no Banco | Regra de Ingestão |
|---|---|---|
| `Campanha` | `campanha` | String limpa de espaços extras. |
| `Fila` | `fila` | String limpa de espaços extras. |
| `Usuário` / `Usuario` | `usuario` | Nome do operador logado. Se vazio, grava `-`. |
| `Número de telefone` / `Telefone` | `numero_telefone_mascarado` / `numero_telefone_hash` | Aplica as regras de segurança e hashing criptográfico. |
| `Sessão iniciada - Evento` | `sessao_iniciada` | Converte formatos brutos para timestamp PostgreSQL. |
| `Duração da fila - Total` | `duracao_fila_segundos` | Converte string de duração (`mm:ss` ou `hh:mm:ss`) para segundos inteiros. |
| `Duração da fala - Total` | `duracao_fala_segundos` | Converte string de fala para segundos inteiros. |
| `Descrição do resultado do usuário`| `descricao_resultado` | Descrição do término da chamada. |
| `Resultado do usuário` (Apenas 2026) | `resultado_usuario` | Classificação do operador. Grava `null` na base 2025. |
| *Constante da Carga* | `tipo_relatorio` | Preenche automaticamente com `ATENDIMENTO_OPERACAO`. |
| *Constante da Carga* | `fonte_oficial` | Preenche `EXCEL_2025` ou `SYTEL_2026` dependendo do arquivo. |

### 2. URA Eletrônica (Apenas 2025)
Aba: `Relatório Detalhado - URA CETE`

| Cabeçalho na Planilha | Campo Alvo no Banco | Regra de Ingestão |
|---|---|---|
| `Campanha` | `campanha` | String limpa. |
| `Fila` | `fila` | String limpa. |
| `Número de telefone` / `Telefone` | `numero_telefone_mascarado` / `numero_telefone_hash` | Aplica as regras de segurança e hashing. |
| `Sessão iniciada - Evento` | `sessao_iniciada` | Converte para timestamp PostgreSQL. |
| `Duração da fila - Total` | `duracao_fila_segundos` | Converte duração para segundos. |
| `Duração da fala - Total` | `duracao_fala_segundos` | Converte tempo de permanência na URA para segundos. |
| `Alterar nome do resultado` | `resultado_nome` | Opção digital selecionada na URA. |
| `Descrição do resultado do usuário`| `descricao_resultado` | Descrição técnica do resultado de navegação. |
| *Constante da Carga* | `usuario` | Grava sempre como `null`. |
| *Constante da Carga* | `resultado_usuario` | Grava sempre como `null`. |
| *Constante da Carga* | `tipo_relatorio` | Preenche automaticamente com `URA`. |
| *Constante da Carga* | `fonte_oficial` | Preenche `EXCEL_2025`. |

---

## 🔒 Regras de Transformação Críticas

### A. Mascaramento e Hashing de Telefone
Para proteção à LGPD (Lei Geral de Proteção de Dados), o portal **nunca** armazena números de telefone abertos no banco principal de dados:
1. **Limpeza de Caracteres**: Remove parênteses, traços, espaços e códigos extras mantendo apenas números (ex: `(11) 98501-2885` -> `11985012885`).
2. **Máscara na Interface**: Se possuir 11 dígitos (Celular), mantém os 3 primeiros, mascara 4 com asteriscos e exibe os 4 últimos (ex: `11985012885` -> `119****2885`). Se possuir 10 dígitos (Fixo), mantém os 3 primeiros, mascara 3 e exibe os 4 últimos (ex: `1138502885` -> `113****2885`).
3. **Conciliação via Hash SHA-256**: É gerado um hash criptográfico irreversível SHA-256 do telefone original limpo para permitir cruzamentos e buscas administrativas seguras em segundo plano.

### B. Duração (Tempo em Segundos)
As planilhas históricas apresentam durações em formato de string. O importador as traduz para inteiros em segundos:
- `00:10` -> `10` segundos.
- `02:31` -> `151` segundos (`2 * 60 + 31`).
- `10:31` -> `631` segundos (`10 * 60 + 31`).
- `01:05:30` -> `3930` segundos (`1 * 3600 + 5 * 60 + 30`).

O frontend do portal faz o caminho reverso, exibindo no painel o tempo em formato amigável `mm:ss` ou `hh:mm:ss` para operadores.

---

## 🚀 Comandos do CLI de Carga

No terminal da pasta `cetesb-portal`, você pode gerenciar as cargas com estes comandos:

### 1. Inspecionar Arquivos
```bash
npm run inspect:excel
```
Exibe tabelas no terminal contendo nomes de arquivos encontrados em `data/raw/`, abas internas, colunas físicas identificadas, quantidade total de linhas e intervalos de datas.

### 2. Ingestão de Dados (Supabase Real)
```bash
npm run import:excel
```
Valida chaves no `.env`, lê os arquivos físicos, calcula SHA-256, grava na auditoria, limpa dados, faz conversões pesadas e insere em lote (chunking de 1000) no banco de dados Supabase real.

### 3. Pós-Validação e Auditoria
```bash
npm run validate:data
```
Varre a base em busca de inconsistências (linhas sem data, duplicados prováveis) e reporta distribuição exata de volumes acumulados cronologicamente por mês, tipo e fonte.
