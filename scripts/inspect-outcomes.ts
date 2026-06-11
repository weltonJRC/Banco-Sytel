import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Iniciando contagem de resultados na base real em lotes de 1000...');
  
  const results: { [key: string]: { [val: string]: number } } = {
    tipo_relatorio: {},
    resultado_nome: {},
    descricao_resultado: {},
    resultado_usuario: {}
  };
  
  let page = 0;
  const batchSize = 1000;
  let hasMore = true;
  let totalProcessed = 0;

  while (hasMore) {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    
    const { data, error } = await supabase
      .from('cetesb_eventos')
      .select('tipo_relatorio, resultado_nome, descricao_resultado, resultado_usuario')
      .order('id', { ascending: true }) // order to ensure stable pagination
      .range(from, to);
      
    if (error) {
      console.error('Erro na página', page, error);
      break;
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }
    
    totalProcessed += data.length;
    
    for (const r of data) {
      const tr = r.tipo_relatorio || 'NULL';
      results.tipo_relatorio[tr] = (results.tipo_relatorio[tr] || 0) + 1;
      
      const rn = r.resultado_nome || 'NULL';
      results.resultado_nome[rn] = (results.resultado_nome[rn] || 0) + 1;
      
      const dr = r.descricao_resultado || 'NULL';
      results.descricao_resultado[dr] = (results.descricao_resultado[dr] || 0) + 1;
      
      const ru = r.resultado_usuario || 'NULL';
      results.resultado_usuario[ru] = (results.resultado_usuario[ru] || 0) + 1;
    }
    
    // Log progress occasionally
    if (page % 20 === 0) {
      console.log(`Páginas processadas: ${page}, Total registros: ${totalProcessed}...`);
    }

    page++;
    
    if (data.length < batchSize) {
      hasMore = false;
    }
  }

  console.log(`\nProcessados ${totalProcessed} registros.`);

  console.log('\n--- TIPO RELATORIO ---');
  Object.entries(results.tipo_relatorio).sort((a,b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n--- RESULTADO NOME (Top 20) ---');
  Object.entries(results.resultado_nome).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n--- RESULTADO USUARIO (Top 20) ---');
  Object.entries(results.resultado_usuario).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n--- DESCRICAO RESULTADO (Top 20) ---');
  Object.entries(results.descricao_resultado).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
}

run();
