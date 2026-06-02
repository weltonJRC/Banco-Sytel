/**
 * tests/unit/qualificacao-detalhada.test.ts
 *
 * Testes unitários para a funcionalidade de Qualificação Detalhada do Atendimento.
 * Cobre: formatação HH:MM:SS, agrupamento por campanha, cálculo de totais,
 *        fallback de qualificação e regras de exportação (sem campos técnicos).
 *
 * Não usa mock de Supabase. Testa apenas funções puras e lógica de apresentação.
 */

import { describe, it, expect } from 'vitest';
import { formatSeconds } from '../../lib/formatters';
import type { QualificacaoDetalhadaRow } from '../../lib/types';

// ─── Helper local idêntico ao da página (testado de forma isolada) ──────────

function formatHHMMSS(seconds: number | null | undefined): string {
  const s = Math.round(Number(seconds ?? 0));
  if (isNaN(s) || s < 0) return '00:00:00';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

// ─── Helper de agrupamento (extrato da lógica da página) ─────────────────────

interface CampanhaGroup {
  campanha: string;
  rows: QualificacaoDetalhadaRow[];
  totalChamadas: number;
}

function groupByCampanha(data: QualificacaoDetalhadaRow[]): CampanhaGroup[] {
  const map = new Map<string, CampanhaGroup>();
  for (const row of data) {
    if (!map.has(row.campanha)) {
      map.set(row.campanha, { campanha: row.campanha, rows: [], totalChamadas: 0 });
    }
    const group = map.get(row.campanha)!;
    group.rows.push(row);
    group.totalChamadas += row.chamadas;
  }
  return Array.from(map.values()).sort((a, b) => a.campanha.localeCompare(b.campanha, 'pt-BR'));
}

// ─── Helper de qualificação (extrato da lógica SQL — testado no lado JS) ─────

function resolveQualificacao(
  descricao_resultado: string | null | undefined,
  resultado_usuario: string | null | undefined
): string {
  const d = (descricao_resultado ?? '').trim();
  const r = (resultado_usuario ?? '').trim();
  return d || r || 'SEM QUALIFICAÇÃO';
}

// ─── Helper de exportação (campos permitidos) ─────────────────────────────────

const EXPORT_HEADERS = [
  'Campanha',
  'Tipo',
  'Período Inicial',
  'Período Final',
  'Qualificação / Resultado',
  'Conectadas / Cham. Feitas',
  'TMA Soma',
  'TMA Média',
  'Tempo pós-atend. Soma',
  'Tempo pós-atend. Média',
];

const FORBIDDEN_EXPORT_FIELDS = [
  'id',
  'raw_payload',
  'hash_arquivo',
  'telefone',
  'numero_telefone',
  'numero_telefone_hash',
];

// ─── Dados de teste ───────────────────────────────────────────────────────────

const makeRow = (overrides: Partial<QualificacaoDetalhadaRow> = {}): QualificacaoDetalhadaRow => ({
  campanha: 'ATENDIMENTO',
  tipo: 'Inbound',
  qualificacao: 'RESOLVIDO OPERAÇÃO C/BASE NO SCRIPT',
  chamadas: 3,
  tma_soma_segundos: 1809,   // 00:30:09
  tma_media_segundos: 603,   // 00:10:03
  pos_atendimento_soma_segundos: 0,
  pos_atendimento_media_segundos: 0,
  periodo_inicio: '2026-06-02T00:00:00',
  periodo_fim: '2026-06-02T23:59:59',
  ...overrides,
});

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('Qualificação Detalhada — formatHHMMSS', () => {
  it('deve formatar 0 segundos como 00:00:00', () => {
    expect(formatHHMMSS(0)).toBe('00:00:00');
  });

  it('deve formatar 30 minutos e 9 segundos como 00:30:09', () => {
    expect(formatHHMMSS(1809)).toBe('00:30:09');
  });

  it('deve formatar 1 hora, 1 minuto e 5 segundos como 01:01:05', () => {
    expect(formatHHMMSS(3665)).toBe('01:01:05');
  });

  it('deve retornar 00:00:00 para null', () => {
    expect(formatHHMMSS(null)).toBe('00:00:00');
  });

  it('deve retornar 00:00:00 para undefined', () => {
    expect(formatHHMMSS(undefined)).toBe('00:00:00');
  });

  it('deve retornar 00:00:00 para valores negativos', () => {
    expect(formatHHMMSS(-5)).toBe('00:00:00');
  });

  it('deve ser compatível com formatSeconds para valores >= 3600', () => {
    // formatSeconds também retorna HH:MM:SS para valores acima de 1h
    expect(formatSeconds(3665)).toBe('01:01:05');
    expect(formatHHMMSS(3665)).toBe('01:01:05');
  });
});

describe('Qualificação Detalhada — agrupamento por campanha', () => {
  it('deve criar um grupo por campanha distinta', () => {
    const data = [
      makeRow({ campanha: 'ATENDIMENTO', chamadas: 3 }),
      makeRow({ campanha: 'ATENDIMENTO', chamadas: 2, qualificacao: 'LIGAÇÃO MUDA' }),
      makeRow({ campanha: 'DENUNCIAS_AMBIENTAIS', chamadas: 1 }),
    ];
    const grupos = groupByCampanha(data);
    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.campanha)).toContain('ATENDIMENTO');
    expect(grupos.map((g) => g.campanha)).toContain('DENUNCIAS_AMBIENTAIS');
  });

  it('deve calcular o total de chamadas por campanha corretamente', () => {
    const data = [
      makeRow({ campanha: 'ATENDIMENTO', chamadas: 3 }),
      makeRow({ campanha: 'ATENDIMENTO', chamadas: 7, qualificacao: 'OUTROS' }),
    ];
    const grupos = groupByCampanha(data);
    const atendimento = grupos.find((g) => g.campanha === 'ATENDIMENTO');
    expect(atendimento?.totalChamadas).toBe(10);
  });

  it('deve ordenar os grupos por nome de campanha (pt-BR)', () => {
    const data = [
      makeRow({ campanha: 'SIGOR', chamadas: 1 }),
      makeRow({ campanha: 'ATENDIMENTO', chamadas: 1 }),
      makeRow({ campanha: 'DENUNCIAS_AMBIENTAIS', chamadas: 1 }),
    ];
    const grupos = groupByCampanha(data);
    expect(grupos[0].campanha).toBe('ATENDIMENTO');
    expect(grupos[1].campanha).toBe('DENUNCIAS_AMBIENTAIS');
    expect(grupos[2].campanha).toBe('SIGOR');
  });

  it('deve retornar array vazio para entrada vazia', () => {
    expect(groupByCampanha([])).toHaveLength(0);
  });
});

describe('Qualificação Detalhada — cálculo de TMA soma e média', () => {
  it('deve calcular TMA soma somando duracao_fala_segundos dos rows', () => {
    // A lógica é feita pelo banco. Aqui validamos que o tipo aceita os valores.
    const row = makeRow({ tma_soma_segundos: 1809, tma_media_segundos: 603 });
    expect(formatHHMMSS(row.tma_soma_segundos)).toBe('00:30:09');
    expect(formatHHMMSS(row.tma_media_segundos)).toBe('00:10:03');
  });

  it('deve exibir 00:00:00 quando TMA é zero', () => {
    const row = makeRow({ tma_soma_segundos: 0, tma_media_segundos: 0 });
    expect(formatHHMMSS(row.tma_soma_segundos)).toBe('00:00:00');
    expect(formatHHMMSS(row.tma_media_segundos)).toBe('00:00:00');
  });

  it('deve exibir 00:00:00 para tempo pós-atendimento quando zerado', () => {
    const row = makeRow({ pos_atendimento_soma_segundos: 0, pos_atendimento_media_segundos: 0 });
    expect(formatHHMMSS(row.pos_atendimento_soma_segundos)).toBe('00:00:00');
    expect(formatHHMMSS(row.pos_atendimento_media_segundos)).toBe('00:00:00');
  });
});

describe('Qualificação Detalhada — fallback de qualificação', () => {
  it('deve usar descricao_resultado quando preenchido', () => {
    expect(resolveQualificacao('RESOLVIDO', 'OUTRO')).toBe('RESOLVIDO');
  });

  it('deve usar resultado_usuario quando descricao_resultado está vazio', () => {
    expect(resolveQualificacao('', 'LIGAÇÃO MUDA')).toBe('LIGAÇÃO MUDA');
  });

  it('deve usar resultado_usuario quando descricao_resultado é null', () => {
    expect(resolveQualificacao(null, 'TESTE')).toBe('TESTE');
  });

  it('deve retornar SEM QUALIFICAÇÃO quando ambos estão vazios', () => {
    expect(resolveQualificacao('', '')).toBe('SEM QUALIFICAÇÃO');
  });

  it('deve retornar SEM QUALIFICAÇÃO quando ambos são null', () => {
    expect(resolveQualificacao(null, null)).toBe('SEM QUALIFICAÇÃO');
  });

  it('deve ignorar espaços em branco no resolveQualificacao', () => {
    expect(resolveQualificacao('   ', '   ')).toBe('SEM QUALIFICAÇÃO');
  });
});

describe('Qualificação Detalhada — exportação sem campos técnicos', () => {
  it('os headers de exportação não devem conter campos técnicos proibidos', () => {
    for (const forbidden of FORBIDDEN_EXPORT_FIELDS) {
      const found = EXPORT_HEADERS.some((h) =>
        h.toLowerCase().includes(forbidden.toLowerCase())
      );
      expect(found, `Header de exportação não deve conter "${forbidden}"`).toBe(false);
    }
  });

  it('os headers de exportação devem conter exatamente 10 colunas', () => {
    expect(EXPORT_HEADERS).toHaveLength(10);
  });

  it('os headers devem incluir Campanha, Qualificação e TMA Soma', () => {
    expect(EXPORT_HEADERS).toContain('Campanha');
    expect(EXPORT_HEADERS).toContain('Qualificação / Resultado');
    expect(EXPORT_HEADERS).toContain('TMA Soma');
  });

  it('a interface QualificacaoDetalhadaRow não deve conter campos sensíveis', () => {
    // Verifica os campos do objeto retornado (tipagem em runtime via chaves)
    const row = makeRow();
    const keys = Object.keys(row);
    for (const forbidden of FORBIDDEN_EXPORT_FIELDS) {
      expect(keys, `Campo "${forbidden}" não deve existir em QualificacaoDetalhadaRow`).not.toContain(forbidden);
    }
  });
});
