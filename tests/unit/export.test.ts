import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEventsForExport } from '../../lib/dataProvider';
import { supabase } from '../../lib/supabaseClient';

// Mock do módulo supabaseClient
vi.mock('../../lib/supabaseClient', () => {
  const selectMock = vi.fn();
  const fromMock = vi.fn().mockReturnValue({ select: selectMock });
  
  return {
    isSupabaseConfigured: () => true,
    supabase: {
      from: fromMock
    }
  };
});

describe('Export functions & Paginated Batching Tests', () => {
  const fromMock = supabase!.from as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeQueryMock = (mockData: any[]) => {
    const query: any = {};
    query.select = vi.fn().mockReturnValue(query);
    query.gte = vi.fn().mockReturnValue(query);
    query.lt = vi.fn().mockReturnValue(query);
    query.eq = vi.fn().mockReturnValue(query);
    query.ilike = vi.fn().mockReturnValue(query);
    query.order = vi.fn().mockReturnValue(query);
    query.range = vi.fn().mockImplementation((start, end) => {
      const slice = mockData.slice(start, end + 1);
      return Promise.resolve({ data: slice, error: null });
    });
    return query;
  };

  it('should call supabase.from with vw_cetesb_atendimentos_operacao_front for ATENDIMENTO_OPERACAO', async () => {
    const queryMock = makeQueryMock([]);
    fromMock.mockReturnValue(queryMock);

    await fetchEventsForExport({ tipo_relatorio: 'ATENDIMENTO_OPERACAO' });
    expect(fromMock).toHaveBeenCalledWith('vw_cetesb_atendimentos_operacao_front');
  });

  it('should call supabase.from with vw_cetesb_ura_front for URA', async () => {
    const queryMock = makeQueryMock([]);
    fromMock.mockReturnValue(queryMock);

    await fetchEventsForExport({ tipo_relatorio: 'URA' });
    expect(fromMock).toHaveBeenCalledWith('vw_cetesb_ura_front');
  });

  it('should format inclusive end date correctly', async () => {
    const queryMock = makeQueryMock([]);
    fromMock.mockReturnValue(queryMock);

    await fetchEventsForExport({
      tipo_relatorio: 'ATENDIMENTO_OPERACAO',
      startDate: '2026-05-01',
      endDate: '2026-05-21'
    });

    expect(queryMock.gte).toHaveBeenCalledWith('sessao_iniciada', '2026-05-01T00:00:00.000Z');
    // A data final deve ser 2026-05-22T00:00:00.000Z (dia seguinte exclusivo)
    expect(queryMock.lt).toHaveBeenCalledWith('sessao_iniciada', '2026-05-22T00:00:00.000Z');
  });

  it('should batch fetch multiple pages if count exceeds 1000', async () => {
    // Mock 1.500 rows to trigger two batches
    const mockRows = Array.from({ length: 1500 }, (_, i) => ({
      id: i,
      campanha: 'CAMP_TEST',
      fila: 'FILA_TEST',
      usuario: 'user.test',
      numero_telefone: '11999999999',
      sessao_iniciada: '2026-05-15T10:00:00.000Z',
      duracao_fila_segundos: 10,
      duracao_fala_segundos: 120,
      descricao_resultado: 'Sucesso',
      resultado_usuario: 'Sucesso',
      fonte_oficial: 'SYTEL_2026',
      status_validacao: 'VALIDADO'
    }));

    const queryMock = makeQueryMock(mockRows);
    fromMock.mockReturnValue(queryMock);

    const result = await fetchEventsForExport({ tipo_relatorio: 'ATENDIMENTO_OPERACAO' });
    expect(result).toHaveLength(1500);
    // Deve chamar o range pelo menos duas vezes
    expect(queryMock.range).toHaveBeenCalledTimes(2);
    expect(queryMock.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(queryMock.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('should clamp export to EXPORT_MAX_ROWS (10000)', async () => {
    // Generate 12.000 mock rows
    const mockRows = Array.from({ length: 12000 }, (_, i) => ({
      id: i,
      campanha: 'CAMP_TEST',
      fila: 'FILA_TEST',
      usuario: 'user.test',
      numero_telefone: '11999999999',
      sessao_iniciada: '2026-05-15T10:00:00.000Z',
      duracao_fila_segundos: 10,
      duracao_fala_segundos: 120,
      descricao_resultado: 'Sucesso',
      resultado_usuario: 'Sucesso',
      fonte_oficial: 'SYTEL_2026',
      status_validacao: 'VALIDADO'
    }));

    const queryMock = makeQueryMock(mockRows);
    fromMock.mockReturnValue(queryMock);

    const result = await fetchEventsForExport({ tipo_relatorio: 'ATENDIMENTO_OPERACAO' });
    // Deve ter retornado exatamente 10.000 registros
    expect(result).toHaveLength(10000);
    expect(queryMock.range).toHaveBeenCalledTimes(10); // 10 batches de 1.000
  });

  it('should clean up raw/technical fields in output', async () => {
    const rawRecord = {
      id: 999,
      tenant: 'cetesb',
      campanha: 'CAMP_TEST',
      fila: 'FILA_TEST',
      usuario: 'user.test',
      numero_telefone: '11999999999',
      numero_telefone_hash: 'hash-value',
      sessao_iniciada: '2026-05-15T10:00:00.000Z',
      duracao_fila_segundos: 10,
      duracao_fala_segundos: 120,
      descricao_resultado: 'Sucesso',
      resultado_usuario: 'Sucesso',
      fonte_oficial: 'SYTEL_2026',
      status_validacao: 'VALIDADO',
      raw_payload: '{}',
      hash_arquivo: 'hash-file'
    };

    const queryMock = makeQueryMock([rawRecord]);
    fromMock.mockReturnValue(queryMock);

    const result = await fetchEventsForExport({ tipo_relatorio: 'ATENDIMENTO_OPERACAO' });
    expect(result).toHaveLength(1);
    
    const mapped = result[0];
    expect(mapped.campanha).toBe('CAMP_TEST');
    expect(mapped.fila).toBe('FILA_TEST');
    expect(mapped.usuario).toBe('user.test');
    expect(mapped.numero_telefone).toBe('11999999999');
    expect(mapped.sessao_iniciada).toBe('2026-05-15T10:00:00.000Z');
    
    // Campos técnicos devem ser removidos ou normalizados
    expect(mapped.tenant).toBeUndefined();
    expect(mapped.raw_payload).toBeUndefined();
    expect(mapped.hash_arquivo).toBeUndefined();
    expect(mapped.numero_telefone_hash).toBeUndefined();
  });
});
