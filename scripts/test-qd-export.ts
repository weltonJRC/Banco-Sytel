import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQD(startDate: string, endDate: string) {
  const tStart = Date.now();
  
  // Data final no frontend é tratada de forma inclusiva
  const dataInicio = `${startDate}T00:00:00`;
  const dataFim = `${endDate}T23:59:59`;

  console.log(`\nConsultando Qualificação Detalhada de ${dataInicio} a ${dataFim}...`);

  const { data, error } = await supabase.rpc('get_qualificacao_detalhada_atendimento', {
    data_inicio: dataInicio,
    data_fim: dataFim,
    campanha_filter: null,
    resultado_filter: null,
    fonte_filter: null,
    status_filter: null
  });

  const duration = Date.now() - tStart;

  if (error) {
    console.error('❌ Erro na RPC get_qualificacao_detalhada_atendimento:', error.message);
    return;
  }

  const rows = data || [];
  console.log(`✅ Sucesso!`);
  console.log(`  - Linhas retornadas (grupos campanha+qualificacao): ${rows.length}`);
  console.log(`  - Tempo de resposta:                              ${duration} ms`);
  if (rows.length > 0) {
    console.log(`  - Amostra do primeiro registro:`);
    console.log(rows[0]);
    // Soma o total de chamadas representadas
    const totalCalls = rows.reduce((acc: number, r: any) => acc + Number(r.chamadas), 0);
    console.log(`  - Total de chamadas atendidas representadas:      ${totalCalls}`);
  }
}

async function run() {
  // Teste 1: 01/05/2026 a 21/05/2026
  await testQD('2026-05-01', '2026-05-21');

  // Teste 2: Período completo 01/01/2025 a 31/05/2026
  await testQD('2025-01-01', '2026-05-31');
}

run();
