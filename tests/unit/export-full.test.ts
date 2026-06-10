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

  it('deve realizar a exportação completa chamando múltiplos lotes até o lote ser menor que 1000', async () => {
    // Primeiro lote com 1000 registros, segundo com 300 registros.
    const batch1 = Array.from({ length: 1000 }, (_, i) => ({
      campanha: 'CAMP_TESTE',
      fila: 'FILA_TESTE',
      usuario: 'user.teste',
      numero_telefone: '11999999999',
      sessao_iniciada: '2026-06-01T10:00:00.000Z',
      duracao_fila_segundos: 10,
      duracao_fala_segundos: 60,
      descricao_resultado: 'Sucesso',
      resultado_usuario: 'Sucesso'
    }));
    const batch2 = Array.from({ length: 300 }, (_, i) => ({
      campanha: 'CAMP_TESTE2',
      fila: 'FILA_TESTE2',
      usuario: 'user.teste2',
      numero_telefone: '11988888888',
      sessao_iniciada: '2026-06-01T11:00:00.000Z',
      duracao_fila_segundos: 15,
      duracao_fala_segundos: 45,
      descricao_resultado: 'Muda',
      resultado_usuario: 'Muda'
    }));

    mockSupabaseQueryRange
      .mockResolvedValueOnce({ data: batch1, error: null })
      .mockResolvedValueOnce({ data: batch2, error: null });

    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos', {
      headers: { cookie: 'valid-cookie' }
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="cetesb-atendimentos-completo-inicio-a-fim.csv"');

    // Verifica presença do BOM \uFEFF na resposta bruta (primeiros 3 bytes UTF-8 BOM)
    const resClone = res.clone();
    const buffer = await resClone.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(239); // 0xEF
    expect(bytes[1]).toBe(187); // 0xBB
    expect(bytes[2]).toBe(191); // 0xBF

    const text = await res.text();
    const lines = text.split('\r\n');
    // Headers + 1300 records = 1301 lines
    expect(lines.length).toBe(1301);

    // Verifica cabeçalhos corretos
    expect(lines[0]).toBe('Campanha;Fila;Usuário;Número de telefone;Sessão iniciada - Evento;Duração da fila - Total;Duração da fala - Total;Descrição do resultado do usuário;Resultado do usuário');
    // Verifica primeiro registro
    expect(lines[1]).toBe('CAMP_TESTE;FILA_TESTE;user.teste;11999999999;01/06/2026 07:00:00;00:10;01:00;Sucesso;Sucesso');
  });

  it('deve tratar data final como inclusiva adicionando 1 dia no filtro LT', async () => {
    mockSupabaseQueryRange.mockResolvedValue({ data: [], error: null });
    const selectMock = vi.fn().mockReturnThis();
    const gteMock = vi.fn().mockReturnThis();
    const ltMock = vi.fn().mockReturnThis();
    const orderMock = vi.fn().mockReturnThis();

    mockSupabaseFrom.mockReturnValueOnce({
      select: selectMock,
      gte: gteMock,
      lt: ltMock,
      order: orderMock,
      range: mockSupabaseQueryRange
    } as any);

    const req = new NextRequest('http://localhost/api/export-full?reportType=atendimentos&startDate=2025-01-01&endDate=2026-05-31', {
      headers: { cookie: 'valid-cookie' }
    });

    await GET(req);

    // GTE recebe 2025-01-01 00:00:00
    expect(gteMock).toHaveBeenCalledWith('sessao_iniciada', '2025-01-01 00:00:00');
    // LT recebe 2026-06-01 00:00:00 (endDate 2026-05-31 + 1 dia)
    expect(ltMock).toHaveBeenCalledWith('sessao_iniciada', '2026-06-01 00:00:00');
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

    mockSupabaseQueryRange.mockResolvedValueOnce({ data: [recordUra], error: null });
    const selectMock = vi.fn().mockReturnThis();

    mockSupabaseFrom.mockReturnValueOnce({
      select: selectMock,
      order: vi.fn().mockReturnThis(),
      range: mockSupabaseQueryRange
    } as any);

    const req = new NextRequest('http://localhost/api/export-full?reportType=ura', {
      headers: { cookie: 'valid-cookie' }
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    // Verifica colunas selecionadas para a URA
    expect(mockSupabaseFrom).toHaveBeenCalledWith('vw_cetesb_ura_front');
    expect(selectMock).toHaveBeenCalledWith('campanha,fila,numero_telefone,sessao_iniciada,duracao_fila_segundos,duracao_fala_segundos,resultado_nome,descricao_resultado');

    // Verifica presença do BOM \uFEFF na resposta bruta (primeiros 3 bytes UTF-8 BOM)
    const resClone = res.clone();
    const buffer = await resClone.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(239);
    expect(bytes[1]).toBe(187);
    expect(bytes[2]).toBe(191);

    const text = await res.text();
    const lines = text.split('\r\n');
    expect(lines[0]).toBe('Campanha;Fila;Número de telefone;Sessão iniciada - Evento;Duração da fila - Total;Duração da fala - Total;Resultado;Descrição do resultado do usuário');
    expect(lines[1]).toBe('URA_TESTE;FILA_URA;11977777777;02/06/2026 11:30:00;00:05;00:20;Abandonado;Cliente desligou');

    // Verifica se campos proibidos não estão no cabeçalho ou nas linhas
    const forbidden = ['id', 'raw_payload', 'hash_arquivo', 'tenant', 'status_validacao', 'numero_telefone_hash'];
    for (const field of forbidden) {
      expect(lines[0].toLowerCase()).not.toContain(field.toLowerCase());
      expect(lines[1].toLowerCase()).not.toContain(field.toLowerCase());
    }
  });
});
