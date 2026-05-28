/**
 * auth.edge.ts — Gestão de sessão compatível com Edge Runtime real
 *
 * ESTE ARQUIVO É COMPATÍVEL COM EDGE RUNTIME. Não utiliza módulos nativos Node.js.
 * Utiliza a Web Crypto API (globalThis.crypto.subtle) para validação HMAC.
 */
import type { UserSession } from './types';

const COOKIE_NAME = 'cetesb_session';
const SESSION_SECRET = process.env.SESSION_HMAC_SECRET || 'dev-secret-fallback-safe';

/**
 * Converte base64 para string de forma compatível com Edge Runtime.
 */
function base64ToUtf8(str: string): string {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Valida assinatura HMAC usando a Web Crypto API (SubtleCrypto).
 */
async function verifyHmac(keyStr: string, dataStr: string, signatureHex: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyStr);
    const data = encoder.encode(dataStr);

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Converte assinatura Hex para Uint8Array
    const matches = signatureHex.match(/.{1,2}/g);
    if (!matches) return false;
    const sigBytes = new Uint8Array(matches.map(byte => parseInt(byte, 16)));

    return await globalThis.crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      sigBytes,
      data
    );
  } catch (err) {
    console.error('[auth.edge] Erro ao verificar HMAC:', err);
    return false;
  }
}

/**
 * Extrai e valida a sessão do usuário a partir do header Cookie de forma assíncrona.
 * Compatível com Edge Runtime.
 */
export async function getSessionFromCookieEdge(cookieHeader: string | null): Promise<UserSession | null> {
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

  // Valida assinatura HMAC assincronamente usando Web Crypto
  const isValid = await verifyHmac(SESSION_SECRET, encoded, signature);
  if (!isValid) {
    console.warn('[auth.edge] Assinatura de sessão inválida — possível tentativa de manipulação.');
    return null;
  }

  try {
    const payload = base64ToUtf8(encoded);
    const user: UserSession = JSON.parse(payload);

    // Validação básica de campos obrigatórios
    if (!user.id || !user.email || !user.perfil) return null;
    if (!user.ativo) return null;

    return user;
  } catch {
    return null;
  }
}
