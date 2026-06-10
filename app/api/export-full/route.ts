import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '../../../lib/auth.server';
import { requireSupabaseServer } from '../../../lib/supabaseServer';
import { sanitizeIlikeInput, formatDateTime, formatSeconds } from '../../../lib/formatters';

export const dynamic = 'force-dynamic';

function getNextDay(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  date.setDate(date.getDate() + 1);
  
  const nextYear = date.getFullYear();
  const nextMonth = (date.getMonth() + 1).toString().padStart(2, '0');
  const nextDay = date.getDate().toString().padStart(2, '0');
  
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = val.toString();
  if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Validar autenticação/sessão
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado. Sessão expirada ou inválida.' },
        { status: 401 }
      );
    }

    // 2. Aceitar filtros via query string
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const campanha = searchParams.get('campanha');
    const fila = searchParams.get('fila');
    const usuario = searchParams.get('usuario');
    const resultado = searchParams.get('resultado');
    const fonte = searchParams.get('fonte');
    const status = searchParams.get('status');
    const validateOnly = searchParams.get('validate') === 'true';

    // Validação básica de parâmetros
    if (!reportType || (reportType !== 'atendimentos' && reportType !== 'ura')) {
      return NextResponse.json(
        { error: 'Parâmetro reportType inválido ou ausente.' },
        { status: 400 }
      );
    }

    // Se for apenas uma validação prévia de sessão e parâmetros
    if (validateOnly) {
      return NextResponse.json({ ok: true });
    }

    // 3. Inicializar o Supabase Server
    const supabaseServer = requireSupabaseServer();

    // 4. Definir a view e colunas com base no tipo de relatório
    const isUra = reportType === 'ura';
    const viewName = isUra ? 'vw_cetesb_ura_front' : 'vw_cetesb_atendimentos_operacao_front';
    
    // Seleciona somente as colunas necessárias para exportação (Sem campos técnicos ou sensíveis)
    const selectFields = isUra
      ? 'campanha,fila,numero_telefone,sessao_iniciada,duracao_fila_segundos,duracao_fala_segundos,resultado_nome,descricao_resultado'
      : 'campanha,fila,usuario,numero_telefone,sessao_iniciada,duracao_fila_segundos,duracao_fala_segundos,descricao_resultado,resultado_usuario';

    // Montar a query base
    let query = supabaseServer.from(viewName).select(selectFields);

    // 5. Aplicar filtros dinâmicos
    if (startDate) {
      query = query.gte('sessao_iniciada', `${startDate} 00:00:00`);
    }
    if (endDate) {
      const nextDay = getNextDay(endDate);
      query = query.lt('sessao_iniciada', `${nextDay} 00:00:00`);
    }
    if (campanha) {
      query = query.eq('campanha', campanha);
    }
    if (fila) {
      query = query.eq('fila', fila);
    }
    if (usuario && !isUra) {
      const safeUsuario = sanitizeIlikeInput(usuario);
      query = query.ilike('usuario', `%${safeUsuario}%`);
    }
    if (resultado) {
      const safeResultado = sanitizeIlikeInput(resultado);
      if (isUra) {
        query = query.ilike('resultado_nome', `%${safeResultado}%`);
      } else {
        query = query.ilike('descricao_resultado', `%${safeResultado}%`);
      }
    }
    if (fonte) {
      query = query.eq('fonte_oficial', fonte);
    }
    if (status) {
      query = query.eq('status_validacao', status);
    }

    // Ordenação consistente por sessao_iniciada
    query = query.order('sessao_iniciada', { ascending: true });

    // 6. Definir cabeçalhos do CSV
    const headers = isUra
      ? [
          'Campanha',
          'Fila',
          'Número de telefone',
          'Sessão iniciada - Evento',
          'Duração da fila - Total',
          'Duração da fala - Total',
          'Resultado',
          'Descrição do resultado do usuário'
        ]
      : [
          'Campanha',
          'Fila',
          'Usuário',
          'Número de telefone',
          'Sessão iniciada - Evento',
          'Duração da fila - Total',
          'Duração da fala - Total',
          'Descrição do resultado do usuário',
          'Resultado do usuário'
        ];

    // Monta o cabeçalho do CSV
    const csvLines: string[] = [headers.map(escapeCsvCell).join(';')];

    // 7. Loop de busca em lotes de 1.000 registros sem limite de 10.000
    let page = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * batchSize;
      const to = from + batchSize - 1;

      const { data, error } = (await query.range(from, to)) as { data: any[] | null; error: any };

      if (error) {
        console.error(`[API Export] Erro no lote ${page}:`, error);
        throw error;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      // Adiciona registros formatados
      for (const row of data) {
        const line = isUra
          ? [
              row.campanha,
              row.fila,
              row.numero_telefone,
              formatDateTime(row.sessao_iniciada),
              formatSeconds(row.duracao_fila_segundos),
              formatSeconds(row.duracao_fala_segundos),
              row.resultado_nome || '-',
              row.descricao_resultado
            ]
          : [
              row.campanha,
              row.fila,
              row.usuario,
              row.numero_telefone,
              formatDateTime(row.sessao_iniciada),
              formatSeconds(row.duracao_fila_segundos),
              formatSeconds(row.duracao_fala_segundos),
              row.descricao_resultado,
              row.resultado_usuario
            ];
        csvLines.push(line.map(escapeCsvCell).join(';'));
      }

      page++;

      if (data.length < batchSize) {
        hasMore = false;
      }
    }

    const csvContent = csvLines.join('\r\n');
    
    // Nome do arquivo
    const displayStart = startDate || 'inicio';
    const displayEnd = endDate || 'fim';
    const filename = `cetesb-${reportType}-completo-${displayStart}-a-${displayEnd}.csv`;

    // Retornar o arquivo com os cabeçalhos apropriados
    // \uFEFF força o Excel a interpretar o arquivo em UTF-8 com acentos corretos (BOM)
    return new NextResponse('\uFEFF' + csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });

  } catch (err: any) {
    console.error('[API Export] Erro inesperado na exportação completa:', err);
    return NextResponse.json(
      { error: 'Não foi possível gerar o relatório completo. Tente novamente ou reduza o período.' },
      { status: 500 }
    );
  }
}
