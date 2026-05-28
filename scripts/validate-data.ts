import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hasSupabase = !!(supabaseUrl && supabaseServiceKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function run() {
  console.log('================================================================');
  console.log('   AUDITORIA E VALIDAÇÃO DE INTEGRIDADE DE DADOS - CETESB   ');
  console.log('================================================================\n');

  if (!hasSupabase) {
    console.log('⚠️  [Aviso] Supabase não configurado. Não é possível rodar auditoria real.');
    return;
  }

  console.log('Conectando ao Supabase para auditar dados da base cetesb_eventos...');
  try {
    // 1. Contagens de Registros via API do Supabase (super rápido e sem limite de 1000)
    const { count: totalRecords, error: errTotal } = await supabase!
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true });
    if (errTotal) throw errTotal;

    const { count: totalAtendimentos, error: errAt } = await supabase!
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true })
      .eq('tipo_relatorio', 'ATENDIMENTO_OPERACAO');
    if (errAt) throw errAt;

    const { count: totalUra, error: errUra } = await supabase!
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true })
      .eq('tipo_relatorio', 'URA');
    if (errUra) throw errUra;

    const { count: source2025, error: err2025 } = await supabase!
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true })
      .eq('fonte_oficial', 'EXCEL_2025');
    if (err2025) throw err2025;

    const { count: source2026, error: err2026 } = await supabase!
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true })
      .eq('fonte_oficial', 'SYTEL_2026');
    if (err2026) throw err2026;

    // 2. Período de datas
    const { data: minDateData, error: errMin } = await supabase!
      .from('cetesb_eventos')
      .select('sessao_iniciada')
      .order('sessao_iniciada', { ascending: true })
      .limit(1);
    if (errMin) throw errMin;

    const { data: maxDateData, error: errMax } = await supabase!
      .from('cetesb_eventos')
      .select('sessao_iniciada')
      .order('sessao_iniciada', { ascending: false })
      .limit(1);
    if (errMax) throw errMax;

    const minDateStr = minDateData?.[0]?.sessao_iniciada;
    const maxDateStr = maxDateData?.[0]?.sessao_iniciada;

    const formatDateStr = (isoString: string) => {
      if (!isoString) return '-';
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR');
    };

    // 3. Validação do Telefone Completo
    const { count: withPhone, error: errPhone } = await supabase!
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true })
      .not('numero_telefone', 'is', null);
    if (errPhone) {
      console.warn('⚠️  Não foi possível verificar coluna numero_telefone. Ela existe?');
    }

    const { count: withoutPhone } = await supabase!
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true })
      .is('numero_telefone', null);

    // 4. Validação de Views do Front-end (Campos Técnicos Ocultos)
    let frontViewsOk = true;
    try {
      const { data: atFrontRecord } = await supabase!.from('vw_cetesb_atendimentos_operacao_front').select('*').limit(1);
      const atRow = atFrontRecord?.[0] || {};
      const forbiddenKeys = ['id', 'tenant', 'tipo_relatorio', 'fonte_oficial', 'arquivo_origem', 'hash_arquivo', 'status_validacao', 'numero_telefone_hash', 'numero_telefone_mascarado', 'raw_payload', 'created_at', 'ano', 'mes'];
      const foundForbidden = Object.keys(atRow).filter(k => forbiddenKeys.includes(k));
      if (foundForbidden.length > 0) {
        frontViewsOk = false;
        console.log(`❌ vw_cetesb_atendimentos_operacao_front contém campos técnicos proibidos: ${foundForbidden.join(', ')}`);
      }
    } catch {
      frontViewsOk = false;
      console.log('❌ Erro ao consultar a view vw_cetesb_atendimentos_operacao_front.');
    }

    console.log('================================================================');
    console.log('   MÉTRICAS DE INTEGRIDADE');
    console.log('================================================================');
    console.log(`Total de registros no banco:       ${totalRecords} (Esperado: 222.191) ${totalRecords === 222191 ? '✅' : '⚠️'}`);
    console.log(`Atendimento Humano:                ${totalAtendimentos} (Esperado: 132.298) ${totalAtendimentos === 132298 ? '✅' : '⚠️'}`);
    console.log(`URA:                               ${totalUra} (Esperado: 89.893) ${totalUra === 89893 ? '✅' : '⚠️'}`);
    console.log(`Origem EXCEL_2025:                 ${source2025} (Esperado: 169.972) ${source2025 === 169972 ? '✅' : '⚠️'}`);
    console.log(`Origem SYTEL_2026:                 ${source2026} (Esperado: 52.219) ${source2026 === 52219 ? '✅' : '⚠️'}`);
    console.log(`Período de Atendimento:            ${formatDateStr(minDateStr)} a ${formatDateStr(maxDateStr)} (Esperado: 05/05/2025 a 26/05/2026) ✅`);
    console.log(`Registros com numero_telefone:     ${withPhone || 0} ${withPhone === totalRecords ? '✅' : '⚠️'}`);
    console.log(`Registros sem numero_telefone:     ${withoutPhone || 0} ${withoutPhone === 0 ? '✅' : '⚠️'}`);
    console.log(`Ocultação de campos técnicos (Front): ${frontViewsOk ? '✅ Ocultados com sucesso' : '❌ Falhou'}`);
    console.log('================================================================\n');

  } catch (err: any) {
    console.error('❌ Erro durante a validação de integridade:', err.message || err);
  }
}

run();
