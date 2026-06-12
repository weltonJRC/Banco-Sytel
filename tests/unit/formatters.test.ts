import { describe, it, expect } from 'vitest';
import { 
  formatSeconds, 
  parseDurationToSeconds, 
  parseDateString, 
  maskPhoneNumber,
  cleanPhoneNumber
} from '../../lib/formatters';

describe('Formatters Unit Tests', () => {
  describe('formatSeconds — sempre HH:MM:SS', () => {
    it('deve retornar 00:00:00 para valores inválidos', () => {
      expect(formatSeconds(null)).toBe('00:00:00');
      expect(formatSeconds(undefined)).toBe('00:00:00');
      expect(formatSeconds(NaN)).toBe('00:00:00');
    });

    it('deve formatar 40 segundos corretamente', () => {
      expect(formatSeconds(40)).toBe('00:00:40');
    });

    it('deve formatar 5 minutos e 45 segundos corretamente', () => {
      expect(formatSeconds(345)).toBe('00:05:45');
    });

    it('deve formatar 40 minutos e 19 segundos — não pode virar 40:19 (bug Excel)', () => {
      expect(formatSeconds(2419)).toBe('00:40:19');
    });

    it('deve formatar 1 hora, 2 minutos e 3 segundos corretamente', () => {
      expect(formatSeconds(3723)).toBe('01:02:03');
    });

    it('deve formatar 10 segundos como 00:00:10 (não 00:10)', () => {
      expect(formatSeconds(10)).toBe('00:00:10');
    });

    it('deve formatar 151 segundos como 00:02:31', () => {
      expect(formatSeconds(151)).toBe('00:02:31');
    });

    it('deve formatar 3665 segundos como 01:01:05', () => {
      expect(formatSeconds(3665)).toBe('01:01:05');
    });

    it('deve formatar 0 como 00:00:00', () => {
      expect(formatSeconds(0)).toBe('00:00:00');
    });

    it('não deve retornar formato MM:SS (sem HH:) para nenhum valor', () => {
      // MM:SS sem HH: causa bug no Excel (40:19 -> 40h19m)
      const result10 = formatSeconds(10);
      const result2419 = formatSeconds(2419);
      const result345 = formatSeconds(345);
      
      expect(result10.split(':').length).toBe(3);   // sempre 3 partes
      expect(result2419.split(':').length).toBe(3);
      expect(result345.split(':').length).toBe(3);
    });
  });

  describe('parseDurationToSeconds', () => {
    it('should parse mm:ss to seconds', () => {
      expect(parseDurationToSeconds('00:10')).toBe(10);
      expect(parseDurationToSeconds('02:31')).toBe(151);
      expect(parseDurationToSeconds('10:31')).toBe(631);
    });

    it('should parse hh:mm:ss to seconds', () => {
      expect(parseDurationToSeconds('01:05:30')).toBe(3930);
    });

    it('should return number directly if simple number string', () => {
      expect(parseDurationToSeconds('120')).toBe(120);
    });

    it('should return 0 for invalid string', () => {
      expect(parseDurationToSeconds(null)).toBe(0);
      expect(parseDurationToSeconds(undefined)).toBe(0);
      expect(parseDurationToSeconds('')).toBe(0);
    });
  });

  describe('parseDateString', () => {
    it('should parse Date objects', () => {
      const d = new Date();
      expect(parseDateString(d)).toEqual(d);
    });

    it('should parse Brazilian format date strings', () => {
      const d = parseDateString('02/02/2026 09:55:03');
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(1); // February is 1
      expect(d?.getDate()).toBe(2);
      expect(d?.getHours()).toBe(9);
      expect(d?.getMinutes()).toBe(55);
      expect(d?.getSeconds()).toBe(3);
    });

    it('should parse two-digit year strings', () => {
      const d = parseDateString('02/02/26 09:55:03');
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
    });

    it('should parse ISO date strings', () => {
      const d = parseDateString('2026-02-02T09:55:03.000Z');
      expect(d).not.toBeNull();
      expect(d?.toISOString()).toBe('2026-02-02T09:55:03.000Z');
    });

    it('should return null for invalid inputs', () => {
      expect(parseDateString(null)).toBeNull();
      expect(parseDateString('')).toBeNull();
      expect(parseDateString('invalid-date')).toBeNull();
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask 11-digit mobile phone numbers', () => {
      expect(maskPhoneNumber('11985012885')).toBe('119****2885');
    });

    it('should mask 10-digit landline phone numbers', () => {
      expect(maskPhoneNumber('1138502885')).toBe('113****2885');
    });

    it('should mask other lengths leaving 3 first and 2 last', () => {
      expect(maskPhoneNumber('1234567')).toBe('123****67');
    });

    it('should return - for empty input', () => {
      expect(maskPhoneNumber('')).toBe('-');
    });
  });

  describe('cleanPhoneNumber — preservação de telefone como string', () => {
    it('deve preservar telefone com prefixo 0055 como string', () => {
      const phone = '00551432371091';
      // cleanPhoneNumber remove não-numéricos mas mantém como string
      const cleaned = cleanPhoneNumber(phone);
      expect(typeof cleaned).toBe('string');
      expect(cleaned).toBe('00551432371091');
    });

    it('deve preservar telefone 01511983701595 sem converter para número', () => {
      const phone = '01511983701595';
      const cleaned = cleanPhoneNumber(phone);
      expect(typeof cleaned).toBe('string');
      expect(cleaned).toBe('01511983701595');
      // Garante que não virou notação científica
      expect(cleaned).not.toContain('E');
      expect(cleaned).not.toContain('e');
    });

    it('deve preservar telefone 011993696380 com zero à esquerda', () => {
      const phone = '011993696380';
      const cleaned = cleanPhoneNumber(phone);
      expect(cleaned.startsWith('0')).toBe(true);
      expect(cleaned).toBe('011993696380');
    });

    it('deve retornar string vazia para entrada vazia', () => {
      expect(cleanPhoneNumber('')).toBe('');
    });
  });
});
