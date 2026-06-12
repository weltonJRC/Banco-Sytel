import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/export-full/route';

// Mocks do auth.server e supabaseServer
vi.mock('../../lib/auth.server', () => ({
  getSessionFromCookie: vi.fn((cookieHeader) => {
    if (cookieHeader === 'valid-cookie') {
      return {
        id: 'usr-123',
        email: 'test@jrc.local',
        nome: 'Test Agent',
        perfil: 'jrc_admin',
        ativo: true
      };
    }
    return null;
  })
}));

const mockSupabaseQueryRange = vi.fn();
const mockSupabaseFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: mockSupabaseQueryRange
}));

vi.mock('../../lib/supabaseServer', () => ({
  requireSupabaseServer: () => ({
    from: mockSupabaseFrom
  })
}));

/** Helper: cria implementação de range com respostas ordenadas por lote */
function makeRangeImpl(batches: any[][]) {
  let call = 0;
  return () => {
    const idx = call++;
    if (idx < batches.length) {
      return Promise.resolve({ data: batches[idx], error: null });
    }
    return Promise.resolve({ data: [], error: null });
  };
}

describe('Exportação Completa CSV - API Route /api/export-full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar 401 se a sessão for inválida', async () => {
    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos', {
      headers: { cookie: 'invalid-cookie' }
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Sessão expirada ou inválida');
  });

  it('deve aceitar validate=true para testes rápidos de pre-flight sem consultar banco', async () => {
    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos&validate=true', {
      headers: { cookie: 'valid-cookie' }
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('deve exportar CSV com cabeçalhos corretos e formato HH:MM:SS para durações', async () => {
    const batch = Array.from({ length: 10 }, () => ({
      campanha: 'CAMP_TESTE',
      fila: 'FILA_TESTE',
      usuario: 'user.teste',
      numero_telefone: '11999999999',
      sessao_iniciada: '2026-06-01T10:00:00.000Z',
      duracao_fila_segundos: 10,   // 00:00:10 em HH:MM:SS
      duracao_fala_segundos: 60,   // 00:01:00 em HH:MM:SS
      descricao_resultado: 'Sucesso',
      resultado_usuario: 'Sucesso'
    }));

    mockSupabaseQueryRange.mockImplementation(makeRangeImpl([batch]));

    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos', {
      headers: { cookie: 'valid-cookie' }
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');

    // Verifica BOM UTF-8 (primeiros 3 bytes)
    const resClone = res.clone();
    const buffer = await resClone.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(239); // 0xEF
    expect(bytes[1]).toBe(187); // 0xBB
    expect(bytes[2]).toBe(191); // 0xBF

    const text = await res.text();
    const lines = text.split('\r\n');

    // Cabeçalho correto
    expect(lines[0]).toBe('Campanha;Fila;Usuário;Número de telefone;Sessão iniciada - Evento;Duração da fila - Total;Duração da fala - Total;Descrição do resultado do usuário;Resultado do usuário');

    // Duração da fila deve ser ="00:00:10" (protegida, não "00:10" que o Excel converte)
    expect(lines[1]).toContain('="00:00:10"');
    // Duração da fala deve ser ="00:01:00" (não "01:00")
    expect(lines[1]).toContain('="00:01:00"');
  });

  it('deve proteger telefone com zeros à esquerda usando ="valor"', async () => {
    const record = {
      campanha: 'CAMP_TESTE',
      fila: 'FILA_TESTE',
      usuario: 'user.teste',
      numero_telefone: '00551432371091', // virava 5,51432E+11 no Excel
      sessao_iniciada: '2025-05-05T10:25:41.000Z',
      duracao_fila_segundos: 5,
      duracao_fala_segundos: 2419, // 00:40:19
      descricao_resultado: 'Resolvido',
      resultado_usuario: 'Resolvido'
    };

    mockSupabaseQueryRange.mockImplementation(makeRangeImpl([[record]]));

    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos', {
      headers: { cookie: 'valid-cookie' }
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const text = await res.text();
    const lines = text.split('\r\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const dataLine = lines[1];

    // Telefone deve estar protegido com ="00551432371091"
    expect(dataLine).toContain('="00551432371091"');
    // Não pode aparecer como notação científica
    expect(dataLine).not.toContain('5.51432E+11');
    expect(dataLine).not.toContain('5,51432E+11');

    // Duração 2419s = 40min 19s deve ser ="00:40:19"
    expect(dataLine).toContain('="00:40:19"');
    expect(dataLine).not.toContain('"40:19"');
  });

  it('deve proteger os três telefones problemáticos identificados na validação', async () => {
    const records = [
      {
        campanha: 'CAMP', fila: 'FILA', usuario: 'u',
        numero_telefone: '00551432371091',
        sessao_iniciada: '2025-05-05T10:00:00.000Z',
        duracao_fila_segundos: 0, duracao_fala_segundos: 0,
        descricao_resultado: '-', resultado_usuario: '-'
      },
      {
        campanha: 'CAMP', fila: 'FILA', usuario: 'u',
        numero_telefone: '01511983701595',
        sessao_iniciada: '2025-05-05T10:00:00.000Z',
        duracao_fila_segundos: 0, duracao_fala_segundos: 0,
        descricao_resultado: '-', resultado_usuario: '-'
      },
      {
        campanha: 'CAMP', fila: 'FILA', usuario: 'u',
        numero_telefone: '011993696380',
        sessao_iniciada: '2025-05-05T10:00:00.000Z',
        duracao_fila_segundos: 0, duracao_fala_segundos: 0,
        descricao_resultado: '-', resultado_usuario: '-'
      }
    ];

    mockSupabaseQueryRange.mockImplementation(makeRangeImpl([records]));

    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos', {
      headers: { cookie: 'valid-cookie' }
    });

    const res = await GET(req);
    const text = await res.text();

    // Todos os três telefones devem aparecer protegidos
    expect(text).toContain('="00551432371091"');
    expect(text).toContain('="01511983701595"');
    expect(text).toContain('="011993696380"');

    // Nenhum deve aparecer sem proteção (nu no CSV)
    expect(text).not.toMatch(/;00551432371091;/);
    expect(text).not.toMatch(/;01511983701595;/);
    expect(text).not.toMatch(/;011993696380;/);
  });

  it('deve validar todos os casos de duração obrigatórios', async () => {
    const records = [
      { ...baseRecord(), duracao_fila_segundos: 40,   duracao_fala_segundos: 40   }, // 00:00:40
      { ...baseRecord(), duracao_fila_segundos: 345,  duracao_fala_segundos: 345  }, // 00:05:45
      { ...baseRecord(), duracao_fila_segundos: 2419, duracao_fala_segundos: 2419 }, // 00:40:19
      { ...baseRecord(), duracao_fila_segundos: 3723, duracao_fala_segundos: 3723 }, // 01:02:03
    ];

    mockSupabaseQueryRange.mockImplementation(makeRangeImpl([records]));

    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos', {
      headers: { cookie: 'valid-cookie' }
    });

    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain('="00:00:40"');
    expect(text).toContain('="00:05:45"');
    expect(text).toContain('="00:40:19"');
    expect(text).toContain('="01:02:03"');

    // Formatos incorretos não devem aparecer
    expect(text).not.toContain(';40:19;');
    expect(text).not.toContain(';40:00;');
  });

  it('deve usar a view e colunas corretas para URA sem incluir campos proibidos', async () => {
    const recordUra = {
      campanha: 'URA_TESTE',
      fila: 'FILA_URA',
      numero_telefone: '11977777777',
      sessao_iniciada: '2026-06-02T14:30:00.000Z',
      duracao_fila_segundos: 5,
      duracao_fala_segundos: 20,
      resultado_nome: 'Abandonado',
      descricao_resultado: 'Cliente desligou'
    };

    const selectMock = vi.fn().mockReturnThis();

    mockSupabaseFrom.mockReturnValueOnce({
      select: selectMock,
      order: vi.fn().mockReturnThis(),
      range: makeRangeImpl([[recordUra]])
    } as any);

    const req = new NextRequest('http://localhost/api/export-full?reportType=ura', {
      headers: { cookie: 'valid-cookie' }
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    // Verifica view e colunas corretas para URA
    expect(mockSupabaseFrom).toHaveBeenCalledWith('vw_cetesb_ura_front');
    expect(selectMock).toHaveBeenCalledWith(
      'campanha,fila,numero_telefone,sessao_iniciada,duracao_fila_segundos,duracao_fala_segundos,resultado_nome,descricao_resultado'
    );

    const text = await res.text();
    const lines = text.split('\r\n');

    // Cabeçalho URA correto
    expect(lines[0]).toBe('Campanha;Fila;Número de telefone;Sessão iniciada - Evento;Duração da fila - Total;Duração da fala - Total;Resultado;Descrição do resultado do usuário');

    // Campos proibidos não devem aparecer
    const forbidden = ['id', 'raw_payload', 'hash_arquivo', 'tenant', 'status_validacao', 'numero_telefone_hash'];
    for (const field of forbidden) {
      expect(lines[0].toLowerCase()).not.toContain(field.toLowerCase());
    }
  });

  it('deve realizar exportação sem limite de registros (streaming paginado)', async () => {
    // 2 lotes completos (1000 cada) + 1 parcial (300) = 2300 registros totais
    const batch1 = Array.from({ length: 1000 }, () => baseRecord());
    const batch2 = Array.from({ length: 1000 }, () => baseRecord());
    const batch3 = Array.from({ length: 300 },  () => baseRecord());

    // batch3 tem menos de 1000 — sinaliza fim do streaming
    mockSupabaseQueryRange.mockImplementation(makeRangeImpl([batch1, batch2, batch3]));

    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos', {
      headers: { cookie: 'valid-cookie' }
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const text = await res.text();
    const lines = text.split('\r\n');
    // 1 linha de cabeçalho + 2300 linhas de dados = 2301
    expect(lines.length).toBe(2301);
  });

  it('deve tratar data final como inclusiva adicionando 1 dia no filtro LT', async () => {
    const selectMock = vi.fn().mockReturnThis();
    const gteMock = vi.fn().mockReturnThis();
    const ltMock = vi.fn().mockReturnThis();
    const orderMock = vi.fn().mockReturnThis();

    mockSupabaseFrom.mockReturnValueOnce({
      select: selectMock,
      gte: gteMock,
      lt: ltMock,
      order: orderMock,
      range: makeRangeImpl([[]])
    } as any);

    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos&startDate=2025-01-01&endDate=2026-05-31', {
      headers: { cookie: 'valid-cookie' }
    });

    await GET(req);

    expect(gteMock).toHaveBeenCalledWith('sessao_iniciada', '2025-01-01 00:00:00');
    expect(ltMock).toHaveBeenCalledWith('sessao_iniciada', '2026-06-01 00:00:00');
  });
});

// Helper para criar registro base de atendimento
function baseRecord() {
  return {
    campanha: 'CAMP_TESTE',
    fila: 'FILA_TESTE',
    usuario: 'user.teste',
    numero_telefone: '11999999999',
    sessao_iniciada: '2026-06-01T10:00:00.000Z',
    duracao_fila_segundos: 10,
    duracao_fala_segundos: 60,
    descricao_resultado: 'Sucesso',
    resultado_usuario: 'Sucesso'
  };
}
