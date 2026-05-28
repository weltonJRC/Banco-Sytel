/**
 * Gera e dispara o download de um arquivo CSV a partir de cabeçalhos e linhas de dados.
 * Utiliza o separador de ponto e vírgula ";" e o caractere BOM UTF-8 para compatibilidade automática com Excel brasileiro.
 */
export function exportToCsv(headers: string[], rows: any[][], filename: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = val.toString();
      // Se houver aspas, ponto-e-vírgula ou quebras de linha, envolve em aspas duplas
      if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      }
      return str;
    };

    const csvContent: string[] = [];
    
    // Adiciona cabeçalhos
    csvContent.push(headers.map(escapeCell).join(';'));
    
    // Adiciona linhas de dados
    rows.forEach(row => {
      csvContent.push(row.map(escapeCell).join(';'));
    });

    const csvString = csvContent.join('\r\n');
    
    // \uFEFF força o Excel a interpretar o arquivo em UTF-8 com acentos corretos
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Libera memória do blob URL (fix memory leak)
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('[ExportCSV Error] Falha ao exportar CSV:', error);
    return false;
  }
}
