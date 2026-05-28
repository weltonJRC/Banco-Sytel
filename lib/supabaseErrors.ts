/**
 * Utilitário para normalização e tratamento de erros do Supabase
 * Evita exibir stack traces, caminhos de arquivos e detalhes do banco no client.
 */

export interface NormalizedError {
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
  status: number | null;
  name: string;
}

export function normalizeSupabaseError(error: any): NormalizedError {
  if (!error) {
    return {
      message: 'Erro desconhecido ao consultar Supabase. Verifique Network/Console e scripts de diagnóstico.',
      code: null,
      details: null,
      hint: null,
      status: null,
      name: 'UnknownError'
    };
  }

  // Se for uma string
  if (typeof error === 'string') {
    return {
      message: error,
      code: null,
      details: null,
      hint: null,
      status: null,
      name: 'Error'
    };
  }

  const name = error.name || 'SupabaseError';
  const code = error.code || null;
  const details = error.details || null;
  const hint = error.hint || null;
  const status = error.status || error.statusCode || null;
  
  let message = error.message || '';

  // Se vier um objeto vazio ou sem propriedades úteis
  if (!message && !code && !details) {
    message = 'Erro desconhecido ao consultar Supabase. Verifique Network/Console e scripts de diagnóstico.';
  }

  return {
    message,
    code,
    details,
    hint,
    status,
    name
  };
}

/**
 * Loga o erro de forma segura, evitando que o Next.js dev overlay capture
 * console.error brutais e exiba o painel vermelho para o usuário final.
 */
export function logNormalizedError(context: string, rawError: any) {
  const isDev = process.env.NODE_ENV === 'development';
  const normalized = normalizeSupabaseError(rawError);

  if (isDev) {
    // Em desenvolvimento, usa console.warn com JSON stringificado controlado para não quebrar a tela com o overlay vermelho do Next.js
    console.warn(`[Supabase Error - ${context}]`, JSON.stringify(normalized, null, 2));
  } else {
    // Em produção, não expõe detalhes de banco ou de infraestrutura sensível no console do navegador do usuário
    console.warn(`[Portal Error] Ocorreu uma falha de comunicação interna (${context}).`);
  }
}
