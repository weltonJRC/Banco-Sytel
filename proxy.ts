/**
 * proxy.ts — Proteção de rotas server-side e controle de acesso Edge real
 *
 * Arquivo de convenção do Next.js 16 para intercepção de requisições.
 * Roda no Edge Runtime, compatível com Web Crypto.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookieEdge } from './lib/auth.edge';

// Rotas que NÃO precisam de autenticação
const PUBLIC_PATHS = [
  '/login',
  '/api/session',
];

// Prefixos que devem ser ignorados pelo proxy
const IGNORED_PREFIXES = [
  '/_next',
  '/favicon.ico',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignora assets internos do Next.js
  if (IGNORED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Rotas públicas não precisam de autenticação
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Verifica cookie de sessão usando o validador Edge
  const cookieHeader = request.headers.get('cookie');
  const session = await getSessionFromCookieEdge(cookieHeader);

  if (!session) {
    // Se for uma requisição de API, retorna JSON 401 em vez de redirecionar para HTML (/login)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Não autenticado. Sessão expirada ou inválida.' },
        { status: 401 }
      );
    }

    // Redireciona rotas HTML para a tela de login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Sessão válida — permite acesso
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static and image files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
