import type { UserSession } from './types';
import { supabase } from './supabaseClient';

const COOKIE_NAME = 'cetesb_session';

/**
 * Realiza login do usuário real utilizando o Supabase Auth.
 * Envia o token JWT gerado para a API `/api/session` server-side 
 * para criar o cookie HTTPOnly assinado.
 */
export async function signIn(email: string, password: string): Promise<{ user: UserSession | null; error: string | null }> {
  if (!supabase) {
    return { user: null, error: 'Supabase não está configurado neste ambiente. Verifique o .env.' };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) throw authError;
    if (!authData.user || !authData.session) throw new Error('Usuário ou sessão não retornada pelo Supabase.');

    // Envia o access_token para a API Route criar o cookie HTTPOnly seguro
    const sessionRes = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: authData.session.access_token }),
    });

    const contentType = sessionRes.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Erro de configuração da rota de login. Verifique middleware/proxy e variáveis de ambiente.');
    }

    const sessionData = await sessionRes.json();

    if (!sessionRes.ok) {
      throw new Error(sessionData.error || 'Erro ao sincronizar sessão segura.');
    }

    return { user: sessionData.user, error: null };
  } catch (err: any) {
    return { user: null, error: err.message || 'Erro desconhecido ao autenticar' };
  }
}

/**
 * Retorna o usuário logado atualmente (client-side, lendo do sessionStorage).
 */
export function getCurrentUser(): UserSession | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = sessionStorage.getItem('cetesb_user_cache');
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Armazena o cache da sessão do usuário no sessionStorage (apenas referência visual).
 */
export function cacheUserSession(user: UserSession): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('cetesb_user_cache', JSON.stringify(user));
}

/**
 * Remove a sessão ativa do usuário tanto localmente quanto no servidor (cookies e Supabase Auth).
 */
export async function signOut(): Promise<void> {
  // Limpa cache local
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('cetesb_user_cache');
  }

  // Limpa cookie via API route session e desloga no Supabase
  try {
    await fetch('/api/session', { method: 'DELETE' });
  } catch {}
  if (supabase) {
    await supabase.auth.signOut();
  }
}

/**
 * Valida se a sessão atual possui um perfil adequado
 */
export function hasPermission(perfil: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(perfil);
}
