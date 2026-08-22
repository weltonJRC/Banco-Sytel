# Portal CETESB - Retencao Historica Architecture

## Status
CURRENT documentation index for the historical-retention portal stored in the repository currently named `Banco-Sytel`.

## System Boundary
The application consolidates historical records recovered from physical spreadsheets and Sytel call-center exports, validates/imports them into Supabase, exposes controlled search/filtering and allows audited exports for CETESB.

This repository is not the source of truth for CURRENT Sytel configuration or runtime behavior.

## Data Flow
Historical source file/export -> inspection -> normalization/validation -> hash/deduplication -> controlled import -> Supabase -> portal queries -> filtered export/audit.

## Core Components
- Next.js application.
- Supabase/PostgreSQL for retained historical data.
- Excel inspection/import tooling.
- Validation/audit scripts.
- Vitest-based tests.
- Export flows with configured row limits.

## Architectural Invariants
- Preserve source provenance and reporting period.
- Real import is a side effect and requires explicit environment/authorization checks.
- Deduplication/hash behavior must remain deterministic and auditable.
- Historical data is not CURRENT operational state.
- Never commit raw real spreadsheets, exports, dumps, credentials or PII-heavy logs.
- Service-role/session secrets remain server-side.
- Destructive data/schema changes require explicit rollback strategy and approval.

## Source of Truth
- GitHub: CURRENT portal/import code and versioned technical documentation.
- Google Drive: corporate documentation, evidence, retention artifacts and baselines where appropriate.
- Jira: backlog, owner, priority, status and acceptance.
- Supabase configured environment: retained data state, only when explicitly queried in the correct environment.
- ChatGPT Project: active context and analysis.

## Change Policy
Architectural/data-contract changes require design, isolated branch, applicable tests, privacy review, diff review and Pull Request. `CURRENT`, `HML`, `PRODUCAO`, `BASELINE_VALIDADO`, `HISTORICO`, `EXPERIMENTAL` and `LEGADO` are distinct states.
