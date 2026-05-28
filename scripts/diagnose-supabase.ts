import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hasSupabase = !!(supabaseUrl && supabaseServiceKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function diagnose() {
  console.log('================================================================');
  console.log('            DIAGNÓSTICO REAL DO SCHEMA SUPABASE                 ');
  console.log('================================================================\n');

  if (!hasSupabase) {
    console.log('❌ FALHA: Supabase não está configurado no .env.');
    process.exit(1);
  }

  console.log(`URL: ${supabaseUrl}`);
  console.log(`Chave Service Role: Configurada (${supabaseServiceKey.substring(0, 10)}...)\n`);

  let errorsCount = 0;

  // 1. Validar Tabela public.cetesb_eventos
  console.log('--- 1. Validando public.cetesb_eventos ---');
  try {
    const { count, error } = await supabase!
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ FALHA ao consultar cetesb_eventos: ${error.message}`);
      errorsCount++;
    } else {
      console.log(`✅ OK: public.cetesb_eventos existe. Total registros: ${count}`);
    }
  } catch (err: any) {
    console.log(`❌ FALHA inesperada na tabela: ${err.message || err}`);
    errorsCount++;
  }

  // 2. Validar view vw_cetesb_atendimentos_operacao_front
  console.log('\n--- 2. Validando vw_cetesb_atendimentos_operacao_front ---');
  try {
    const { data, error, count } = await supabase!
      .from('vw_cetesb_atendimentos_operacao_front')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log(`❌ FALHA ao consultar vw_cetesb_atendimentos_operacao_front: ${error.message}`);
      errorsCount++;
    } else {
      console.log(`✅ OK: View existe. Colunas encontradas: ${Object.keys(data?.[0] || {}).join(', ')}`);
      console.log(`   Total registros na view: ${count}`);
    }
  } catch (err: any) {
    console.log(`❌ FALHA inesperada na view atendimentos: ${err.message || err}`);
    errorsCount++;
  }

  // 3. Validar view vw_cetesb_ura_front
  console.log('\n--- 3. Validando vw_cetesb_ura_front ---');
  try {
    const { data, error, count } = await supabase!
      .from('vw_cetesb_ura_front')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log(`❌ FALHA ao consultar vw_cetesb_ura_front: ${error.message}`);
      errorsCount++;
    } else {
      console.log(`✅ OK: View existe. Colunas encontradas: ${Object.keys(data?.[0] || {}).join(', ')}`);
      console.log(`   Total registros na view: ${count}`);
    }
  } catch (err: any) {
    console.log(`❌ FALHA inesperada na view URA: ${err.message || err}`);
    errorsCount++;
  }

  // 4. Validar RPC get_dashboard_totals()
  console.log('\n--- 4. Validando RPC get_dashboard_totals ---');
  try {
    const { data, error } = await supabase!.rpc('get_dashboard_totals');
    if (error) {
      console.log(`❌ FALHA na RPC get_dashboard_totals: ${error.message}`);
      errorsCount++;
    } else {
      console.log(`✅ OK: RPC respondeu:`, data);
    }
  } catch (err: any) {
    console.log(`❌ FALHA inesperada na RPC get_dashboard_totals: ${err.message || err}`);
    errorsCount++;
  }

  // 5. Validar RPC get_dashboard_source_summary()
  console.log('\n--- 5. Validando RPC get_dashboard_source_summary ---');
  try {
    const { data, error } = await supabase!.rpc('get_dashboard_source_summary');
    if (error) {
      console.log(`❌ FALHA na RPC get_dashboard_source_summary: ${error.message}`);
      errorsCount++;
    } else {
      console.log(`✅ OK: RPC respondeu:`, data);
    }
  } catch (err: any) {
    console.log(`❌ FALHA inesperada na RPC get_dashboard_source_summary: ${err.message || err}`);
    errorsCount++;
  }

  // 6. Validar RPC get_dashboard_monthly_summary()
  console.log('\n--- 6. Validando RPC get_dashboard_monthly_summary ---');
  try {
    const { data, error } = await supabase!.rpc('get_dashboard_monthly_summary');
    if (error) {
      console.log(`❌ FALHA na RPC get_dashboard_monthly_summary: ${error.message}`);
      errorsCount++;
    } else {
      console.log(`✅ OK: RPC respondeu:`, data);
    }
  } catch (err: any) {
    console.log(`❌ FALHA inesperada na RPC get_dashboard_monthly_summary: ${err.message || err}`);
    errorsCount++;
  }

  // 7. Validar RPC get_filter_options()
  console.log('\n--- 7. Validando RPC get_filter_options ---');
  try {
    const { data: atData, error: atError } = await supabase!.rpc('get_filter_options', { report_type: 'ATENDIMENTO_OPERACAO' });
    if (atError) {
      console.log(`❌ FALHA na RPC get_filter_options(ATENDIMENTO_OPERACAO): ${atError.message}`);
      errorsCount++;
    } else {
      console.log(`✅ OK: get_filter_options(ATENDIMENTO_OPERACAO) respondeu. Campanhas count: ${atData?.campanhas?.length || 0}`);
    }

    const { data: uraData, error: uraError } = await supabase!.rpc('get_filter_options', { report_type: 'URA' });
    if (uraError) {
      console.log(`❌ FALHA na RPC get_filter_options(URA): ${uraError.message}`);
      errorsCount++;
    } else {
      console.log(`✅ OK: get_filter_options(URA) respondeu. Campanhas count: ${uraData?.campanhas?.length || 0}`);
    }
  } catch (err: any) {
    console.log(`❌ FALHA inesperada na RPC get_filter_options: ${err.message || err}`);
    errorsCount++;
  }

  console.log('\n================================================================');
  if (errorsCount > 0) {
    console.log(`❌ DIAGNÓSTICO CONCLUÍDO COM ${errorsCount} FALHA(S).`);
    process.exit(1);
  } else {
    console.log('✅ DIAGNÓSTICO CONCLUÍDO COM SUCESSO. SCHEMA 100% ALINHADO!');
    process.exit(0);
  }
}

diagnose();
