import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSessionCookie, clearSessionCookie } from '@/lib/auth.server';
import type { UserSession } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token } = body;

    if (!access_token) {
      return NextResponse.json(
        { error: 'Token de acesso não fornecido.' },
        { status: 400 }
      );
    }

    // Inicializa o cliente Supabase server-side para verificar o token JWT do usuário
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(access_token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token de acesso inválido ou expirado.' },
        { status: 401 }
      );
    }

    // Busca o perfil correspondente de forma segura usando o Supabase Server com service_role
    const { supabaseServer } = await import('@/lib/supabaseServer');
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Servidor Supabase não configurado.' },
        { status: 500 }
      );
    }

    const { data: profile, error: profError } = await supabaseServer
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profError || !profile) {
      return NextResponse.json(
        { error: 'Perfil de acesso correspondente não encontrado na base de dados.' },
        { status: 404 }
      );
    }

    if (!profile.ativo) {
      return NextResponse.json(
        { error: 'Esta conta está inativa. Entre em contato com o suporte da JRC.' },
        { status: 403 }
      );
    }

    const session: UserSession = {
      id: profile.id,
      email: profile.email,
      nome: profile.nome,
      perfil: profile.perfil,
      ativo: profile.ativo,
    };

    // Gera o cookie HTTPOnly assinado
    const cookie = createSessionCookie(session);
    const response = NextResponse.json({ user: session });
    response.headers.set('Set-Cookie', cookie);

    return response;
  } catch (err: any) {
    console.error('[API Session] Erro inesperado ao criar sessão:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar a criação de sessão.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookie = clearSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', cookie);
  return response;
}
