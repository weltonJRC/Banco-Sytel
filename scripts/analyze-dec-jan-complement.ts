import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

import { 
  cleanPhoneNumber, 
  maskPhoneNumber, 
  parseDurationToSeconds, 
  parseDateString 
} from '../lib/formatters';
import { hashPhoneNumber } from '../lib/formatters.server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hasSupabase = !!(supabaseUrl && supabaseServiceKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Função geradora de chave de deduplicação com base nos 10 campos requeridos
function generateEventKey(row: {
  tipo_relatorio: string;
  campanha: string | null;
  fila: string | null;
  usuario: string | null;
  numero_telefone: string | null;
  sessao_iniciada: string | Date | null;
  duracao_fila_segundos: number | null;
  duracao_fala_segundos: number | null;
  descricao_resultado: string | null;
  resultado_usuario: string | null;
}): string {
  const norm = (val: any) => {
    if (val === null || val === undefined) return '';
    return val.toString().trim().toLowerCase();
  };
  
  const normUser = (val: any) => {
    const u = norm(val);
    return u === '-' ? '' : u; // Trata '-' como vazio para normalizar comparação
  };
  
  const normDate = (val: any) => {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  };

  const keyParts = [
    norm(row.tipo_relatorio),
    norm(row.campanha),
    norm(row.fila),
    normUser(row.usuario),
    norm(row.numero_telefone),
    normDate(row.sessao_iniciada),
    norm(row.duracao_fila_segundos),
    norm(row.duracao_fala_segundos),
    norm(row.descricao_resultado),
    norm(row.resultado_usuario)
  ];
  
  return keyParts.join('|');
}

async function run() {
  console.log('================================================================');
  console.log('   ANÁLISE PRÉ-IMPORTAÇÃO COMPLEMENTAR - PORTAL CETESB');
  console.log('================================================================\n');

  if (!hasSupabase) {
    console.error('❌ Erro: Supabase não está configurado.');
    process.exit(1);
  }

  const excelPath = path.join(process.cwd(), 'data', 'raw', 'Relatório Detalhado dez e janeiro (1).XLSX');
  
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Erro: Arquivo Excel não encontrado em ${excelPath}`);
    process.exit(1);
  }

  console.log(`Lendo arquivo: ${path.basename(excelPath)}...`);
  const workbook = XLSX.readFile(excelPath);
  
  const targetSheetName = 'Relatório Detalhado - ATENDIMEN';
  const actualSheetName = workbook.SheetNames.find(name => 
    name.replace(/\s+/g, ' ').trim() === targetSheetName.replace(/\s+/g, ' ').trim()
  );

  if (!actualSheetName) {
    console.error(`❌ Erro: Aba "${targetSheetName}" não encontrada no arquivo.`);
    process.exit(1);
  }

  console.log(`Utilizando aba: "${actualSheetName}"`);
  const sheet = workbook.Sheets[actualSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Total de linhas lidas da planilha: ${rawRows.length}`);

  // Limites do período permitido
  const startLimit = new Date('2025-12-01T00:00:00.000Z');
  const endLimit = new Date('2026-02-01T00:00:00.000Z');

  let totalInsidePeriod = 0;
  let totalOutsidePeriod = 0;
  let totalDec2025 = 0;
  let totalJan2026 = 0;
  let totalRejected = 0;

  const candidates: any[] = [];

  // Helper para ler campos de forma flexível (case/space insensitive)
  const getField = (row: any, keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined) return row[key];
      const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === key.toLowerCase());
      if (foundKey) return row[foundKey];
    }
    return null;
  };

  for (const row of rawRows) {
    try {
      const dataRaw = getField(row, ['Sessão iniciada - Evento', 'Sessao iniciada - Evento', 'Data', 'Sessao Iniciada']);
      const dateObj = parseDateString(dataRaw);
      
      if (!dateObj) {
        totalRejected++;
        continue;
      }

      // Verifica se está dentro do período permitido (dezembro/2025 e janeiro/2026)
      // sessao_iniciada >= 2025-12-01 00:00:00 e < 2026-02-01 00:00:00
      if (dateObj >= startLimit && dateObj < endLimit) {
        totalInsidePeriod++;
        
        // Separa por mês para auditoria
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth(); // 0-indexed: 11 = Dezembro, 0 = Janeiro
        
        if (year === 2025 && month === 11) {
          totalDec2025++;
        } else if (year === 2026 && month === 0) {
          totalJan2026++;
        }

        const campanha = getField(row, ['Campanha']);
        const fila = getField(row, ['Fila']);
        const usuario = getField(row, ['Usuário', 'Usuario']);
        const telefoneRaw = getField(row, ['Número de telefone', 'Numero de telefone', 'Telefone']);
        const duracaoFilaRaw = getField(row, ['Duração da fila - Total', 'Duracao da fila - Total', 'Fila Duração']);
        const duracaoFalaRaw = getField(row, ['Duração da fala - Total', 'Duracao da fala - Total', 'Fala Duração']);
        const resultadoNome = getField(row, ['Alterar nome do resultado', 'Opcao Selecionada', 'Resultado Nome']);
        const descricaoResultado = getField(row, ['Descrição do resultado do usuário', 'Descricao do resultado', 'Resultado']);
        const resultadoUsuario = getField(row, ['Resultado do usuário', 'Resultado do usuario', 'ResultadoUsuario']);

        const telClean = cleanPhoneNumber(telefoneRaw || '');
        const telMasked = maskPhoneNumber(telClean);
        const telHash = hashPhoneNumber(telClean);
        const duracaoFila = parseDurationToSeconds(duracaoFilaRaw);
        const duracaoFala = parseDurationToSeconds(duracaoFalaRaw);

        candidates.push({
          tipo_relatorio: 'ATENDIMENTO_OPERACAO',
          campanha: campanha ? campanha.toString().trim() : null,
          fila: fila ? fila.toString().trim() : null,
          usuario: usuario ? usuario.toString().trim() : '-',
          numero_telefone: telClean,
          numero_telefone_mascarado: telMasked,
          numero_telefone_hash: telHash,
          sessao_iniciada: dateObj,
          duracao_fila_segundos: duracaoFila,
          duracao_fala_segundos: duracaoFala,
          resultado_nome: resultadoNome ? resultadoNome.toString().trim() : null,
          descricao_resultado: descricaoResultado ? descricaoResultado.toString().trim() : null,
          resultado_usuario: resultadoUsuario ? resultadoUsuario.toString().trim() : null,
          raw_payload: row
        });

      } else {
        totalOutsidePeriod++;
      }
    } catch (err) {
      totalRejected++;
    }
  }

  console.log('\nConsultando registros existentes no período informado no Supabase...');
  
  // Buscar os registros já existentes no Supabase que estejam no mesmo período
  const { data: dbRecords, error: dbError } = await supabase!
    .from('cetesb_eventos')
    .select('tipo_relatorio, campanha, fila, usuario, numero_telefone, sessao_iniciada, duracao_fila_segundos, duracao_fala_segundos, descricao_resultado, resultado_usuario')
    .gte('sessao_iniciada', startLimit.toISOString())
    .lt('sessao_iniciada', endLimit.toISOString());

  if (dbError) {
    console.error(`❌ Erro ao consultar banco de dados: ${dbError.message}`);
    process.exit(1);
  }

  console.log(`Registros existentes encontrados na base (nesse período): ${dbRecords?.length || 0}`);

  // Mapear os registros do banco em chaves únicas para deduplicação rápida em O(1)
  const existingKeys = new Set<string>();
  if (dbRecords) {
    for (const rec of dbRecords) {
      existingKeys.add(generateEventKey(rec));
    }
  }

  const newRecords: any[] = [];
  const duplicateRecords: any[] = [];

  for (const cand of candidates) {
    const key = generateEventKey(cand);
    if (existingKeys.has(key)) {
      duplicateRecords.push(cand);
    } else {
      newRecords.push(cand);
      // Para o caso de haver duplicatas dentro da própria planilha, adicionamos a chave temporariamente
      existingKeys.add(key);
    }
  }

  console.log('\n================================================================');
  console.log('   RESULTADOS DA ANÁLISE PRÉ-IMPORTAÇÃO');
  console.log('================================================================');
  console.log(`Total de linhas lidas da planilha:      ${rawRows.length}`);
  console.log(`Total de linhas dentro do período:      ${totalInsidePeriod}`);
  console.log(`Total de linhas fora do período:        ${totalOutsidePeriod} (Ignoradas)`);
  console.log(`Total rejeitado por inconsistência:    ${totalRejected}`);
  console.log('----------------------------------------------------------------');
  console.log(`Total candidatos de Dezembro/2025:      ${totalDec2025}`);
  console.log(`Total candidatos de Janeiro/2026:       ${totalJan2026}`);
  console.log(`Total já existente no Supabase (no per.): ${dbRecords?.length || 0}`);
  console.log('----------------------------------------------------------------');
  console.log(`Total NOVO que será importado:          ${newRecords.length}`);
  console.log(`Total DUPLICADO que será ignorado:      ${duplicateRecords.length}`);
  console.log('================================================================\n');

  // Amostra de 10 registros novos (mascarando telefone)
  console.log('--- AMOSTRA DE 10 REGISTROS NOVOS ---');
  if (newRecords.length === 0) {
    console.log('Nenhum registro novo encontrado.');
  } else {
    newRecords.slice(0, 10).forEach((r, idx) => {
      console.log(`[Novo #${idx + 1}] Data: ${r.sessao_iniciada.toLocaleString('pt-BR')} | Campanha: ${r.campanha || '-'} | Fila: ${r.fila || '-'} | Operador: ${r.usuario || '-'} | Tel: ${r.numero_telefone_mascarado} | Fila: ${r.duracao_fila_segundos}s | Fala: ${r.duracao_fala_segundos}s | Resultado: ${r.resultado_usuario || '-'}`);
    });
  }

  // Amostra de 10 duplicados (mascarando telefone)
  console.log('\n--- AMOSTRA DE 10 REGISTROS DUPLICADOS ---');
  if (duplicateRecords.length === 0) {
    console.log('Nenhum registro duplicado encontrado.');
  } else {
    duplicateRecords.slice(0, 10).forEach((r, idx) => {
      console.log(`[Duplicado #${idx + 1}] Data: ${r.sessao_iniciada.toLocaleString('pt-BR')} | Campanha: ${r.campanha || '-'} | Fila: ${r.fila || '-'} | Operador: ${r.usuario || '-'} | Tel: ${r.numero_telefone_mascarado} | Fila: ${r.duracao_fila_segundos}s | Fala: ${r.duracao_fala_segundos}s | Resultado: ${r.resultado_usuario || '-'}`);
    });
  }
  console.log('\n================================================================\n');
}

run();
