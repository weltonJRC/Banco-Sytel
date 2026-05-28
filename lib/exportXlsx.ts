import * as XLSX from 'xlsx';

/**
 * Gera e baixa uma planilha legítima do Excel (.xlsx) usando a biblioteca SheetJS.
 * Ajusta automaticamente a largura das colunas de acordo com o conteúdo.
 */
export function exportToXlsx(headers: string[], rows: any[][], filename: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // Une cabeçalhos e linhas em uma única matriz
    const wsData = [headers, ...rows];
    
    // Cria planilha (worksheet)
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Cria pasta de trabalho (workbook)
    const wb = XLSX.utils.book_new();
    
    // Associa a planilha à pasta de trabalho
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    
    // Cálculo de largura dinâmica das colunas para melhor visualização (auto-fit)
    const colWidths = headers.map((header, colIndex) => {
      let maxLen = header.length;
      rows.forEach(row => {
        const val = row[colIndex];
        if (val !== null && val !== undefined) {
          const len = val.toString().length;
          if (len > maxLen) maxLen = len;
        }
      });
      // Adiciona margem de segurança de 3 caracteres, limitando ao máximo de 50
      return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
    });
    
    ws['!cols'] = colWidths;
    
    // Grava e dispara o download do arquivo binário
    XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('[ExportXLSX Error] Falha ao gerar planilha Excel (.xlsx):', error);
    return false;
  }
}
