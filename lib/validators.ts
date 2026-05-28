/**
 * Utilitários para auditoria e validação de consistência dos dados
 */

export interface ValidationIssue {
  id: number | string;
  tipo_relatorio: string;
  campanha: string;
  fila: string;
  sessao_iniciada: string;
  issue_type: 'MISSING_DATE' | 'MISSING_CAMPAGNA' | 'PROBABLE_DUPLICATE';
  description: string;
}

/**
 * Valida a consistência de um único registro.
 */
export function validateRecord(e: any): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!e.sessao_iniciada) {
    issues.push('Sessão iniciada (data/hora) vazia ou nula');
  }
  
  if (!e.campanha || e.campanha.trim() === '') {
    issues.push('Campanha não informada');
  }
  
  if (!e.fila || e.fila.trim() === '') {
    issues.push('Fila não informada');
  }
  
  if (e.tipo_relatorio === 'ATENDIMENTO_OPERACAO' && (!e.usuario || e.usuario === '-')) {
    // Apenas aviso, não invalida o registro per se
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Detecta registros duplicados prováveis baseado nos campos determinísticos:
 * - Hash do Telefone
 * - Sessão Iniciada
 * - Fila
 * - Duração de Fala
 */
export function detectDuplicates(events: any[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenKeys = new Map<string, any>();

  events.forEach(e => {
    if (!e.sessao_iniciada || !e.numero_telefone_hash) return;

    // Chave de comparação determinística
    const key = `${e.numero_telefone_hash}_${new Date(e.sessao_iniciada).getTime()}_${e.fila || ''}_${e.duracao_fala_segundos ?? 0}`;

    if (seenKeys.has(key)) {
      const original = seenKeys.get(key);
      issues.push({
        id: e.id,
        tipo_relatorio: e.tipo_relatorio,
        campanha: e.campanha || 'N/A',
        fila: e.fila || 'N/A',
        sessao_iniciada: e.sessao_iniciada,
        issue_type: 'PROBABLE_DUPLICATE',
        description: `Duplicado provável do registro ID ${original.id} (Mesmo telefone, data, fila e duração)`
      });
    } else {
      seenKeys.set(key, e);
    }
  });

  return issues;
}
