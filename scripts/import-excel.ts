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

// Inicialização condicional do Supabase
const hasSupabase = !!(supabaseUrl && supabaseServiceKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseServiceKey) : null;

/**
 * Auxiliar para calcular SHA-256 de um arquivo
 */
function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function run() {
  console.log('================================================================');
  console.log('   IMPORTADOR HISTÓRICO EXCEL -> SUPABASE - PORTAL CETESB   ');
  console.log('================================================================\n');

  if (!hasSupabase) {
    console.warn('⚠️  [ATENÇÃO] Supabase não configurado.');
    console.warn('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env ou execute em modo mock.');
    console.log('\nO script foi encerrado de forma amigável para não quebrar a execução local.\n');
    process.exit(0);
  }

  const rawDir = path.join(process.cwd(), 'data', 'raw');
  if (!fs.existsSync(rawDir)) {
    console.error(`[Erro] Diretório data/raw não existe.`);
    return;
  }

  const files = [
    {
      name: 'Dados Detalhados - KPI 6 MESES.XLSX',
      sourceSystem: 'RVAggregator Recovered 2025',
      sourceOfficial: 'EXCEL_2025',
      sourceType: 'EXCEL',
      sheets: [
        {
          name: 'Relatório Detalhado - ATENDIMEN',
          tipo: 'ATENDIMENTO_OPERACAO'
        },
        {
          name: 'Relatório Detalhado - URA CETE',
          tipo: 'URA'
        }
      ]
    },
    {
      name: 'Relatório Detalhado - ATENDIMENTOS OPERAÇÃO_20260527-163621.XLSX',
      sourceSystem: 'Sytel Operator Export 2026',
      sourceOfficial: 'SYTEL_2026',
      sourceType: 'EXCEL',
      sheets: [
        {
          name: 'Relatório Detalhado - ATENDIMEN',
          tipo: 'ATENDIMENTO_OPERACAO'
        }
      ]
    }
  ];

  let totalRead = 0;
  let totalInserted = 0;
  let totalRejected = 0;
  let globalMinDate: Date | null = null;
  let globalMaxDate: Date | null = null;
  
  const typeCounts = { ATENDIMENTO_OPERACAO: 0, URA: 0 };
  const sourceCounts = { EXCEL_2025: 0, SYTEL_2026: 0 };

  for (const fileDef of files) {
    const filePath = path.join(rawDir, fileDef.name);
    
    if (!fs.existsSync(filePath)) {
      console.log(`[Aviso] Arquivo de origem não encontrado na pasta data/raw: ${fileDef.name}. Pulando...`);
      continue;
    }

    console.log(`Processando: ${fileDef.name}...`);
    const fileHash = calculateFileHash(filePath);
    console.log(`  Hash SHA-256: ${fileHash}`);

    // Abre a planilha
    const workbook = XLSX.readFile(filePath);

    // 1. Registra início do arquivo em import_files
    const { data: importRecord, error: importErr } = await supabase!
      .from('import_files')
      .insert({
        source_system: fileDef.sourceSystem,
        source_type: fileDef.sourceType,
        file_name: fileDef.name,
        file_path: filePath,
        file_hash_sha256: fileHash,
        import_status: 'PROCESSANDO',
        notes: `Importação automatizada via CLI`
      })
      .select()
      .single();

    if (importErr) {
      console.error(`  [Erro] Falha ao registrar arquivo no banco (Provável hash duplicado): ${importErr.message}`);
      console.log('  Pulando arquivo para evitar re-processamento.\n');
      continue;
    }

    let fileRowsCount = 0;
    let fileMinDate: Date | null = null;
    let fileMaxDate: Date | null = null;

    for (const sheetDef of fileDef.sheets) {
      // Busca a aba de forma resiliente, ignorando diferenças de espaços múltiplos ou nas extremidades
      const actualSheetName = workbook.SheetNames.find(name => 
        name.replace(/\s+/g, ' ').trim() === sheetDef.name.replace(/\s+/g, ' ').trim()
      );
      
      const sheet = actualSheetName ? workbook.Sheets[actualSheetName] : null;
      if (!sheet) {
        console.warn(`  [Aviso] Aba "${sheetDef.name}" não encontrada no arquivo ${fileDef.name}.`);
        continue;
      }

      // Converte planilha em matriz de objetos
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);
      console.log(`  Aba "${sheetDef.name}": ${rawRows.length} linhas identificadas.`);

      const batchToInsert: any[] = [];

      for (const row of rawRows) {
        totalRead++;
        fileRowsCount++;

        try {
          // Extração dos campos mapeados (Case Insensitive de cabeçalhos)
          const getField = (keys: string[]) => {
            for (const key of keys) {
              if (row[key] !== undefined) return row[key];
              // Tenta achar com espaços extras ou variação de case
              const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === key.toLowerCase());
              if (foundKey) return row[foundKey];
            }
            return null;
          };

          const campanha = getField(['Campanha']);
          const fila = getField(['Fila']);
          const usuario = getField(['Usuário', 'Usuario']);
          const telefoneRaw = getField(['Número de telefone', 'Numero de telefone', 'Telefone']);
          const dataRaw = getField(['Sessão iniciada - Evento', 'Sessao iniciada - Evento', 'Data', 'Sessao Iniciada']);
          
          const duracaoFilaRaw = getField(['Duração da fila - Total', 'Duracao da fila - Total', 'Fila Duração']);
          const duracaoFalaRaw = getField(['Duração da fala - Total', 'Duracao da fala - Total', 'Fala Duração']);
          
          const resultadoNome = getField(['Alterar nome do resultado', 'Opcao Selecionada', 'Resultado Nome']);
          const descricaoResultado = getField(['Descrição do resultado do usuário', 'Descricao do resultado', 'Resultado']);
          const resultadoUsuario = getField(['Resultado do usuário', 'Resultado do usuario', 'ResultadoUsuario']);

          // Transformação e Validações
          const dateObj = parseDateString(dataRaw);
          if (!dateObj) {
            totalRejected++;
            continue; // Ignora se não houver data válida
          }

          // Atualiza limites de datas
          if (!fileMinDate || dateObj < fileMinDate) fileMinDate = dateObj;
          if (!fileMaxDate || dateObj > fileMaxDate) fileMaxDate = dateObj;
          if (!globalMinDate || dateObj < globalMinDate) globalMinDate = dateObj;
          if (!globalMaxDate || dateObj > globalMaxDate) globalMaxDate = dateObj;

          const telClean = cleanPhoneNumber(telefoneRaw || '');
          const telMasked = maskPhoneNumber(telClean);
          const telHash = hashPhoneNumber(telClean);

          const duracaoFila = parseDurationToSeconds(duracaoFilaRaw);
          const duracaoFala = parseDurationToSeconds(duracaoFalaRaw);

          const insertObj = {
            tenant: 'CETESB',
            tipo_relatorio: sheetDef.tipo,
            fonte_oficial: fileDef.sourceOfficial,
            arquivo_origem: fileDef.name,
            hash_arquivo: fileHash,
            status_validacao: 'VALIDADO',
            
            campanha: campanha ? campanha.toString().trim() : null,
            fila: fila ? fila.toString().trim() : null,
            usuario: sheetDef.tipo === 'URA' ? null : (usuario ? usuario.toString().trim() : '-'),
            
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
          };

          batchToInsert.push(insertObj);
          
          // Agrupamentos estatísticos rápidos
          typeCounts[sheetDef.tipo as keyof typeof typeCounts]++;
          sourceCounts[fileDef.sourceOfficial as keyof typeof sourceCounts]++;

        } catch (rowErr) {
          totalRejected++;
        }
      }

      // Inserção em lotes de 1000 no Supabase
      const batchSize = 1000;
      for (let i = 0; i < batchToInsert.length; i += batchSize) {
        const chunk = batchToInsert.slice(i, i + batchSize);
        const { error: insertErr } = await supabase!
          .from('cetesb_eventos')
          .insert(chunk);

        if (insertErr) {
          console.error(`    [Erro] Falha ao inserir lote de dados: ${insertErr.message}`);
          totalRejected += chunk.length;
        } else {
          totalInserted += chunk.length;
        }
      }
    }

    // 2. Finaliza auditoria do arquivo em import_files
    await supabase!
      .from('import_files')
      .update({
        import_status: 'SUCESSO',
        reference_start_date: fileMinDate ? fileMinDate.toISOString().substring(0, 10) : null,
        reference_end_date: fileMaxDate ? fileMaxDate.toISOString().substring(0, 10) : null,
        total_rows: fileRowsCount,
        notes: `Importado com sucesso. Período: ${fileMinDate?.toLocaleDateString()} a ${fileMaxDate?.toLocaleDateString()}`
      })
      .eq('id', importRecord.id);

    console.log(`  Sucesso! Arquivo processado.`);
  }

  // Resumo no terminal
  console.log('\n================================================================');
  console.log('   RESUMO DA IMPORTAÇÃO HISTÓRICA');
  console.log('================================================================');
  console.log(`Total de linhas lidas:           ${totalRead}`);
  console.log(`Total inserido no Supabase:      ${totalInserted}`);
  console.log(`Total rejeitado (Sem data/erro): ${totalRejected}`);
  console.log(`Duração do período geral:        ${globalMinDate ? globalMinDate.toLocaleDateString() : '-'} a ${globalMaxDate ? globalMaxDate.toLocaleDateString() : '-'}`);
  console.log('----------------------------------------------------------------');
  console.log(`Registros de Atendimento Humano: ${typeCounts.ATENDIMENTO_OPERACAO}`);
  console.log(`Registros de URA Eletrônica:     ${typeCounts.URA}`);
  console.log(`Origem Histórica Excel 2025:     ${sourceCounts.EXCEL_2025}`);
  console.log(`Origem Sytel 2026:               ${sourceCounts.SYTEL_2026}`);
  console.log('================================================================\n');
}

run();
