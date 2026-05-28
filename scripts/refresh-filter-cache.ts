import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hasSupabase = !!(supabaseUrl && supabaseServiceKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function run() {
  console.log('================================================================');
  console.log('       REFRESH DO CACHE DE FILTROS DO PORTAL CETESB            ');
  console.log('================================================================\n');

  if (!hasSupabase) {
    console.error('❌ Erro: Supabase não está configurado.');
    process.exit(1);
  }

  console.log('Conectando ao Supabase para atualizar o cache de filtros...');
  try {
    const startTime = Date.now();
    const { error } = await supabase!.rpc('refresh_filter_options_cache');
    
    if (error) {
      throw error;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ SUCESSO: Cache de filtros atualizado e reconstruído.`);
    console.log(`   Tempo decorrido: ${duration}s\n`);
    
    // Mostrando os registros do cache para validação
    const { data: cacheRecords } = await supabase!
      .from('cetesb_filter_options_cache')
      .select('report_type, updated_at');
    
    console.log('Status atual do Cache na base:');
    (cacheRecords || []).forEach(r => {
      console.log(`   - Tipo: ${r.report_type.padEnd(22)} | Atualizado em: ${new Date(r.updated_at).toLocaleString('pt-BR')}`);
    });
    console.log('\n================================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Erro durante a atualização do cache:', err.message || err);
    process.exit(1);
  }
}

run();
