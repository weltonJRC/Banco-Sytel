import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Apenas cria o cliente se as credenciais existirem, evitando quebra em tempo de carregamento
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Função utilitária para verificar se o Supabase está de fato configurado no front
 */
export function isSupabaseConfigured(): boolean {
  return !!supabase;
}
