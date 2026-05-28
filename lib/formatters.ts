/**
 * formatters.ts — Funções de formatação CLIENT-SAFE
 *
 * Este arquivo NÃO importa módulos Node.js (crypto, fs, etc).
 * Para hashPhoneNumber, usar lib/formatters.server.ts (server-only).
 */

/**
 * Remove todos os caracteres não-numéricos de uma string de telefone.
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.toString().replace(/\D/g, '');
}

/**
 * Gera a máscara do telefone.
 * Exemplo: "11985012885" -> "119****2885"
 * Exemplo: "1138502885" -> "113****2885"
 */
export function maskPhoneNumber(phone: string): string {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '-';
  
  if (cleaned.length === 11) {
    // Celular: "11985012885" -> "119" + "****" + "2885"
    return `${cleaned.substring(0, 3)}****${cleaned.substring(7)}`;
  } else if (cleaned.length === 10) {
    // Fixo: "1138502885" -> "113" + "****" + "2885"
    return `${cleaned.substring(0, 3)}****${cleaned.substring(6)}`;
  } else if (cleaned.length > 4) {
    // Outros comprimentos: deixa os 3 primeiros e os 2 últimos
    return `${cleaned.substring(0, 3)}****${cleaned.substring(cleaned.length - 2)}`;
  }
  return '****';
}

/**
 * Converte segundos inteiros para string no formato mm:ss ou hh:mm:ss.
 * Exemplo: 10 -> "00:10"
 * Exemplo: 151 -> "02:31"
 * Exemplo: 3665 -> "01:01:05"
 */
export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '00:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const pad = (num: number) => num.toString().padStart(2, '0');
  
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Converte strings de duração para segundos inteiros.
 * Exemplo: "00:10" -> 10
 * Exemplo: "02:31" -> 151
 * Exemplo: "10:31" -> 631
 * Exemplo: "01:05:30" -> 3930
 */
export function parseDurationToSeconds(durationStr: string | null | undefined): number {
  if (!durationStr) return 0;
  
  const parts = durationStr.toString().trim().split(':');
  if (parts.length === 2) {
    // Formato mm:ss
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return (mins * 60) + secs;
  } else if (parts.length === 3) {
    // Formato hh:mm:ss
    const hrs = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    const secs = parseInt(parts[2], 10) || 0;
    return (hrs * 3600) + (mins * 60) + secs;
  }
  
  // Se for apenas um número
  const parsed = parseInt(durationStr, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Converte data strings ou Date objects para o formato brasileiro legível DD/MM/AAAA HH:MM:SS.
 */
export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return '-';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return '-';
  }
}

/**
 * Converte formatos variados de data (como "2/02/26 09:55:03", string ISO, ou datas internas do Excel)
 * para um Date object válido.
 */
export function parseDateString(dateInput: any): Date | null {
  if (!dateInput) return null;
  
  // Se já for um Date object
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  
  const str = dateInput.toString().trim();
  
  // Caso seja formato DD/MM/AA HH:MM:SS ou D/MM/AA HH:MM:SS
  const dmyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
  const match = str.match(dmyRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed
    let year = parseInt(match[3], 10);
    if (year < 100) {
      year += year < 50 ? 2000 : 1900; // Ajusta ano em dois dígitos
    }
    const hrs = parseInt(match[4], 10);
    const mins = parseInt(match[5], 10);
    const secs = parseInt(match[6], 10);
    
    const d = new Date(year, month, day, hrs, mins, secs);
    return isNaN(d.getTime()) ? null : d;
  }
  
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Escapa caracteres especiais para uso seguro em patterns SQL ilike.
 * Impede que `%`, `_` e `\` no input do usuário manipulem o pattern.
 */
export function sanitizeIlikeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
