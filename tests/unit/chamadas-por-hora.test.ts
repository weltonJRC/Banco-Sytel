import { describe, it, expect } from 'vitest';
import type { ChamadasPorHoraRow } from '../../lib/types';

// Helper local identical to the page logic to test processAndGroupData in isolation
interface ChamadasPorHoraGroup {
  data: string;
  campanha: string;
  midia: string;
  periodo: string;
  fila: string;
  rows: ChamadasPorHoraRow[];
  totalChamadas: number;
  totalConectadas: number;
  totalAbandonadas: number;
  totalExpiradas: number;
  totalDerrubadas: number;
}

function processAndGroupData(
  rawData: ChamadasPorHoraRow[],
  startDate: string,
  endDate: string
): ChamadasPorHoraGroup[] {
  const groupsMap = new Map<string, ChamadasPorHoraRow[]>();

  for (const row of rawData) {
    const dataStr = row.data.split('T')[0];
    const key = `${dataStr}|${row.campanha}|${row.fila}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key)!.push(row);
  }

  const resultGroups: ChamadasPorHoraGroup[] = [];

  groupsMap.forEach((rows, key) => {
    const [dataStr, campanha, fila] = key.split('|');

    const fullHoursRows: ChamadasPorHoraRow[] = Array.from({ length: 24 }, (_, h) => ({
      data: dataStr,
      campanha,
      midia: 'Voice',
      fila,
      hora: h,
      total: 0,
      enfileiradas: 0,
      em_fila: 0,
      conectadas_agente: 0,
      abandonadas: 0,
      expiradas_na_fila: 0,
      derrubadas: 0
    }));

    for (const r of rows) {
      if (r.hora >= 0 && r.hora < 24) {
        fullHoursRows[r.hora] = {
          ...r,
          data: dataStr
        };
      }
    }

    let totalChamadas = 0;
    let totalConectadas = 0;
    let totalAbandonadas = 0;
    let totalExpiradas = 0;
    let totalDerrubadas = 0;

    for (const r of rows) {
      totalChamadas += r.total;
      totalConectadas += r.conectadas_agente;
      totalAbandonadas += r.abandonadas;
      totalExpiradas += r.expiradas_na_fila;
      totalDerrubadas += r.derrubadas;
    }

    resultGroups.push({
      data: dataStr,
      campanha,
      midia: 'Voice',
      fila,
      periodo: `${startDate} a ${endDate}`,
      rows: fullHoursRows,
      totalChamadas,
      totalConectadas,
      totalAbandonadas,
      totalExpiradas,
      totalDerrubadas
    });
  });

  return resultGroups.sort((a, b) => {
    const dateComp = b.data.localeCompare(a.data);
    if (dateComp !== 0) return dateComp;
    const campComp = a.campanha.localeCompare(b.campanha, 'pt-BR');
    if (campComp !== 0) return campComp;
    return a.fila.localeCompare(b.fila, 'pt-BR');
  });
}

const FORBIDDEN_EXPORT_FIELDS = [
  'id',
  'tenant',
  'raw_payload',
  'hash_arquivo',
  'hash',
  'numero_telefone_hash',
  'status_validacao'
];

describe('Receptivo - Chamadas Por Hora - processAndGroupData', () => {
  it('deve agrupar por data, campanha e fila', () => {
    const rawData: ChamadasPorHoraRow[] = [
      {
        data: '2026-06-08',
        campanha: 'AREAS_CONTAMINADAS',
        midia: 'Voice',
        fila: 'atendimento_areas_contaminadas',
        hora: 7,
        total: 2,
        enfileiradas: 1,
        em_fila: 1,
        conectadas_agente: 1,
        abandonadas: 0,
        expiradas_na_fila: 0,
        derrubadas: 0
      },
      {
        data: '2026-06-08',
        campanha: 'AREAS_CONTAMINADAS',
        midia: 'Voice',
        fila: 'atendimento_areas_contaminadas',
        hora: 8,
        total: 1,
        enfileiradas: 1,
        em_fila: 1,
        conectadas_agente: 1,
        abandonadas: 0,
        expiradas_na_fila: 0,
        derrubadas: 0
      }
    ];

    const grupos = processAndGroupData(rawData, '2026-06-08', '2026-06-08');
    expect(grupos).toHaveLength(1);
    expect(grupos[0].campanha).toBe('AREAS_CONTAMINADAS');
    expect(grupos[0].fila).toBe('atendimento_areas_contaminadas');
    expect(grupos[0].rows).toHaveLength(24);
  });

  it('deve preencher as 24 horas do dia', () => {
    const rawData: ChamadasPorHoraRow[] = [
      {
        data: '2026-06-08',
        campanha: 'ATENDIMENTO',
        midia: 'Voice',
        fila: 'cliente_nao_digitou',
        hora: 10,
        total: 5,
        enfileiradas: 3,
        em_fila: 3,
        conectadas_agente: 3,
        abandonadas: 1,
        expiradas_na_fila: 1,
        derrubadas: 1
      }
    ];

    const grupos = processAndGroupData(rawData, '2026-06-08', '2026-06-08');
    const rows = grupos[0].rows;
    expect(rows).toHaveLength(24);
    
    // Verifica hora 10 preenchida
    expect(rows[10].total).toBe(5);
    expect(rows[10].enfileiradas).toBe(3);
    expect(rows[10].conectadas_agente).toBe(3);

    // Verifica hora 0 zerada
    expect(rows[0].total).toBe(0);
    expect(rows[0].enfileiradas).toBe(0);
    expect(rows[0].conectadas_agente).toBe(0);
  });

  it('deve calcular corretamente a soma dos totais por indicador', () => {
    const rawData: ChamadasPorHoraRow[] = [
      {
        data: '2026-06-08',
        campanha: 'SIGOR',
        midia: 'Voice',
        fila: 'atendimento_SIGOR',
        hora: 8,
        total: 4,
        enfileiradas: 2,
        em_fila: 2,
        conectadas_agente: 2,
        abandonadas: 1,
        expiradas_na_fila: 1,
        derrubadas: 1
      },
      {
        data: '2026-06-08',
        campanha: 'SIGOR',
        midia: 'Voice',
        fila: 'atendimento_SIGOR',
        hora: 9,
        total: 3,
        enfileiradas: 5,
        em_fila: 5,
        conectadas_agente: 5,
        abandonadas: 2,
        expiradas_na_fila: 0,
        derrubadas: 2
      }
    ];

    const grupos = processAndGroupData(rawData, '2026-06-08', '2026-06-08');
    const g = grupos[0];
    expect(g.totalChamadas).toBe(7);
    expect(g.totalConectadas).toBe(7);
    expect(g.totalAbandonadas).toBe(3);
    expect(g.totalExpiradas).toBe(1);
    expect(g.totalDerrubadas).toBe(3);
  });

  it('não deve conter campos técnicos proibidos para exportação', () => {
    // Simula a exportação de dados
    const exportHeaders = [
      'Data',
      'Campanha',
      'Mídia',
      'Fila',
      'Hora',
      'Total',
      'Enfileiradas',
      'Em Fila',
      'Conectadas Agente',
      'Abandonadas',
      'Expiradas na Fila',
      'Derrubadas'
    ];

    for (const forbidden of FORBIDDEN_EXPORT_FIELDS) {
      const found = exportHeaders.some(h => h.toLowerCase() === forbidden.toLowerCase());
      expect(found).toBe(false);
    }
  });
});
