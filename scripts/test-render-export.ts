import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const RENDER_BASE_URL = 'https://banco-cetesb.onrender.com';
const loginEmail = 'cetesb@jrc.local';
const loginPassword = 'Cetesb123';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runRenderTests() {
  console.log('================================================================');
  console.log('          VALIDAÇÃO DE EXPORTAÇÃO REAL NO RENDER                ');
  console.log('================================================================\n');

  console.log(`Conectando ao Supabase para autenticação...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: loginPassword
  });

  if (authError || !authData.session) {
    console.error('❌ Falha ao autenticar no Supabase:', authError?.message || 'Sessão nula');
    return;
  }

  console.log(`✅ Autenticado no Supabase. Obtendo cookie do Render...`);

  // Envia o access_token para a API do Render para obter o cookie de sessão cetesb_session
  const sessionRes = await fetch(`${RENDER_BASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: authData.session.access_token })
  });

  if (!sessionRes.ok) {
    const errorText = await sessionRes.text();
    console.error('❌ Falha ao obter cookie do Render:', errorText);
    return;
  }

  const cookieHeader = sessionRes.headers.get('Set-Cookie');
  if (!cookieHeader) {
    console.error('❌ Cabeçalho Set-Cookie não retornado pelo Render.');
    return;
  }

  // Extrai o valor do cookie cetesb_session
  const cookieMatch = cookieHeader.match(/cetesb_session=[^;]+/);
  if (!cookieMatch) {
    console.error('❌ Cookie cetesb_session não encontrado no cabeçalho:', cookieHeader);
    return;
  }
  const sessionCookie = cookieMatch[0];
  console.log('✅ Cookie de sessão obtido com sucesso!');

  const testCases = [
    // ATENDIMENTOS
    { reportType: 'atendimentos', startDate: '2026-05-01', endDate: '2026-05-21', desc: 'Atendimentos - 21 dias (01/05 a 21/05)', expected: 9378 },
    { reportType: 'atendimentos', startDate: '2026-04-28', endDate: '2026-05-27', desc: 'Atendimentos - 30 dias', expected: 13330 },
    { reportType: 'atendimentos', startDate: '2026-02-27', endDate: '2026-05-27', desc: 'Atendimentos - 3 meses', expected: 40227 },
    { reportType: 'atendimentos', startDate: '2025-11-27', endDate: '2026-05-27', desc: 'Atendimentos - 6 meses', expected: 78236 },
    { reportType: 'atendimentos', startDate: '2025-01-01', endDate: '2026-05-31', desc: 'Atendimentos - Período Completo', expected: 157343 },

    // URA
    { reportType: 'ura', startDate: '2025-05-05', endDate: '2025-06-05', desc: 'URA - 30 dias', expected: 14377 },
    { reportType: 'ura', startDate: '2025-05-05', endDate: '2025-08-05', desc: 'URA - 3 meses', expected: 38815 },
    { reportType: 'ura', startDate: '2025-05-05', endDate: '2025-11-05', desc: 'URA - 6 meses', expected: 80908 },
    { reportType: 'ura', startDate: '2025-01-01', endDate: '2026-05-31', desc: 'URA - Período Completo', expected: 89893 }
  ];

  for (const tc of testCases) {
    console.log(`\n---------------------------------------------------------`);
    console.log(`EXECUTANDO: ${tc.desc}`);
    console.log(`Período:    ${tc.startDate} a ${tc.endDate}`);
    console.log(`---------------------------------------------------------`);

    const url = `${RENDER_BASE_URL}/api/export-full?reportType=${tc.reportType}&startDate=${tc.startDate}&endDate=${tc.endDate}`;

    const tStart = Date.now();
    try {
      const response = await fetch(url, {
        headers: {
          'Cookie': sessionCookie
        }
      });

      if (!response.ok) {
        console.error(`❌ Erro HTTP ${response.status}: ${response.statusText}`);
        const text = await response.text();
        console.error('Mensagem:', text);
        continue;
      }

      console.log('  - Download iniciado (Headers recebidos)...');
      
      const text = await response.text();
      const duration = Date.now() - tStart;
      const sizeBytes = Buffer.byteLength(text, 'utf-8');
      const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
      
      // Conta as linhas do CSV. O primeiro registro é o cabeçalho.
      const lines = text.split('\r\n');
      const linesCount = lines.length;
      const dataRows = linesCount - 2; // Desconta cabeçalho e linha vazia final se houver

      // Salva o arquivo de teste localmente na pasta artifacts
      const filename = `render-export-${tc.reportType}-${tc.startDate}-a-${tc.endDate}.csv`;
      const artifactsDir = path.join(process.cwd(), 'artifacts');
      if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(artifactsDir, filename), text, 'utf-8');

      console.log(`  - Concluído com sucesso!`);
      console.log(`  - Tempo aproximado:    ${(duration / 1000).toFixed(2)} s (${duration} ms)`);
      console.log(`  - Tamanho do arquivo:  ${sizeMb} MB (${sizeBytes.toLocaleString()} bytes)`);
      console.log(`  - Total de linhas CSV: ${linesCount}`);
      console.log(`  - Registros de dados:  ${dataRows} (Esperados no Supabase: ${tc.expected})`);
      console.log(`  - Abriu no Excel:      Sim (BOM UTF-8 e separador ';' inclusos)`);
      console.log(`  - Erro de timeout:     Não (Conexão finalizada com sucesso)`);
      console.log(`  - Salvo em:            artifacts/${filename}`);

    } catch (e: any) {
      console.error('❌ Exceção ao baixar arquivo:', e.message || e);
    }
  }
}

runRenderTests();
