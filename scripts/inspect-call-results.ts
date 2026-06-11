import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('--- Analisando resultados de chamadas em cetesb_eventos ---\n');

  // 1. Amostra de descricao_resultado
  console.log('Top 15 descricao_resultado:');
  const { data: descRes, error: errDesc } = await supabase
    .rpc('get_top_descricao_resultado'); // Wait, if this RPC doesn't exist, we can use a query with Group By but postgrest doesn't support GROUP BY directly in select.
  
  // Since postgrest doesn't support group by, we can query a sample of rows or use a custom query, or run a query on cetesb_eventos.
  // Actually, we can run a query to select unique values using a raw SQL in a temporary RPC or query it chunk by chunk,
  // or simply query the views since we only have a few categories of results.
  // Wait, let's write a script that queries a large sample (e.g. 5000 rows) and does grouping in memory! That is extremely safe and doesn't require creating new functions in DB.
  
  const { data: sampleRows, error: errSample } = await supabase
    .from('cetesb_eventos')
    .select('tipo_relatorio, resultado_nome, descricao_resultado, resultado_usuario, duracao_fala_segundos, duracao_fila_segundos, usuario')
    .limit(10000);
    
  if (errSample) {
    console.error('Erro ao buscar amostra:', errSample);
    return;
  }
  
  console.log(`Buscada amostra de ${sampleRows.length} linhas.`);
  
  const descCounts: Record<string, number> = {};
  const userResCounts: Record<string, number> = {};
  const nameResCounts: Record<string, number> = {};
  
  for (const r of sampleRows) {
    const desc = r.descricao_resultado || 'null';
    descCounts[desc] = (descCounts[desc] || 0) + 1;
    
    const userRes = r.resultado_usuario || 'null';
    userResCounts[userRes] = (userResCounts[userRes] || 0) + 1;
    
    const nameRes = r.resultado_nome || 'null';
    nameResCounts[nameRes] = (nameResCounts[nameRes] || 0) + 1;
  }
  
  console.log('\nTop descricao_resultado na amostra:');
  Object.entries(descCounts).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => {
    console.log(` - ${k}: ${v}`);
  });
  
  console.log('\nTop resultado_usuario na amostra:');
  Object.entries(userResCounts).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => {
    console.log(` - ${k}: ${v}`);
  });

  console.log('\nTop resultado_nome na amostra:');
  Object.entries(nameResCounts).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => {
    console.log(` - ${k}: ${v}`);
  });
}

run();
