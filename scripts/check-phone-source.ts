import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('================================================================');
  console.log('   VERIFICAÇÃO DE TELEFONE COMPLETO NO RAW_PAYLOAD (SUPABASE)   ');
  console.log('================================================================\n');

  try {
    console.log('Conectando ao Supabase...');
    const { data: rows, error } = await supabase
      .from('cetesb_eventos')
      .select('id, raw_payload')
      .limit(100);

    if (error) throw error;

    if (!rows || rows.length === 0) {
      console.log('❌ Nenhum registro encontrado na tabela cetesb_eventos.');
      console.log('Conclusão: Telefone completo não encontrado. Será necessário reimportar os arquivos Excel.\n');
      return;
    }

    const total = rows.length;
    let foundCount = 0;
    const foundKeys = new Set<string>();

    for (const r of rows) {
      const payload = r.raw_payload;
      if (!payload || typeof payload !== 'object') continue;

      // Chaves prováveis de telefone
      const keysToCheck = ['Número de telefone', 'Numero de telefone', 'Telefone', 'phone'];
      let foundInRow = false;

      for (const k of keysToCheck) {
        if (payload[k] !== undefined) {
          foundKeys.add(k);
          const val = payload[k]?.toString().trim();
          if (val && !val.includes('*')) {
            foundInRow = true;
          }
        } else {
          // Tenta busca case-insensitive nas chaves reais do payload
          const realKey = Object.keys(payload).find(pk => pk.trim().toLowerCase() === k.toLowerCase());
          if (realKey) {
            foundKeys.add(realKey);
            const val = payload[realKey]?.toString().trim();
            if (val && !val.includes('*')) {
              foundInRow = true;
            }
          }
        }
      }

      if (foundInRow) {
        foundCount++;
      }
    }

    console.log(`Total de registros analisados (amostra): ${total}`);
    console.log(`Total com telefone completo encontrado:   ${foundCount}`);
    console.log(`Total sem telefone completo:             ${total - foundCount}`);
    console.log('Chaves de telefone encontradas no raw_payload:', Array.from(foundKeys));

    console.log('\n----------------------------------------------------------------');
    console.log('CONCLUSÃO:');
    if (foundCount > 0) {
      console.log('✅ Telefone completo encontrado no raw_payload.');
      console.log('   É possível migrar sem reimportar os arquivos Excel!');
    } else {
      console.log('❌ Telefone completo não encontrado no raw_payload.');
      console.log('   Será necessário reimportar os arquivos Excel com a nova regra de importação.');
    }
    console.log('================================================================\n');

  } catch (err: any) {
    console.error('❌ Erro ao verificar chaves de telefone no banco:', err.message || err);
  }
}

run();
