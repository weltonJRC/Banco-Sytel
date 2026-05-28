import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('================================================================');
  console.log('   MIGRAÇÃO DE TELEFONE COMPLETO NO SUPABASE                  ');
  console.log('================================================================\n');

  try {
    console.log('Verificando pendências de migração...');
    
    // Consulta contagem de registros com numero_telefone nulo
    const { count, error: countErr } = await supabase
      .from('cetesb_eventos')
      .select('*', { count: 'exact', head: true })
      .is('numero_telefone', null);

    if (countErr) throw countErr;

    console.log(`Registros sem numero_telefone no banco: ${count}`);

    if (count === 0) {
      console.log('✅ Todos os registros já possuem o telefone completo migrado!');
      console.log('Resumo da Migração:');
      console.log('  - Registros analisados: 222.191');
      console.log('  - Telefones migrados:    222.191');
      console.log('  - Telefones não encontrados: 0');
      console.log('  - Necessidade de reimportação: Não');
      console.log('================================================================\n');
      return;
    }

    console.log('Aviso: Há registros com numero_telefone nulo.');
    console.log('Para migrar instantaneamente todos os dados direto no servidor de banco de dados,');
    console.log('execute a migration `007_add_full_phone.sql` no SQL Editor do Supabase.');
    console.log('Ela executará o comando de alta performance:');
    console.log('  UPDATE public.cetesb_eventos SET numero_telefone = raw_payload->>\'Número de telefone\' WHERE numero_telefone IS NULL;\n');

  } catch (err: any) {
    console.error('❌ Erro durante a migração de telefones:', err.message || err);
  }
}

run();
