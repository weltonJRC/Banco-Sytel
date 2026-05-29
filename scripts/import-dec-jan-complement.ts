import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
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

// Função auxiliar para calcular SHA-256 de um arquivo
function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

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
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');

  console.log('================================================================');
  console.log('   IMPORTADOR COMPLEMENTAR EXCEL -> SUPABASE - PORTAL CETESB   ');
  console.log('================================================================\n');

  if (isApply) {
    console.log('🔥 MODO ATIVO: --apply detectado! Os dados serão inseridos de verdade.');
  } else {
    console.log('🛡️  MODO DRY-RUN (SIMULAÇÃO) POR PADRÃO. Nenhuma inserção será feita.');
    console.log('Para gravar no banco execute com: npm run import:dec-jan -- --apply\n');
  }

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
  const fileHash = calculateFileHash(excelPath);
  console.log(`  Hash SHA-256 do arquivo: ${fileHash}`);

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

      if (dateObj >= startLimit && dateObj < endLimit) {
        totalInsidePeriod++;
        
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        
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
          tenant: 'CETESB',
          tipo_relatorio: 'ATENDIMENTO_OPERACAO',
          fonte_oficial: 'COMPLEMENTO_DEZ_2025_JAN_2026',
          arquivo_origem: path.basename(excelPath),
          hash_arquivo: fileHash,
          status_validacao: 'VALIDADO',
          
          campanha: campanha ? campanha.toString().trim() : null,
          fila: fila ? fila.toString().trim() : null,
          usuario: usuario ? usuario.toString().trim() : '-',
          
          numero_telefone: telClean,
          numero_telefone_mascarado: telMasked,
          numero_telefone_hash: telHash,
          
          sessao_iniciada: dateObj.toISOString(),
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

  const existingKeys = new Set<string>();
  if (dbRecords) {
    for (const rec of dbRecords) {
      existingKeys.add(generateEventKey(rec));
    }
  }

  const toInsert: any[] = [];
  const duplicateCount = { count: 0 };

  for (const cand of candidates) {
    const key = generateEventKey(cand);
    if (existingKeys.has(key)) {
      duplicateCount.count++;
    } else {
      toInsert.push(cand);
      existingKeys.add(key); // Evita duplicatas internas da planilha
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Candidatos prontos para importação: ${toInsert.length}`);
  console.log(`Duplicados que serão ignorados:   ${duplicateCount.count}`);
  console.log('----------------------------------------------------------------\n');

  if (toInsert.length === 0) {
    console.log('✅ Nenhum registro novo a ser inserido. A base já está atualizada!');
    process.exit(0);
  }

  if (isApply) {
    // 1. Registra no import_files se não estiver registrado
    const { data: existingImport } = await supabase!
      .from('import_files')
      .select('id')
      .eq('file_hash_sha256', fileHash)
      .maybeSingle();

    let importRecordId: any = null;

    if (!existingImport) {
      const { data: newImport, error: importErr } = await supabase!
        .from('import_files')
        .insert({
          source_system: 'Sytel Complement 2025-2026',
          source_type: 'EXCEL',
          file_name: path.basename(excelPath),
          file_path: excelPath,
          file_hash_sha256: fileHash,
          import_status: 'PROCESSANDO',
          notes: 'Importação complementar dezembro 2025 e janeiro 2026'
        })
        .select()
        .single();

      if (importErr) {
        console.warn(`⚠️  [Aviso] Falha ao registrar início da importação de arquivos: ${importErr.message}`);
      } else {
        importRecordId = newImport.id;
      }
    } else {
      importRecordId = existingImport.id;
    }

    console.log(`Inserindo ${toInsert.length} novos registros em lotes de 1000 no Supabase...`);
    let totalInserted = 0;
    const batchSize = 1000;

    for (let i = 0; i < toInsert.length; i += batchSize) {
      const chunk = toInsert.slice(i, i + batchSize);
      const { error: insertErr } = await supabase!
        .from('cetesb_eventos')
        .insert(chunk);

      if (insertErr) {
        console.error(`❌ [Erro] Falha ao inserir lote de dados: ${insertErr.message}`);
        totalRejected += chunk.length;
      } else {
        totalInserted += chunk.length;
      }
    }

    console.log(`✅ Inseridos com sucesso: ${totalInserted} registros!`);

    // Atualiza auditoria do arquivo em import_files
    if (importRecordId) {
      await supabase!
        .from('import_files')
        .update({
          import_status: 'SUCESSO',
          reference_start_date: '2025-12-01',
          reference_end_date: '2026-01-31',
          total_rows: totalInsidePeriod,
          notes: `Importado complemento com sucesso. Total novos: ${totalInserted}. Duplicados ignorados: ${duplicateCount.count}`
        })
        .eq('id', importRecordId);
    }

    // TAREFA 9 — Atualizar cache de filtros
    console.log('\nAtualizando cache de filtros (cetesb_filter_options_cache)...');
    try {
      // Executa o refresh original via RPC
      const { error: rpcErr } = await supabase!.rpc('refresh_filter_options_cache');
      if (rpcErr) throw rpcErr;
      
      // Busca o registro atualizado para adicionar a nova fonte
      const { data: cacheRow, error: cacheErr } = await supabase!
        .from('cetesb_filter_options_cache')
        .select('*')
        .eq('report_type', 'ATENDIMENTO_OPERACAO')
        .single();
      
      if (cacheErr) throw cacheErr;
      
      if (cacheRow && cacheRow.options) {
        const options = cacheRow.options;
        const fontes: string[] = options.fontes || [];
        
        if (!fontes.includes('COMPLEMENTO_DEZ_2025_JAN_2026')) {
          fontes.push('COMPLEMENTO_DEZ_2025_JAN_2026');
        }
        options.fontes = fontes;
        
        // Atualiza a linha no banco de dados com a fonte inclusa
        const { error: updateErr } = await supabase!
          .from('cetesb_filter_options_cache')
          .update({
            options,
            updated_at: new Date().toISOString()
          })
          .eq('report_type', 'ATENDIMENTO_OPERACAO');
        
        if (updateErr) throw updateErr;
        console.log('✅ Cache de filtros atualizado com sucesso com a nova fonte "COMPLEMENTO_DEZ_2025_JAN_2026"!');
      }
    } catch (err: any) {
      console.warn(`⚠️  [Aviso] Falha ao atualizar cache de filtros: ${err.message || err}`);
    }

  } else {
    console.log('🛡️  MODO SIMULAÇÃO CONCLUÍDO.');
    console.log(`Nenhum dado real foi inserido. Seriam inseridos ${toInsert.length} novos registros.`);
  }

  // Estatísticas Finais de Mês
  let countDecNew = 0;
  let countJanNew = 0;
  toInsert.forEach(r => {
    const d = new Date(r.sessao_iniciada);
    if (d.getFullYear() === 2025 && d.getMonth() === 11) {
      countDecNew++;
    } else if (d.getFullYear() === 2026 && d.getMonth() === 0) {
      countJanNew++;
    }
  });

  console.log('\n================================================================');
  console.log('   RESUMO DA IMPORTAÇÃO COMPLEMENTAR');
  console.log('================================================================');
  console.log(`Status de Aplicação:            ${isApply ? 'APLICADO NO BANCO' : 'SIMULADO (DRY-RUN)'}`);
  console.log(`Total de linhas lidas:           ${rawRows.length}`);
  console.log(`Total no período (candidatos):   ${totalInsidePeriod}`);
  console.log(`Total fora do período ignorado:  ${totalOutsidePeriod}`);
  console.log(`Total com erro/rejeitado:        ${totalRejected}`);
  console.log(`Total duplicado ignorado:        ${duplicateCount.count}`);
  console.log('----------------------------------------------------------------');
  console.log(`Total inserido/novo geral:       ${toInsert.length}`);
  console.log(`  -> Novos Dezembro/2025:        ${countDecNew} (Esperado: ~11.559)`);
  console.log(`  -> Novos Janeiro/2026:         ${countJanNew} (Esperado: ~13.482)`);
  console.log('================================================================\n');
}

run();
