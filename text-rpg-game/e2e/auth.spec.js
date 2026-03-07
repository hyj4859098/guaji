/**
 * E2E：登录、注册、创建角色、被踢下线
 * 前置：服务已启动（CI 中由 test job 启动）
 */
const { test, expect } = require('@playwright/test');

test.describe('认证流程', () => {
  test('打开首页显示登录/注册', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.auth-title')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('登录').first()).toBeVisible();
    await expect(page.getByText('注册').first()).toBeVisible();
  });

  test('注册新用户', async ({ page }) => {
    const username = `e2e_${Date.now()}`;
    const password = 'Test123456';

    await page.goto('/');
    await page.getByText('注册').first().click();
    await page.getByPlaceholder('用户名').fill(username);
    await page.getByPlaceholder('密码').fill(password);
    await page.locator('#authSubmitBtn').click();

    await expect(page.getByText(/注册成功/)).toBeVisible({ timeout: 5000 });
  });

  test('登录并创建角色', async ({ page }) => {
    const username = `e2e_login_${Date.now()}`;
    const password = 'Test123456';

    await page.goto('/');
    await page.getByText('注册').first().click();
    await page.getByPlaceholder('用户名').fill(username);
    await page.getByPlaceholder('密码').fill(password);
    await page.locator('#authSubmitBtn').click();
    await expect(page.getByText(/注册成功/)).toBeVisible({ timeout: 5000 });

    await page.getByText('登录').first().click();
    await page.getByPlaceholder('用户名').fill(username);
    await page.getByPlaceholder('密码').fill(password);
    await page.locator('#authSubmitBtn').click();

    await expect(page.getByRole('heading', { name: '创建角色' })).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('请输入角色名称').fill('E2E测试角色');
    await page.getByRole('button', { name: '创建角色' }).click();

    await expect(page.getByText('角色创建成功')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.top-nav')).toBeVisible({ timeout: 3000 });
  });

  test('被踢下线（异地登录）', async ({ browser }) => {
    test.setTimeout(60000);
    const username = `e2e_kick_${Date.now()}`;
    const password = 'Test123456';

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/');
    await page1.getByText('注册').first().click();
    await page1.getByPlaceholder('用户名').fill(username);
    await page1.getByPlaceholder('密码').fill(password);
    await page1.locator('#authSubmitBtn').click();
    await expect(page1.getByText(/注册成功/)).toBeVisible({ timeout: 5000 });

    await page1.getByText('登录').first().click();
    await page1.getByPlaceholder('用户名').fill(username);
    await page1.getByPlaceholder('密码').fill(password);
    await page1.locator('#authSubmitBtn').click();
    await expect(page1.getByRole('heading', { name: '创建角色' })).toBeVisible({ timeout: 5000 });
    await page1.getByPlaceholder('请输入角色名称').fill('E2E踢下线测试');
    await page1.getByRole('button', { name: '创建角色' }).click();
    await expect(page1.locator('.top-nav')).toBeVisible({ timeout: 5000 });

    page1.once('dialog', (d) => {
      expect(d.message()).toMatch(/其他地方登录|踢出/);
      d.accept();
    });

    await page2.goto('/');
    await page2.getByText('登录').first().click();
    await page2.getByPlaceholder('用户名').fill(username);
    await page2.getByPlaceholder('密码').fill(password);
    await page2.locator('#authSubmitBtn').click();
    await expect(page2.locator('.top-nav')).toBeVisible({ timeout: 5000 });

    await expect(page1.locator('.auth-title')).toBeVisible({ timeout: 10000 });
    await ctx1.close();
    await ctx2.close();
  });
});
