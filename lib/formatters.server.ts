/**
 * formatters.server.ts — Funções server-only que dependem de Node.js crypto
 *
 * ESTE ARQUIVO É SERVER-ONLY. Nunca importar em componentes 'use client'.
 * Para funções client-safe, usar lib/formatters.ts
 */
import crypto from 'crypto';
import { cleanPhoneNumber } from './formatters';

/**
 * Gera o hash SHA-256 do número de telefone limpo.
 * Usado para armazenamento seguro e conciliação de registros.
 */
export function hashPhoneNumber(phone: string): string {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '';
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}
