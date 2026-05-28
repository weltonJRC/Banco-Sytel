/**
 * auth.server.ts — Gestão de sessão server-side real
 *
 * ESTE ARQUIVO É SERVER-ONLY. Nunca importar em componentes 'use client' ou Edge Middleware/Proxy.
 * Utiliza cookie httpOnly assinado com HMAC (usando a service role key do Supabase como chave)
 * para impedir manipulação no client-side.
 */
import crypto from 'crypto';
import type { UserSession } from './types';

const COOKIE_NAME = 'cetesb_session';
const SESSION_SECRET = process.env.SESSION_HMAC_SECRET || 'dev-secret-fallback-safe';
const IS_PRODUCTION = process.env.APP_ENV === 'production';

/**
 * Gera assinatura HMAC-SHA256 para o payload da sessão.
 */
function signPayload(payload: string): string {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');
}

/**
 * Cria o valor do cookie de sessão assinado.
 */
export function createSessionCookieValue(user: UserSession): string {
  const payload = JSON.stringify(user);
  const encoded = Buffer.from(payload).toString('base64');
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

/**
 * Retorna o header Set-Cookie completo para criar a sessão.
 */
export function createSessionCookie(user: UserSession): string {
  const value = createSessionCookieValue(user);
  const maxAge = 60 * 60 * 8; // 8 horas
  const secure = IS_PRODUCTION ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/**
 * Retorna o header Set-Cookie para destruir a sessão.
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Extrai e valida a sessão do usuário a partir do header Cookie.
 * Retorna null se cookie ausente, inválido ou assinatura incorreta.
 */
export function getSessionFromCookie(cookieHeader: string | null): UserSession | null {
  if (!cookieHeader) return null;

  // Parseia cookies manualmente
  const cookies = cookieHeader.split(';').reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) acc[key.trim()] = rest.join('=');
    return acc;
  }, {} as Record<string, string>);

  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;

  const parts = raw.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;

  // Valida assinatura HMAC
  const expectedSig = signPayload(encoded);
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedSigBuffer = Buffer.from(expectedSig, 'hex');

  if (signatureBuffer.length !== expectedSigBuffer.length) {
    console.warn('[auth.server] Comprimento de assinatura de sessão inválido.');
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedSigBuffer)) {
    console.warn('[auth.server] Assinatura de sessão inválida — possível tentativa de manipulação.');
    return null;
  }

  try {
    const payload = Buffer.from(encoded, 'base64').toString('utf-8');
    const user: UserSession = JSON.parse(payload);

    // Validação básica de campos obrigatórios
    if (!user.id || !user.email || !user.perfil) return null;
    if (!user.ativo) return null;

    return user;
  } catch {
    return null;
  }
}
