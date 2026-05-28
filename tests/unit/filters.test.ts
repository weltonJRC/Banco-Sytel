import { describe, it, expect } from 'vitest';
import { sanitizeIlikeInput } from '../../lib/formatters';

describe('Search Filters & Sanitization Tests', () => {
  describe('sanitizeIlikeInput (SQL Injection Protections)', () => {
    it('should escape backslashes correctly', () => {
      expect(sanitizeIlikeInput('test\\value')).toBe('test\\\\value');
    });

    it('should escape percent wildcard characters correctly', () => {
      expect(sanitizeIlikeInput('admin%')).toBe('admin\\%');
    });

    it('should escape underscore wildcard characters correctly', () => {
      expect(sanitizeIlikeInput('admin_user')).toBe('admin\\_user');
    });

    it('should return empty string for null or empty values', () => {
      expect(sanitizeIlikeInput('')).toBe('');
      expect(sanitizeIlikeInput(null as any)).toBe('');
    });

    it('should leave normal query strings unchanged', () => {
      expect(sanitizeIlikeInput('ana.silva')).toBe('ana.silva');
      expect(sanitizeIlikeInput('ramal_3285')).toBe('ramal\\_3285'); // Underscore is escaped!
    });
  });

  describe('Page Size Restrictions (Safety Limits)', () => {
    const EXPORT_MAX_ROWS = 10000;

    const clampPageSize = (pageSize: number) => {
      return Math.min(pageSize, EXPORT_MAX_ROWS);
    };

    it('should allow valid page sizes below or equal to limit', () => {
      expect(clampPageSize(50)).toBe(50);
      expect(clampPageSize(100)).toBe(100);
      expect(clampPageSize(10000)).toBe(10000);
    });

    it('should restrict page sizes exceeding limit', () => {
      expect(clampPageSize(20000)).toBe(10000);
      expect(clampPageSize(50000)).toBe(10000);
    });
  });
});
