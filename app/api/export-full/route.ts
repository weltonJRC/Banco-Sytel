import { NextRequest } from 'next/server';
import { getSessionFromCookie } from '../../../lib/auth.server';
import { requireSupabaseServer } from '../../../lib/supabaseServer';
import { sanitizeIlikeInput, formatSeconds, formatDateTime } from '../../../lib/formatters';

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

/**
 * Escapa célula CSV padrão — envolve em aspas duplas se necessário.
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Protege uma célula crítica com ="valor" para que o Excel não converta
 * telefones (notação científica), datas e durações automaticamente.
 */
function escapeCsvCellSafe(val: any): string {
  if (val === null || val === undefined) return '=""';
  const str = String(val);
  const inner = str.replace(/"/g, '""');
  return `="${inner}"`;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Validar autenticação/sessão
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado. Sessão expirada ou inválida.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
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
      return new Response(
        JSON.stringify({ error: 'Parâmetro reportType inválido ou ausente.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Se for apenas uma validação prévia de sessão e parâmetros
    if (validateOnly) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
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

    // Nome do arquivo
    const displayStart = startDate || 'inicio';
    const displayEnd = endDate || 'fim';
    const filename = `cetesb-${reportType}-completo-${displayStart}-a-${displayEnd}.csv`;

    // Encoder de texto
    const encoder = new TextEncoder();

    // Criar o stream responsivo — sem limite de registros (streaming paginado)
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Escreve o BOM UTF-8 (\uFEFF) para garantir leitura de acentos no Excel
          controller.enqueue(encoder.encode('\uFEFF'));

          // Escreve a linha de cabeçalho
          const headerLine = headers.map(escapeCsvCell).join(';');
          controller.enqueue(encoder.encode(headerLine));

          let page = 0;
          const batchSize = 1000;
          let hasMore = true;
          let totalExported = 0;

          while (hasMore) {
            const from = page * batchSize;
            const to = from + batchSize - 1;

            const { data, error } = (await query.range(from, to)) as { data: any[] | null; error: any };

            if (error) {
              console.error(`[API Export] Erro no lote ${page}:`, error.message || error);
              throw error;
            }

            if (!data || data.length === 0) {
              hasMore = false;
              break;
            }

            let chunkCsv = '';
            for (const row of data) {
              let line: string[];

              if (isUra) {
                line = [
                  escapeCsvCell(row.campanha),
                  escapeCsvCell(row.fila),
                  escapeCsvCellSafe(row.numero_telefone),          // protegido
                  escapeCsvCellSafe(formatDateTime(row.sessao_iniciada)), // protegido
                  escapeCsvCellSafe(formatSeconds(row.duracao_fila_segundos)), // protegido
                  escapeCsvCellSafe(formatSeconds(row.duracao_fala_segundos)), // protegido
                  escapeCsvCell(row.resultado_nome || '-'),
                  escapeCsvCell(row.descricao_resultado)
                ];
              } else {
                line = [
                  escapeCsvCell(row.campanha),
                  escapeCsvCell(row.fila),
                  escapeCsvCell(row.usuario),
                  escapeCsvCellSafe(row.numero_telefone),          // protegido
                  escapeCsvCellSafe(formatDateTime(row.sessao_iniciada)), // protegido
                  escapeCsvCellSafe(formatSeconds(row.duracao_fila_segundos)), // protegido
                  escapeCsvCellSafe(formatSeconds(row.duracao_fala_segundos)), // protegido
                  escapeCsvCell(row.descricao_resultado),
                  escapeCsvCell(row.resultado_usuario)
                ];
              }

              chunkCsv += '\r\n' + line.join(';');
            }

            controller.enqueue(encoder.encode(chunkCsv));
            totalExported += data.length;
            page++;

            if (data.length < batchSize) {
              hasMore = false;
            }
          }

          controller.close();
        } catch (err: any) {
          console.error('[API Export] Erro durante streaming de dados:', err.message || err);
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });

  } catch (err: any) {
    console.error('[API Export] Erro inesperado na exportação completa:', err.message || err);
    return new Response(
      JSON.stringify({ error: 'Não foi possível gerar o relatório completo. Tente novamente ou reduza o período.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
