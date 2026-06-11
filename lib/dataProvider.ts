import { supabase, isSupabaseConfigured } from './supabaseClient';
import { sanitizeIlikeInput } from './formatters';
import type { EventFilter, PaginatedResult, FilterOptions, DashboardData, QualificacaoDetalhadaRow, QualificacaoDetalhadaFilters, ChamadasPorHoraFilters, ChamadasPorHoraRow } from './types';
import { logNormalizedError } from './supabaseErrors';

// Limite máximo de registros para exportação
const EXPORT_MAX_ROWS = parseInt(process.env.NEXT_PUBLIC_EXPORT_MAX_ROWS || '10000', 10);

/**
 * Consulta eventos filtrados e paginados (Atendimento ou URA)
 * Utiliza nomes de colunas puramente técnicos em minúsculas para máxima estabilidade e performance.
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

    // Aplicar filtros dinâmicos usando as colunas técnicas
    if (filters.startDate) {
      query = query.gte('sessao_iniciada', filters.startDate);
    }
    if (filters.endDate) {
      // Adiciona fim do dia
      const endLimit = `${filters.endDate}T23:59:59.999Z`;
      query = query.lte('sessao_iniciada', endLimit);
    }
    if (filters.campanha) {
      query = query.eq('campanha', filters.campanha);
    }
    if (filters.fila) {
      query = query.eq('fila', filters.fila);
    }
    if (filters.usuario && !isUra) {
      const safeUsuario = sanitizeIlikeInput(filters.usuario);
      query = query.ilike('usuario', `%${safeUsuario}%`);
    }
    if (filters.resultado) {
      const safeResultado = sanitizeIlikeInput(filters.resultado);
      if (isUra) {
        query = query.ilike('resultado_nome', `%${safeResultado}%`);
      } else {
        query = query.ilike('descricao_resultado', `%${safeResultado}%`);
      }
    }

    // Ordenação e Paginação
    const page = filters.page || 1;
    const rawPageSize = filters.pageSize || 50;
    const pageSize = Math.min(rawPageSize, EXPORT_MAX_ROWS);
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize - 1;

    query = query
      .order('sessao_iniciada', { ascending: false })
      .range(startIdx, endIdx);

    const { data, count, error } = await query;

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Normaliza a resposta mapeando as chaves
    const normalizedData = (data || []).map((r: any) => {
      if (isUra) {
        return {
          id: Math.random(), // gera ID visual dinâmico
          campanha: r.campanha,
          fila: r.fila,
          numero_telefone: r.numero_telefone,
          sessao_iniciada: r.sessao_iniciada,
          duracao_fila_segundos: r.duracao_fila_segundos,
          duracao_fala_segundos: r.duracao_fala_segundos,
          resultado_name: r.resultado_nome,
          descricao_resultado: r.descricao_resultado,
          fonte_oficial: 'CETESB 2025 - URA/Atendimento', // fallback visual legível
          status_validacao: 'VALIDADO'
        };
      } else {
        return {
          id: Math.random(),
          campanha: r.campanha,
          fila: r.fila,
          usuario: r.usuario,
          numero_telefone: r.numero_telefone,
          sessao_iniciada: r.sessao_iniciada,
          duracao_fila_segundos: r.duracao_fila_segundos,
          duracao_fala_segundos: r.duracao_fala_segundos,
          descricao_resultado: r.descricao_resultado,
          resultado_usuario: r.resultado_usuario,
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
    logNormalizedError('fetchEvents', error);
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
    logNormalizedError('fetchDashboardStats', err);
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
    logNormalizedError('fetchAuditoria', err);
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
    logNormalizedError('fetchProfiles', err);
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
    logNormalizedError('fetchFilterOptions', err);
    throw err;
  }
}

/**
 * Consulta dados consolidados de qualificação por campanha.
 * Chama a RPC get_qualificacao_detalhada_atendimento (migration 013).
 * Retorna linhas agrupadas por campanha + qualificação, com métricas de TMA.
 *
 * ATENÇÃO: Esta função é aditiva e NÃO altera fetchEvents, fetchDashboardStats
 *          nem fetchFilterOptions.
 */
export async function fetchQualificacaoDetalhada(
  filters: QualificacaoDetalhadaFilters
): Promise<QualificacaoDetalhadaRow[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('[DataProvider] Supabase não está configurado. Verifique as credenciais no .env.');
  }

  try {
    // Monta data_inicio e data_fim como timestamps ISO válidos
    const dataInicio = filters.startDate
      ? `${filters.startDate}T00:00:00`
      : (() => { throw new Error('Data inicial é obrigatória.'); })();

    const dataFim = filters.endDate
      ? `${filters.endDate}T23:59:59`
      : (() => { throw new Error('Data final é obrigatória.'); })();

    const params: Record<string, any> = {
      data_inicio: dataInicio,
      data_fim: dataFim,
      campanha_filter: filters.campanha || null,
      resultado_filter: filters.resultado ? sanitizeIlikeInput(filters.resultado) : null,
      fonte_filter: null,
      status_filter: null,
    };

    const { data, error } = await supabase!.rpc(
      'get_qualificacao_detalhada_atendimento',
      params
    );

    if (error) throw error;

    // Normaliza e tipa o retorno da RPC
    return (data || []).map((r: any): QualificacaoDetalhadaRow => ({
      campanha: r.campanha ?? '',
      tipo: r.tipo ?? 'Inbound',
      qualificacao: r.qualificacao ?? 'SEM QUALIFICAÇÃO',
      chamadas: Number(r.chamadas ?? 0),
      tma_soma_segundos: Number(r.tma_soma_segundos ?? 0),
      tma_media_segundos: Number(r.tma_media_segundos ?? 0),
      pos_atendimento_soma_segundos: Number(r.pos_atendimento_soma_segundos ?? 0),
      pos_atendimento_media_segundos: Number(r.pos_atendimento_media_segundos ?? 0),
      periodo_inicio: r.periodo_inicio ?? dataInicio,
      periodo_fim: r.periodo_fim ?? dataFim,
    }));
  } catch (err: any) {
    logNormalizedError('fetchQualificacaoDetalhada', err);
    throw err;
  }
}

/**
 * Consulta TODOS os registros para exportação de forma loteada (batches de 1.000)
 * para evitar limites de PostgREST / Supabase API Gateway.
 */
export async function fetchEventsForExport(filters: EventFilter): Promise<any[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('[DataProvider] Supabase não está configurado. Verifique as credenciais no .env.');
  }

  try {
    const isUra = filters.tipo_relatorio === 'URA';
    const viewName = isUra ? 'vw_cetesb_ura_front' : 'vw_cetesb_atendimentos_operacao_front';
    
    // Usar o limite de exportação configurado
    const limit = EXPORT_MAX_ROWS;
    const batchSize = 1000;
    let allData: any[] = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore && allData.length < limit) {
      let query = supabase!
        .from(viewName)
        .select('*');

      // Aplicar filtros dinâmicos
      if (filters.startDate) {
        query = query.gte('sessao_iniciada', `${filters.startDate}T00:00:00.000Z`);
      }
      if (filters.endDate) {
        const dateParts = filters.endDate.split('-');
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10);
          const day = parseInt(dateParts[2], 10);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const date = new Date(Date.UTC(year, month - 1, day));
            date.setUTCDate(date.getUTCDate() + 1);
            const nextDayStr = date.toISOString().split('T')[0];
            query = query.lt('sessao_iniciada', `${nextDayStr}T00:00:00.000Z`);
          } else {
            query = query.lt('sessao_iniciada', `${filters.endDate}T23:59:59.999Z`);
          }
        } else {
          query = query.lt('sessao_iniciada', `${filters.endDate}T23:59:59.999Z`);
        }
      }
      if (filters.campanha) {
        query = query.eq('campanha', filters.campanha);
      }
      if (filters.fila) {
        query = query.eq('fila', filters.fila);
      }
      if (filters.usuario && !isUra) {
        const safeUsuario = sanitizeIlikeInput(filters.usuario);
        query = query.ilike('usuario', `%${safeUsuario}%`);
      }
      if (filters.resultado) {
        const safeResultado = sanitizeIlikeInput(filters.resultado);
        if (isUra) {
          query = query.ilike('resultado_nome', `%${safeResultado}%`);
        } else {
          query = query.ilike('descricao_resultado', `%${safeResultado}%`);
        }
      }
      if (filters.fonte) {
        query = query.eq('fonte_oficial', filters.fonte);
      }
      if (filters.status) {
        query = query.eq('status_validacao', filters.status);
      }

      // Range do lote atual
      const startIdx = offset;
      const remaining = limit - allData.length;
      const currentBatchSize = Math.min(batchSize, remaining);
      const endIdx = startIdx + currentBatchSize - 1;

      query = query
        .order('sessao_iniciada', { ascending: false })
        .range(startIdx, endIdx);

      const { data, error } = await query;
      if (error) throw error;

      const batchData = data || [];
      if (batchData.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(batchData);
        offset += batchData.length;
        if (batchData.length < currentBatchSize) {
          hasMore = false;
        }
      }
    }

    // Mapear normalizando o retorno
    return allData.map((r: any) => {
      if (isUra) {
        return {
          id: Math.random(),
          campanha: r.campanha,
          fila: r.fila,
          numero_telefone: r.numero_telefone,
          sessao_iniciada: r.sessao_iniciada,
          duracao_fila_segundos: r.duracao_fila_segundos,
          duracao_fala_segundos: r.duracao_fala_segundos,
          resultado_name: r.resultado_nome,
          descricao_resultado: r.descricao_resultado,
          fonte_oficial: 'CETESB 2025 - URA/Atendimento',
          status_validacao: 'VALIDADO'
        };
      } else {
        return {
          id: Math.random(),
          campanha: r.campanha,
          fila: r.fila,
          usuario: r.usuario,
          numero_telefone: r.numero_telefone,
          sessao_iniciada: r.sessao_iniciada,
          duracao_fila_segundos: r.duracao_fila_segundos,
          duracao_fala_segundos: r.duracao_fala_segundos,
          descricao_resultado: r.descricao_resultado,
          resultado_usuario: r.resultado_usuario,
          fonte_oficial: 'CETESB 2026 - Atendimento',
          status_validacao: 'VALIDADO'
        };
      }
    });

  } catch (error: any) {
    logNormalizedError('fetchEventsForExport', error);
    throw error;
  }
}

/**
 * Consulta dados consolidados de chamadas por hora por data, campanha e fila.
 * Chama a RPC get_chamadas_por_hora.
 */
export async function fetchChamadasPorHora(
  filters: ChamadasPorHoraFilters
): Promise<ChamadasPorHoraRow[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('[DataProvider] Supabase não está configurado. Verifique as credenciais no .env.');
  }

  try {
    const dataInicio = filters.startDate
      ? `${filters.startDate}T00:00:00`
      : (() => { throw new Error('Data inicial é obrigatória.'); })();

    const dataFim = filters.endDate
      ? `${filters.endDate}T23:59:59`
      : (() => { throw new Error('Data final é obrigatória.'); })();

    const params: Record<string, any> = {
      data_inicio: dataInicio,
      data_fim: dataFim,
      campanha_filter: filters.campanha || null,
      fila_filter: filters.fila || null,
      fonte_filter: filters.fonte || null,
      status_filter: filters.status || null,
    };

    const { data, error } = await supabase!.rpc(
      'get_chamadas_por_hora',
      params
    );

    if (error) throw error;

    return (data || []).map((r: any): ChamadasPorHoraRow => ({
      data: r.data ?? '',
      campanha: r.campanha ?? '',
      midia: r.midia ?? 'Voice',
      fila: r.fila ?? '',
      hora: Number(r.hora ?? 0),
      total: Number(r.total ?? 0),
      enfileiradas: Number(r.enfileiradas ?? 0),
      em_fila: Number(r.em_fila ?? 0),
      conectadas_agente: Number(r.conectadas_agente ?? 0),
      abandonadas: Number(r.abandonadas ?? 0),
      expiradas_na_fila: Number(r.expiradas_na_fila ?? 0),
      derrubadas: Number(r.derrubadas ?? 0),
    }));
  } catch (err: any) {
    logNormalizedError('fetchChamadasPorHora', err);
    throw err;
  }
}

