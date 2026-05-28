# Plano de Testes e Estratégia de Validação — Portal CETESB

Este documento descreve a esteira de testes automatizados e o plano de testes manuais elaborado para certificar a qualidade, performance, segurança e fidelidade das consultas no **Portal CETESB - Retenção Histórica**.

---

## ⚡ 1. Testes Automatizados (Vitest)

Utilizamos o framework de alto desempenho **Vitest** para testar as regras de negócio, segurança server-side e validações.

### A. Suítes de Testes Disponíveis

1. **Formatadores (`formatters.test.ts`)**:
   - Valida a higienização de strings de telefone.
   - Testa o algoritmo de mascaramento visual de telefones (ex: `119****2885`).
   - Testa o parser robusto de durações em formato HH:MM:SS para segundos.
   - Testa a conversão resiliente de strings de data nos padrões brasileiros e americanos.

2. **Filtros (`filters.test.ts`)**:
   - Valida se os filtros recebidos do cliente e os filtros aplicados à API do Supabase/Mock são consistentes.
   - Testa a busca case-insensitive e parcial.

3. **Mapeamento de Importação (`import-mapping.test.ts`)**:
   - Valida se o cabeçalho das planilhas importadas de 2025 e 2026 são mapeados corretamente para os registros do banco de dados (Atendimento Humano e URA).
   - Testa a resiliência a espaços adicionais e acentos nas planilhas de origem.

4. **Segurança (`security.test.ts`)**:
   - Testa a validação HMAC da assinatura do cookie de sessão.
   - Garante que cookies forjados, com assinaturas alteradas ou com comprimentos de assinaturas inválidos sejam sumariamente rejeitados para evitar ataques de temporização e bypass.

### B. Comando de Execução
```bash
npm run test
```
*Garantia*: Todos os **35 testes automatizados** devem passar antes de qualquer commit ou deploy.

---

## 🛠️ 2. Roteiro de Testes Manuais

### A. Autenticação e Cookies de Sessão
1. Tentar logar com usuário não-cadastrado no banco.
   *Resultado esperado*: Mensagem de erro "Credenciais inválidas".
2. Digitar o usuário `"Cetesb"` e senha `"Cetesb123"`.
   *Resultado esperado*: Login bem-sucedido, redirecionamento automático para o dashboard e inicialização correta da sessão visual.
3. Inspecionar os cookies no painel de ferramentas do desenvolvedor (Chrome DevTools).
   *Resultado esperado*: O cookie `cetesb_session` deve possuir as flags `Secure` e `HTTPOnly` ativas.

### B. Visualização e Exportação de Telefones (Perfil CETESB)
1. Navegar até a página **Relatório Detalhado - ATENDIMENTOS OPERAÇÃO**.
   *Resultado esperado*: A coluna "Número de telefone" deve exibir o número completo (ex: `12996736653`). Nenhum campo técnico (como ID ou raw_payload) deve estar visível na tabela.
2. Clicar no botão **Exportar Excel (.xlsx)** e **Exportar CSV**.
   *Resultado esperado*: As planilhas geradas devem conter exatamente as 9 colunas do frontend na mesma ordem, exibindo o número de telefone completo.

### C. Visualização de URA CETESB
1. Navegar até a página **Relatório Detalhado - URA CETESB**.
   *Resultado esperado*: A tabela deve possuir exatamente 8 colunas. A coluna "Usuário" **não** deve aparecer. A coluna "Resultado" deve mostrar as opções selecionadas de navegação de forma legível.
2. Inspecionar exportações.
   *Resultado esperado*: Arquivo exportado respeita a listagem exata de 8 colunas com o número de telefone completo.
