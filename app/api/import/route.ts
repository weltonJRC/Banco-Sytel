/**
 * API Route: /api/import
 * Placeholder para importação server-side futura.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Importação via API ainda não implementada.',
      info: 'Para importar dados, use o script CLI: npm run import:excel. ' +
            'Configure SUPABASE_SERVICE_ROLE_KEY no .env antes de executar.'
    },
    { status: 501 }
  );
}
