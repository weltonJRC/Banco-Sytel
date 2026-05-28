import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSessionFromCookieEdge } from '../../lib/auth.edge';
import { createSessionCookieValue } from '../../lib/auth.server';
import type { UserSession } from '../../lib/types';

describe('Security Edge Cookie Authentication Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('HMAC Signed Cookie Validation (Edge)', () => {
    const testUser: UserSession = {
      id: 'usr-456',
      email: 'edge-test@jrc.local',
      nome: 'Edge Test User',
      perfil: 'cetesb_consulta',
      ativo: true
    };

    it('should successfully serialize and validate a valid session cookie in Edge', async () => {
      const cookieValue = createSessionCookieValue(testUser);
      expect(cookieValue).toContain('.');
      
      const cookieHeader = `cetesb_session=${cookieValue}`;
      const session = await getSessionFromCookieEdge(cookieHeader);
      
      expect(session).not.toBeNull();
      expect(session?.id).toBe('usr-456');
      expect(session?.perfil).toBe('cetesb_consulta');
    });

    it('should reject a hijacked or modified session signature in Edge', async () => {
      const cookieValue = createSessionCookieValue(testUser);
      const parts = cookieValue.split('.');
      
      // Corrompe a assinatura HMAC
      const hijackedCookieValue = `${parts[0]}.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`;
      const cookieHeader = `cetesb_session=${hijackedCookieValue}`;
      
      const session = await getSessionFromCookieEdge(cookieHeader);
      expect(session).toBeNull();
    });

    it('should gracefully handle invalid session signature formats in Edge', async () => {
      const cookieValue = createSessionCookieValue(testUser);
      const parts = cookieValue.split('.');
      
      // Assinatura de comprimento inválido
      const shortCookieValue = `${parts[0]}.12345`;
      const cookieHeader = `cetesb_session=${shortCookieValue}`;
      
      const session = await getSessionFromCookieEdge(cookieHeader);
      expect(session).toBeNull();
    });
  });
});
