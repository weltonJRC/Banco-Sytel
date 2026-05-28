import { test, expect } from '@playwright/test';

test.describe('E2E Portal Navigation & Authorization', () => {
  
  test('should redirect unauthenticated users accessing /dashboard to /login', async ({ page }) => {
    // Acessa uma rota protegida
    await page.goto('/dashboard');
    
    // Espera ser redirecionado para a página de login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should show quick mock profiles panel in development mode', async ({ page }) => {
    await page.goto('/login');
    
    // Se o modo mock estiver ativo, o painel deve ser renderizado
    const isMock = await page.$$eval('span', elements => 
      elements.some(el => el.textContent?.includes('Seletor de Perfis Rápidos (Mock)'))
    );

    if (isMock) {
      const quickProfileButton = page.locator('button', { hasText: 'admin@jrc.local' });
      await expect(quickProfileButton).toBeVisible();
    }
  });

  test('should authenticate successfully with mock administrator credentials', async ({ page }) => {
    await page.goto('/login');

    const isMock = await page.$$eval('span', elements => 
      elements.some(el => el.textContent?.includes('Seletor de Perfis Rápidos (Mock)'))
    );

    if (isMock) {
      // Preenche os dados
      await page.locator('button', { hasText: 'admin@jrc.local' }).click();
      await page.locator('button', { hasText: 'Acessar o Portal' }).click();
      
      // Espera ser redirecionado para o dashboard
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Verifica se o menu de usuários administradores está disponível
      const userMenu = page.locator('a', { hasText: 'Usuários' });
      await expect(userMenu).toBeVisible();
    }
  });

  test('should block simple consulta users from viewing users admin panel', async ({ page }) => {
    await page.goto('/login');

    const isMock = await page.$$eval('span', elements => 
      elements.some(el => el.textContent?.includes('Seletor de Perfis Rápidos (Mock)'))
    );

    if (isMock) {
      await page.locator('button', { hasText: 'consulta@cetesb.local' }).click();
      await page.locator('button', { hasText: 'Acessar o Portal' }).click();
      
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // A rota de Usuários NÃO deve estar disponível na barra lateral
      const userMenu = page.locator('a', { hasText: 'Usuários' });
      await expect(userMenu).not.toBeVisible();
    }
  });
});
