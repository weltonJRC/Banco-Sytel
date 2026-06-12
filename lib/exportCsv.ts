/**
 * exportCsv.ts — Utilitário de exportação CSV client-side
 *
 * Gera e dispara o download de um arquivo CSV a partir de cabeçalhos e linhas de dados.
 * Usa separador ";" e BOM UTF-8 para compatibilidade com Excel brasileiro.
 *
 * Campos críticos (telefone, data/hora, duração) podem ser protegidos via
 * safeTextColumns para evitar que o Excel converta valores automaticamente.
 */

/**
 * Escapa uma célula CSV normal:
 * - Se contiver ";", aspas ou quebras de linha, envolve em aspas duplas.
 * - Escapa aspas internas duplicando-as.
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
 * Protege uma célula como texto puro no CSV usando a fórmula ="VALOR".
 * Garante que o Excel não converta telefones, datas e durações automaticamente.
 * Caracteres especiais dentro do valor são escaped com aspas duplas.
 */
function escapeCsvCellSafe(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Usa ="valor" — o Excel abre como texto puro, preservando zeros e formato
  const inner = str.replace(/"/g, '""');
  return `="${inner}"`;
}

/**
 * Gera e dispara o download de um arquivo CSV.
 *
 * @param headers      - Cabeçalhos da tabela
 * @param rows         - Linhas de dados (array de arrays)
 * @param filename     - Nome do arquivo (com ou sem .csv)
 * @param safeTextColumns - Índices das colunas que devem ser protegidas com ="valor"
 *                         (telefone, data/hora, duração). Default: [] (sem proteção).
 */
export function exportToCsv(
  headers: string[],
  rows: any[][],
  filename: string,
  safeTextColumns: number[] = []
): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const safeSet = new Set(safeTextColumns);

    const formatCell = (val: any, colIndex: number): string => {
      if (safeSet.has(colIndex)) {
        return escapeCsvCellSafe(val);
      }
      return escapeCsvCell(val);
    };

    const csvLines: string[] = [];

    // Cabeçalhos nunca são protegidos com ="..."
    csvLines.push(headers.map(escapeCsvCell).join(';'));

    // Dados — aplica proteção conforme safeTextColumns
    for (const row of rows) {
      csvLines.push(row.map((cell, idx) => formatCell(cell, idx)).join(';'));
    }

    const csvString = csvLines.join('\r\n');

    // \uFEFF = BOM UTF-8 — força o Excel a interpretar acentos corretamente
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Libera memória do blob URL
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('[ExportCSV] Falha ao exportar CSV:', error);
    return false;
  }
}
