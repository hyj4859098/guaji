/**
 * E2E：补充场景（仅保留必须通过浏览器验证的场景）
 *
 * 纯后端逻辑（注册重复、拍卖搜索、强化道具、多倍开关等）
 * 已由混沌猴集成测试 + 响应校验中间件覆盖，此处不再重复。
 */
const { test, expect } = require('@playwright/test');
const { registerLoginCreateChar } = require('./helpers');

test.describe('自动挂机战斗', () => {
  test('自动战斗开始与停止', async ({ page }) => {
    test.setTimeout(90000);
    await registerLoginCreateChar(page, 'E2E自动战斗');

    await page.getByRole('button', { name: '地图' }).click();
    await expect(page.locator('.map-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '怪物' }).first().click();
    await expect(page.locator('.enemy-list-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '战斗' }).first().click();
    await expect(page.locator('.battle-container')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '自动战斗' }).click();

    await expect(
      page.locator('.battle-log-content').filter({ hasText: /战斗开始|战斗胜利|战斗奖励|战斗失败/ })
    ).toBeVisible({ timeout: 45000 });

    await page.getByRole('button', { name: '停止战斗' }).click();
    await expect(page.getByText(/战斗已停止/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('登录注册失败路径', () => {
  test('登录不存在的用户名', async ({ page }) => {
    test.setTimeout(15000);
    await page.goto('/');
    await page.getByText('登录').first().click();
    await page.getByPlaceholder('用户名').fill(`no_such_user_${Date.now()}`);
    await page.getByPlaceholder('密码').fill('Test123456');
    await page.locator('#authSubmitBtn').click();
    await expect(page.getByText(/用户不存在/)).toBeVisible({ timeout: 5000 });
  });

  test('登录密码错误', async ({ page }) => {
    test.setTimeout(20000);
    const username = `e2e_wrongpw_${Date.now()}`;
    const password = 'Test123456';

    await page.goto('/');
    await page.getByText('注册').first().click();
    await page.getByPlaceholder('用户名').fill(username);
    await page.getByPlaceholder('密码').fill(password);
    await page.locator('#authSubmitBtn').click();
    await expect(page.getByText(/注册成功/)).toBeVisible({ timeout: 5000 });

    await page.getByText('登录').first().click();
    await page.getByPlaceholder('用户名').fill(username);
    await page.getByPlaceholder('密码').fill('WrongPassword999');
    await page.locator('#authSubmitBtn').click();
    await expect(page.getByText(/密码错误/)).toBeVisible({ timeout: 5000 });
  });
});
