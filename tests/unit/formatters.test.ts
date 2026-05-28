import { describe, it, expect } from 'vitest';
import { 
  formatSeconds, 
  parseDurationToSeconds, 
  parseDateString, 
  maskPhoneNumber,
  cleanPhoneNumber
} from '../../lib/formatters';

describe('Formatters Unit Tests', () => {
  describe('formatSeconds', () => {
    it('should format seconds into mm:ss', () => {
      expect(formatSeconds(10)).toBe('00:10');
      expect(formatSeconds(151)).toBe('02:31');
    });

    it('should format seconds into hh:mm:ss', () => {
      expect(formatSeconds(3665)).toBe('01:01:05');
    });

    it('should return 00:00 for invalid values', () => {
      expect(formatSeconds(null)).toBe('00:00');
      expect(formatSeconds(undefined)).toBe('00:00');
      expect(formatSeconds(NaN)).toBe('00:00');
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
});
