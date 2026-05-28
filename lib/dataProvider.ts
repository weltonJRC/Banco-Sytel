import { supabase, isSupabaseConfigured } from './supabaseClient';
import { sanitizeIlikeInput } from './formatters';
import type { EventFilter, PaginatedResult, FilterOptions, DashboardData } from './types';

// Limite máximo de registros para exportação
const EXPORT_MAX_ROWS = parseInt(process.env.NEXT_PUBLIC_EXPORT_MAX_ROWS || '10000', 10);

/**
 * Consulta eventos filtrados e paginados (Atendimento ou URA)
 * Apenas conecta ao Supabase real. Lança erros explícitos em caso de falha.
 */
export async function fetchEvents(filters: EventFilter): Promise<PaginatedResult<any>> {
  if (!isSupabaseConfigured()) {
    throw new Error('[DataProvider] Supabase não está configurado. Verifique as credenciais no .env.');
  }

  try {
    const isUra = filters.tipo_relatorio === 'URA';
    const viewName = isUra ? 'vw_cetesb_ura_front' : 'vw_cetesb_atendimentos_operacao_front';
    let query = supabase!
      .from(viewName)
      .select('*', { count: 'exact' });

    // Aplicar filtros dinâmicos usando as novas colunas mapeadas na view
    if (filters.startDate) {
      query = query.gte('Sessão iniciada - Evento', filters.startDate);
    }
    if (filters.endDate) {
      // Adiciona fim do dia
      const endLimit = `${filters.endDate}T23:59:59.999Z`;
      query = query.lte('Sessão iniciada - Evento', endLimit);
    }
    if (filters.campanha) {
      query = query.eq('Campanha', filters.campanha);
    }
    if (filters.fila) {
      query = query.eq('Fila', filters.fila);
    }
    if (filters.usuario && !isUra) {
      const safeUsuario = sanitizeIlikeInput(filters.usuario);
      query = query.ilike('Usuário', `%${safeUsuario}%`);
    }
    if (filters.resultado) {
      const safeResultado = sanitizeIlikeInput(filters.resultado);
      if (isUra) {
        query = query.ilike('Resultado', `%${safeResultado}%`);
      } else {
        query = query.ilike('Descrição do resultado do usuário', `%${safeResultado}%`);
      }
    }

    // Ordenação e Paginação
    const page = filters.page || 1;
    const rawPageSize = filters.pageSize || 50;
    const pageSize = Math.min(rawPageSize, EXPORT_MAX_ROWS);
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize - 1;

    query = query
      .order('Sessão iniciada - Evento', { ascending: false })
      .range(startIdx, endIdx);

    const { data, count, error } = await query;

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Normaliza a resposta mapeando as chaves em Português de volta para o padrão lowercase do front
    const normalizedData = (data || []).map((r: any) => {
      if (isUra) {
        return {
          id: Math.random(), // gera ID visual dinâmico
          campanha: r['Campanha'],
          fila: r['Fila'],
          numero_telefone: r['Número de telefone'],
          sessao_iniciada: r['Sessão iniciada - Evento'],
          duracao_fila_segundos: r['Duração da fila - Total'],
          duracao_fala_segundos: r['Duração da fala - Total'],
          resultado_name: r['Resultado'],
          descricao_resultado: r['Descrição do resultado do usuário'],
          fonte_oficial: 'CETESB 2025 - URA/Atendimento', // fallback visual legível
          status_validacao: 'VALIDADO'
        };
      } else {
        return {
          id: Math.random(),
          campanha: r['Campanha'],
          fila: r['Fila'],
          usuario: r['Usuário'],
          numero_telefone: r['Número de telefone'],
          sessao_iniciada: r['Sessão iniciada - Evento'],
          duracao_fila_segundos: r['Duração da fila - Total'],
          duracao_fala_segundos: r['Duração da fala - Total'],
          descricao_resultado: r['Descrição do resultado do usuário'],
          resultado_usuario: r['Resultado do usuário'],
          fonte_oficial: 'CETESB 2026 - Atendimento',
          status_validacao: 'VALIDADO'
        };
      }
    });

    return {
      data: normalizedData,
      total,
      page,
      pageSize,
      totalPages
    };
  } catch (error: any) {
    console.error('[DataProvider Error] Erro ao consultar Supabase em fetchEvents:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }
}

/**
 * Consulta estatísticas reais para preencher o Dashboard.
 * Utiliza RPCs nativas no Supabase para alta performance.
 */
export async function fetchDashboardStats(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) {
    throw new Error('[DataProvider] Supabase não está configurado. Verifique as credenciais no .env.');
  }

  try {
    // 1. Executa as chamadas de RPCs do Dashboard em paralelo
    const [totalsRes, sourceRes, lastImportRes] = await Promise.all([
      supabase!.rpc('get_dashboard_totals'),
      supabase!.rpc('get_dashboard_source_summary'),
      supabase!.from('import_files').select('imported_at').order('imported_at', { ascending: false }).limit(1)
    ]);

    if (totalsRes.error) throw totalsRes.error;
    if (sourceRes.error) throw sourceRes.error;
    if (lastImportRes.error) throw lastImportRes.error;

    const totals = totalsRes.data?.[0] || {
      total_registros: 0,
      total_atendimentos: 0,
      total_ura: 0,
      primeira_data: new Date().toISOString(),
      ultima_data: new Date().toISOString()
    };

    // Mapeamento resiliente de fontes amigáveis obtido a partir da RPC get_dashboard_source_summary
    const fontesMap = {
      EXCEL_2025: 0,
      SYTEL_2026: 0
    };

    (sourceRes.data || []).forEach((s: any) => {
      const label = s.fonte_exibicao || '';
      if (label.includes('2025')) {
        fontesMap.EXCEL_2025 = Number(s.total || 0);
      } else if (label.includes('2026')) {
        fontesMap.SYTEL_2026 = Number(s.total || 0);
      }
    });

    const lastImport = lastImportRes.data?.[0]?.imported_at || new Date().toISOString();

    // 2. Cobertura mensal via get_dashboard_monthly_summary (com fallback para get_monthly_summary)
    let monthlyData: any[] = [];
    let monthlyRes = await supabase!.rpc('get_dashboard_monthly_summary');
    
    if (monthlyRes.error) {
      // Se falhar (ex: migração não rodou ainda), faz fallback amigável para get_monthly_summary
      const fallbackRes = await supabase!.rpc('get_monthly_summary');
      if (fallbackRes.error) {
        throw fallbackRes.error;
      }
      monthlyData = fallbackRes.data || [];
    } else {
      monthlyData = monthlyRes.data || [];
    }

    const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const grouped: Record<string, { mes: string; total: number; atendimentos: number; ura: number }> = {};
    
    monthlyData.forEach((r: any) => {
      const key = `${r.ano}-${r.mes.toString().padStart(2, '0')}`;
      const label = `${nomeMeses[r.mes - 1]}/${r.ano.toString().substring(2)}`;
      if (!grouped[key]) grouped[key] = { mes: label, total: 0, atendimentos: 0, ura: 0 };
      grouped[key].total += Number(r.total);
      if (r.tipo === 'ATENDIMENTO_OPERACAO') grouped[key].atendimentos += Number(r.total);
      else grouped[key].ura += Number(r.total);
    });

    const monthlyCoverage = Object.keys(grouped).sort().map(k => grouped[k]);

    return {
      totalRecords: Number(totals.total_registros || 0),
      totalAtendimentos: Number(totals.total_atendimentos || 0),
      totalUra: Number(totals.total_ura || 0),
      periodoInicio: totals.primeira_data || new Date().toISOString(),
      periodoFim: totals.ultima_data || new Date().toISOString(),
      fontes: fontesMap,
      ultimaImportacao: lastImport,
      monthlyCoverage
    };
  } catch (err: any) {
    console.error('[DataProvider Error] Erro ao consultar RPCs do Dashboard:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint
    });
    throw err;
  }
}

/**
 * Consulta dados reais da tela de Auditoria
 */
export async function fetchAuditoria(): Promise<any[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('[DataProvider] Supabase não está configurado. Verifique as credenciais no .env.');
  }

  try {
    const { data, error } = await supabase!
      .from('vw_cetesb_auditoria')
      .select('*');

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error('[DataProvider Error] Erro ao consultar Auditoria no Supabase:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint
    });
    throw err;
  }
}

/**
 * Consulta lista de usuários reais (Profiles)
 */
export async function fetchProfiles(): Promise<any[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('[DataProvider] Supabase não está configurado. Verifique as credenciais no .env.');
  }

  try {
    const { data, error } = await supabase!
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error('[DataProvider Error] Erro ao consultar Perfis no Supabase:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint
    });
    throw err;
  }
}

/**
 * Retorna as opções únicas reais para preenchimento dos filtros.
 * Utiliza RPC otimizada do banco.
 */
export async function fetchFilterOptions(tipo?: 'ATENDIMENTO_OPERACAO' | 'URA'): Promise<FilterOptions> {
  if (!isSupabaseConfigured()) {
    throw new Error('[DataProvider] Supabase não está configurado. Verifique as credenciais no .env.');
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase!.rpc('get_filter_options', {
      report_type: tipo || null
    });

    if (rpcError) throw rpcError;

    if (rpcData) {
      return {
        campanhas: rpcData.campanhas || [],
        filas: rpcData.filas || [],
        usuarios: rpcData.usuarios || [],
        fontes: ['EXCEL_2025', 'SYTEL_2026'],
        statuses: ['VALIDADO', 'PENDENTE', 'DIVERGENTE']
      };
    }

    // Fallback estrutural caso não retorne data
    return {
      campanhas: [],
      filas: [],
      usuarios: [],
      fontes: ['EXCEL_2025', 'SYTEL_2026'],
      statuses: ['VALIDADO', 'PENDENTE', 'DIVERGENTE']
    };
  } catch (err: any) {
    console.error('[DataProvider Error] Erro ao carregar opções de filtros do Supabase:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint
    });
    throw err;
  }
}
