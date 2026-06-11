import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

function formatDateTime(isoString: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return '-';
  }
}

function formatSeconds(seconds: number | null | undefined): string {
  const s = Number(seconds ?? 0);
  if (isNaN(s) || s <= 0) return '00:00';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function measureExport(
  reportType: 'atendimentos' | 'ura',
  startDate: string,
  endDate: string
) {
  const tStart = Date.now();
  console.log(`\n---------------------------------------------------------`);
  console.log(`MEDINDO: tipo=${reportType}, período=${startDate} a ${endDate}`);
  console.log(`---------------------------------------------------------`);

  const isUra = reportType === 'ura';
  const viewName = isUra ? 'vw_cetesb_ura_front' : 'vw_cetesb_atendimentos_operacao_front';
  const selectFields = isUra
    ? 'campanha,fila,numero_telefone,sessao_iniciada,duracao_fila_segundos,duracao_fala_segundos,resultado_nome,descricao_resultado'
    : 'campanha,fila,usuario,numero_telefone,sessao_iniciada,duracao_fila_segundos,duracao_fala_segundos,descricao_resultado,resultado_usuario';

  let query = supabase.from(viewName).select(selectFields);

  if (startDate) {
    query = query.gte('sessao_iniciada', `${startDate} 00:00:00`);
  }
  if (endDate) {
    const nextDay = getNextDay(endDate);
    query = query.lt('sessao_iniciada', `${nextDay} 00:00:00`);
  }

  query = query.order('sessao_iniciada', { ascending: true });

  // Get total expected count first (exact head query)
  const { count: expectedCount, error: countErr } = await supabase
    .from(viewName)
    .select('*', { count: 'exact', head: true })
    .gte('sessao_iniciada', `${startDate} 00:00:00`)
    .lt('sessao_iniciada', `${getNextDay(endDate)} 00:00:00`);

  if (countErr) {
    console.error('Erro ao contar registros:', countErr);
    return;
  }

  console.log(`Registros esperados no Supabase: ${expectedCount}`);

  if (expectedCount === 0) {
    console.log('Sem dados neste período.');
    return;
  }

  const headers = isUra
    ? ['Campanha', 'Fila', 'Número de telefone', 'Sessão iniciada - Evento', 'Duração da fila - Total', 'Duração da fala - Total', 'Resultado', 'Descrição do resultado do usuário']
    : ['Campanha', 'Fila', 'Usuário', 'Número de telefone', 'Sessão iniciada - Evento', 'Duração da fila - Total', 'Duração da fala - Total', 'Descrição do resultado do usuário', 'Resultado do usuário'];

  let totalRows = 0;
  let page = 0;
  const batchSize = 1000;
  let hasMore = true;
  let csvContent = '\uFEFF' + headers.map(escapeCsvCell).join(';');

  while (hasMore) {
    const from = page * batchSize;
    const to = from + batchSize - 1;

    const { data, error } = (await query.range(from, to)) as { data: any[] | null; error: any };

    if (error) {
      console.error(`Erro na página ${page}:`, error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    totalRows += data.length;

    let chunk = '';
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
      chunk += '\r\n' + line.map(escapeCsvCell).join(';');
    }

    csvContent += chunk;
    page++;

    if (data.length < batchSize) {
      hasMore = false;
    }
  }

  const duration = Date.now() - tStart;
  const fileSizeMb = (Buffer.byteLength(csvContent, 'utf-8') / (1024 * 1024)).toFixed(2);
  const rowsCount = csvContent.split('\r\n').length;

  console.log(`RESULTADOS:`);
  console.log(`  - Total exportado (linhas CSV): ${rowsCount} (headers + dados)`);
  console.log(`  - Tempo de execução:            ${duration} ms (${(duration/1000).toFixed(2)} s)`);
  console.log(`  - Tamanho do arquivo CSV:       ${fileSizeMb} MB`);
  console.log(`  - Status:                       ${rowsCount - 1 === expectedCount ? '✅ COMPLETO' : '⚠️ INCOMPLETO'}`);
  
  // Salva o arquivo de teste localmente na pasta artifacts ou scratch
  const filename = `test-export-${reportType}-${startDate}-a-${endDate}.csv`;
  const scratchDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  fs.writeFileSync(path.join(scratchDir, filename), csvContent, 'utf-8');
  console.log(`  - Salvo em:                     artifacts/${filename}`);
}

async function run() {
  console.log('Iniciando medição de exportações completas...');

  // ATENDIMENTOS
  // 1. Período curto: 01/05/2026 a 21/05/2026 (esperado 9.378 registros)
  await measureExport('atendimentos', '2026-05-01', '2026-05-21');

  // 2. 30 dias: 28/04/2026 a 27/05/2026
  await measureExport('atendimentos', '2026-04-28', '2026-05-27');

  // 3. 3 meses: 27/02/2026 a 27/05/2026
  await measureExport('atendimentos', '2026-02-27', '2026-05-27');

  // 4. 6 meses: 27/11/2025 a 27/05/2026
  await measureExport('atendimentos', '2025-11-27', '2026-05-27');

  // 5. Período completo: 01/01/2025 a 31/05/2026 (esperado ~157.343 registros)
  await measureExport('atendimentos', '2025-01-01', '2026-05-31');

  // URA
  // 1. 30 dias: 05/05/2025 a 05/06/2025
  await measureExport('ura', '2025-05-05', '2025-06-05');

  // 2. 3 meses: 05/05/2025 a 05/08/2025
  await measureExport('ura', '2025-05-05', '2025-08-05');

  // 3. 6 meses: 05/05/2025 a 05/11/2025
  await measureExport('ura', '2025-05-05', '2025-11-05');

  // 4. Período completo: 01/01/2025 a 31/05/2026 (esperado ~89.893 registros)
  await measureExport('ura', '2025-01-01', '2026-05-31');
}

run();
