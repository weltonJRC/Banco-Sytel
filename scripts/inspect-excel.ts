import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

/**
 * Script de Inspeção de Arquivos Excel
 * Analisa a estrutura de planilhas na pasta data/raw e exibe metadados, abas, colunas e volumes.
 */
async function run() {
  console.log('================================================================');
  console.log('   INSPEÇÃO DE PLANILHAS HISTÓRICAS - PORTAL CETESB   ');
  console.log('================================================================\n');

  const rawDir = path.join(process.cwd(), 'data', 'raw');
  
  if (!fs.existsSync(rawDir)) {
    console.error(`[Erro] Pasta de dados raw não encontrada: ${rawDir}`);
    console.log('Crie a pasta ou configure seu ambiente.');
    return;
  }

  const files = fs.readdirSync(rawDir).filter(f => f.toLowerCase().endsWith('.xlsx'));

  if (files.length === 0) {
    console.log(`[Aviso] Nenhum arquivo Excel (.xlsx) encontrado em: ${rawDir}\n`);
    console.log('Por favor, coloque as planilhas históricas na pasta data/raw:');
    console.log('1. "Dados Detalhados - KPI 6 MESES.XLSX"');
    console.log('2. "Relatório Detalhado - ATENDIMENTOS OPERAÇÃO_20260527-163621.XLSX"\n');
    return;
  }

  console.log(`Encontrado(s) ${files.length} arquivo(s) Excel para inspeção:\n`);

  for (const file of files) {
    const filePath = path.join(rawDir, file);
    const stats = fs.statSync(filePath);
    
    console.log(`----------------------------------------------------------------`);
    console.log(`ARQUIVO: ${file}`);
    console.log(`Tamanho: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`----------------------------------------------------------------`);

    try {
      // Abre a planilha carregando apenas os metadados e estrutura para performance
      const workbook = XLSX.readFile(filePath, { sheetRows: 50 }); // inspeciona primeiras 50 linhas para colunas
      const sheetNames = workbook.SheetNames;
      
      console.log(`Abas encontradas (${sheetNames.length}): ${sheetNames.join(', ')}\n`);

      // Recarrega sem limitação de linhas para contagem exata e data edges
      const fullWorkbook = XLSX.readFile(filePath);

      for (const sheetName of sheetNames) {
        const sheet = fullWorkbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (rows.length === 0) {
          console.log(`   Aba "${sheetName}": Vazia.`);
          continue;
        }

        const headers = rows[0] as string[];
        const totalRows = Math.max(rows.length - 1, 0); // Exclui cabeçalho
        
        console.log(`   Aba: "${sheetName}"`);
        console.log(`    Total de linhas físicas: ${totalRows}`);
        console.log(`    Colunas identificadas (${headers.length}):`);
        console.log(`      ${headers.map((h, i) => `[${i}] "${h}"`).join(', ')}`);

        // Tenta achar colunas de data
        const dateHeaders = ['sessão iniciada', 'sessao iniciada', 'data', 'início', 'inicio', 'evento'];
        const dateColIdx = headers.findIndex(h => 
          h && dateHeaders.some(dh => h.toLowerCase().includes(dh))
        );

        if (dateColIdx !== -1) {
          let minDate: Date | null = null;
          let maxDate: Date | null = null;

          // Percorre linhas para achar limites de datas
          for (let i = 1; i < rows.length; i++) {
            const val = rows[i][dateColIdx];
            if (!val) continue;
            
            let d: Date | null = null;
            if (val instanceof Date) {
              d = val;
            } else if (typeof val === 'number') {
              // Converte data serial do Excel
              d = XLSX.SSF.parse_date_code(val) ? new Date((val - 25569) * 86400 * 1000) : null;
            } else {
              d = new Date(val.toString());
            }

            if (d && !isNaN(d.getTime())) {
              if (!minDate || d < minDate) minDate = d;
              if (!maxDate || d > maxDate) maxDate = d;
            }
          }

          if (minDate && maxDate) {
            console.log(`    Período identificado: ${minDate.toLocaleDateString('pt-BR')} a ${maxDate.toLocaleDateString('pt-BR')}`);
          }
        }
        console.log('');
      }
    } catch (err: any) {
      console.error(`    [Erro] Falha ao processar arquivo: ${err.message}`);
    }
  }
}

run();
