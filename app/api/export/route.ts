/**
 * API Route: /api/export
 * Placeholder para exportação server-side futura.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Exportação server-side ainda não implementada. Use os botões CSV/XLSX nas telas de relatório.',
      info: 'Esta rota será implementada quando o Supabase estiver configurado para exportações de grande volume.'
    },
    { status: 501 }
  );
}
