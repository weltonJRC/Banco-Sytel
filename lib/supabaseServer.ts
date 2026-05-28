import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Cliente Supabase server-side com Service Role Key.
 * 
 * IMPORTANTE:
 * - NÃO faz fallback para ANON_KEY. Se a service key não existir, retorna null.
 * - Usado APENAS por scripts CLI (import-excel, validate-data) e API routes server-side.
 * - NUNCA importar este arquivo em código client-side.
 */
export const supabaseServer = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : null;

export function isSupabaseServerConfigured(): boolean {
  return !!supabaseServer;
}

/**
 * Helper que lança erro claro se o Supabase Server não estiver configurado.
 * Usar em operações que REQUEREM a service role key.
 */
export function requireSupabaseServer() {
  if (!supabaseServer) {
    throw new Error(
      '[Supabase] Service Role Key não configurada. ' +
      'Configure SUPABASE_SERVICE_ROLE_KEY no .env para operações server-side. ' +
      'Veja docs/SUPABASE_SETUP.md para instruções.'
    );
  }
  return supabaseServer;
}
