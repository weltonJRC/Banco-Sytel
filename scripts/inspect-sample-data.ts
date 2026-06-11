import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('--- Buscando amostra de Atendimentos Operação em Maio 2026 ---');
  
  const { data, error } = await supabase
    .from('cetesb_eventos')
    .select('*')
    .eq('tipo_relatorio', 'ATENDIMENTO_OPERACAO')
    .gte('sessao_iniciada', '2026-05-20T00:00:00.000Z')
    .lte('sessao_iniciada', '2026-05-27T23:59:59.000Z')
    .limit(10);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Encontrados ${data.length} registros.`);
  
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    console.log(`\n[Registro ${i+1}]`);
    console.log(`  ID: ${r.id}`);
    console.log(`  Campanha: ${r.campanha}`);
    console.log(`  Fila: ${r.fila}`);
    console.log(`  Usuário: ${r.usuario}`);
    console.log(`  Data/Hora: ${r.sessao_iniciada}`);
    console.log(`  Duração Fila: ${r.duracao_fila_segundos}s`);
    console.log(`  Duração Fala: ${r.duracao_fala_segundos}s`);
    console.log(`  Resultado Nome: ${r.resultado_name || r.resultado_nome}`);
    console.log(`  Resultado Usuário: ${r.resultado_usuario}`);
    console.log(`  Descrição Resultado: ${r.descricao_resultado}`);
  }
}

run();
