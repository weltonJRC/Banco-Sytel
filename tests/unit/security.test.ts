import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createSessionCookieValue, 
  getSessionFromCookie
} from '../../lib/auth.server';
import type { UserSession } from '../../lib/types';

describe('Security & Cookie Authentication Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('HMAC Signed Cookie Validation', () => {
    const testUser: UserSession = {
      id: 'usr-123',
      email: 'test@jrc.local',
      nome: 'Test User',
      perfil: 'jrc_admin',
      ativo: true
    };

    it('should successfully serialize and sign a valid session', () => {
      const cookieValue = createSessionCookieValue(testUser);
      expect(cookieValue).toContain('.');
      
      const cookieHeader = `cetesb_session=${cookieValue}`;
      const session = getSessionFromCookie(cookieHeader);
      
      expect(session).not.toBeNull();
      expect(session?.id).toBe('usr-123');
      expect(session?.perfil).toBe('jrc_admin');
    });

    it('should reject a session cookie with a hijacked or modified signature', () => {
      const cookieValue = createSessionCookieValue(testUser);
      const parts = cookieValue.split('.');
      
      // Corrompe a assinatura HMAC
      const hijackedCookieValue = `${parts[0]}.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`;
      const cookieHeader = `cetesb_session=${hijackedCookieValue}`;
      
      const session = getSessionFromCookie(cookieHeader);
      expect(session).toBeNull();
    });

    it('should gracefully reject session signatures of invalid lengths without crashing', () => {
      const cookieValue = createSessionCookieValue(testUser);
      const parts = cookieValue.split('.');
      
      // Envia assinatura curta (causa timingSafeEqual crash se não prevenida)
      const shortCookieValue = `${parts[0]}.12345`;
      const cookieHeader = `cetesb_session=${shortCookieValue}`;
      
      const session = getSessionFromCookie(cookieHeader);
      expect(session).toBeNull();
    });
  });
});
