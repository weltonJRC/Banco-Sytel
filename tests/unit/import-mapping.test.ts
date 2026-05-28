import { describe, it, expect } from 'vitest';

describe('Excel Mapping & Classification Tests', () => {
  // Simula a função auxiliar do import-excel.ts para testar a resiliência
  const getField = (row: any, keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined) return row[key];
      // Tenta achar com espaços extras ou variação de case
      const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === key.toLowerCase());
      if (foundKey) return row[foundKey];
    }
    return null;
  };

  describe('getField Resilient Key Extraction', () => {
    it('should extract fields exact case', () => {
      const row = { 'Campanha': 'CETESB_EMERGENCY' };
      expect(getField(row, ['Campanha'])).toBe('CETESB_EMERGENCY');
    });

    it('should extract fields case insensitive', () => {
      const row = { 'campanha': 'CETESB_EMERGENCY' };
      expect(getField(row, ['Campanha'])).toBe('CETESB_EMERGENCY');
    });

    it('should extract fields with extra spaces', () => {
      const row = { ' Fila ': 'Fila_Emergencia' };
      expect(getField(row, ['Fila'])).toBe('Fila_Emergencia');
    });

    it('should extract fields fallback keys', () => {
      const row = { 'Telefone': '11985012885' };
      expect(getField(row, ['Número de telefone', 'Numero de telefone', 'Telefone'])).toBe('11985012885');
    });
  });

  describe('Report Type & Column Specifications', () => {
    it('should categorize URA correctly and map fields', () => {
      // Linha simulada do Excel 2025 da aba URA
      const row = {
        'Campanha ': 'CETESB_EMERGENCIAS',
        'Fila': 'Fila_Emergencia',
        'Número de telefone': '11985012885',
        'Sessão iniciada - Evento': '07/01/2025 08:30:15',
        'Duração da fila - Total': '00:15',
        'Duração da fala - Total': '02:30',
        'Alterar nome do resultado': 'OPCAO_1_EMERGENCIA',
        'Descrição do resultado do usuário': 'Encaminhado para Atendente'
      };

      const tipo = 'URA' as string;
      const usuario = tipo === 'URA' ? null : getField(row, ['Usuário', 'Usuario']);
      const resultadoNome = getField(row, ['Alterar nome do resultado', 'Resultado Nome']);
      const descricao = getField(row, ['Descrição do resultado do usuário', 'Resultado']);

      expect(usuario).toBeNull();
      expect(resultadoNome).toBe('OPCAO_1_EMERGENCIA');
      expect(descricao).toBe('Encaminhado para Atendente');
    });

    it('should categorize ATENDIMENTO_OPERACAO correctly and map fields', () => {
      // Linha simulada do Excel 2026 da aba ATENDIMENTOS
      const row = {
        'Campanha': 'CETESB_COBRANCA_P',
        'Fila': 'ramal_3285',
        'Usuário': 'bruno.souza',
        'Número de telefone': '11985012885',
        'Sessão iniciada - Evento': '2/02/26 09:55:03',
        'Duração da fila - Total': '00:10',
        'Duração da fala - Total': '02:31',
        'Descrição do resultado do usuário': '-1',
        'Resultado do usuário': 'Sucesso'
      };

      const tipo = 'ATENDIMENTO_OPERACAO' as string;
      const usuario = tipo === 'URA' ? null : (getField(row, ['Usuário', 'Usuario']) || '-');
      const resultadoUsuario = getField(row, ['Resultado do usuário', 'ResultadoUsuario']);

      expect(usuario).toBe('bruno.souza');
      expect(resultadoUsuario).toBe('Sucesso');
    });
  });
});
