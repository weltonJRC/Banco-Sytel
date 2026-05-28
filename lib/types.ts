/**
 * Tipos centralizados do Portal CETESB - Retenção Histórica
 * Todas as interfaces compartilhadas entre lib, components e pages.
 */

// ─── Autenticação ───────────────────────────────────────────

export interface UserSession {
  id: string;
  email: string;
  nome: string;
  perfil: UserRole;
  ativo: boolean;
}

export type UserRole =
  | 'jrc_admin'
  | 'jrc_operacao'
  | 'jrc_auditoria'
  | 'cetesb_consulta'
  | 'cetesb_gestao';

// ─── Filtros e Paginação ────────────────────────────────────

export interface EventFilter {
  tipo_relatorio?: 'ATENDIMENTO_OPERACAO' | 'URA';
  startDate?: string;
  endDate?: string;
  campanha?: string;
  fila?: string;
  usuario?: string;
  resultado?: string;
  fonte?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterOptions {
  campanhas: string[];
  filas: string[];
  usuarios: string[];
  fontes: string[];
  statuses: string[];
}

// ─── Modelos de Dados ───────────────────────────────────────

export interface EventRow {
  id: number;
  tenant: string;
  tipo_relatorio: 'ATENDIMENTO_OPERACAO' | 'URA';
  fonte_oficial: 'EXCEL_2025' | 'SYTEL_2026';
  arquivo_origem: string;
  hash_arquivo: string;
  status_validacao: 'VALIDADO' | 'PENDENTE' | 'DIVERGENTE' | 'ERRO';
  campanha: string;
  fila: string;
  usuario: string | null;
  numero_telefone: string;
  numero_telefone_hash?: string;
  sessao_iniciada: string;
  duracao_fila_segundos: number;
  duracao_fala_segundos: number;
  resultado_nome: string | null;
  descricao_resultado: string;
  resultado_usuario: string | null;
  created_at?: string;
}

export interface UraRow {
  id: number;
  campanha: string;
  fila: string;
  numero_telefone: string;
  sessao_iniciada: string;
  duracao_fila_segundos: number;
  duracao_fala_segundos: number;
  resultado_nome: string;
  descricao_resultado: string;
  fonte_oficial: string;
  status_validacao: string;
}

export interface AuditFile {
  id: number;
  source_system: string;
  source_type: string;
  file_name: string;
  file_hash_sha256: string;
  reference_start_date: string;
  reference_end_date: string;
  imported_at: string;
  imported_by: string;
  import_status: string;
  total_rows: number;
  notes: string;
}

export interface ProfileRow {
  id: string;
  nome: string;
  email: string;
  perfil: UserRole;
  ativo: boolean;
  created_at: string;
}

// ─── Dashboard ──────────────────────────────────────────────

export interface MonthlyCoverage {
  mes: string;
  total: number;
  atendimentos: number;
  ura: number;
}

export interface DashboardData {
  totalRecords: number;
  totalAtendimentos: number;
  totalUra: number;
  periodoInicio: string;
  periodoFim: string;
  fontes: {
    EXCEL_2025: number;
    SYTEL_2026: number;
  };
  ultimaImportacao: string;
  monthlyCoverage: MonthlyCoverage[];
}

// ─── Validação ──────────────────────────────────────────────

export interface ValidationIssue {
  id: number | string;
  tipo_relatorio: string;
  campanha: string;
  fila: string;
  sessao_iniciada: string;
  issue_type: 'MISSING_DATE' | 'MISSING_CAMPAGNA' | 'PROBABLE_DUPLICATE';
  description: string;
}
