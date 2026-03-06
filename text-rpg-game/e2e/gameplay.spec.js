/**
 * E2E：核心玩法（仅保留必须通过浏览器验证的场景）
 *
 * 纯后端数据逻辑（强化、祝福、拍卖、消耗品扣减等）
 * 已由混沌猴集成测试 + 响应校验中间件覆盖，此处不再重复。
 */
const { test, expect } = require('@playwright/test');
const { registerLoginCreateChar, buyFromShop, doMonsterBattle } = require('./helpers');

test.describe('核心玩法 E2E', () => {
  test('完整流程：注册→战斗→商店→背包', async ({ page }) => {
    test.setTimeout(120000);
    await registerLoginCreateChar(page);
    await doMonsterBattle(page);
    await buyFromShop(page, '小血瓶');
    await page.getByRole('button', { name: '角色' }).click();
    await expect(page.locator('#backpack, .bag-container')).toBeVisible({ timeout: 5000 });
    await page.locator('#backpack').getByText('消耗品').click();
    await expect(page.locator('.bag-item-name').filter({ hasText: '小血瓶' })).toBeVisible({ timeout: 5000 });
  });

  test('Boss 战斗', async ({ page }) => {
    test.setTimeout(90000);
    await registerLoginCreateChar(page);
    await page.getByRole('button', { name: '地图' }).click();
    await expect(page.locator('.map-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Boss' }).first().click();
    await expect(page.locator('.boss-list-container')).toBeVisible({ timeout: 5000 });
    await page.locator('.boss-battle-btn').first().click();
    await expect(page.locator('.battle-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '开始战斗' }).click();
    await expect(
      page.locator('.battle-log-content').filter({ hasText: /战斗胜利|战斗奖励|战斗失败|战斗平局|战斗结束/ })
    ).toBeVisible({ timeout: 60000 });
  });

  test('技能学习与装备', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page);
    await buyFromShop(page, '技能书');
    await page.getByRole('button', { name: '角色' }).click();
    await expect(page.locator('#backpack')).toBeVisible({ timeout: 5000 });
    await page.evaluate(() => BagPage.load && BagPage.load());
    await page.locator('#backpack .bag-tab').filter({ hasText: '道具' }).click();
    await expect(page.locator('.bag-item').filter({ hasText: /技能书/ })).toBeVisible({ timeout: 15000 });
    await page.locator('.bag-item').filter({ hasText: /技能书/ }).getByRole('button', { name: '使用' }).click();
    await expect(page.getByText(/使用成功|学习成功|已学会/)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '技能' }).click();
    await expect(page.locator('.skill-container')).toBeVisible({ timeout: 5000 });
    await page.locator('.skill-card').filter({ hasText: '火球术' }).getByRole('button', { name: '装备' }).first().click();
    await expect(page.locator('.skill-card').filter({ hasText: '火球术' })).toBeVisible({ timeout: 5000 });
  });

  test('装备穿戴', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page);
    await buyFromShop(page, '测试木剑');
    await page.getByRole('button', { name: '角色' }).click();
    await expect(page.locator('#backpack')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.bag-item-name').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });
    await page.locator('.bag-item').filter({ hasText: '测试木剑' }).getByRole('button', { name: '穿戴' }).click();
    await expect(page.locator('#equipSlots').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });
  });

  test('聊天', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page);
    await page.locator('#chatInput').fill('E2E测试消息');
    await page.locator('#chatInput').press('Enter');
    await expect(page.locator('.chat-msg').filter({ hasText: 'E2E测试消息' })).toBeVisible({ timeout: 5000 });
  });
});
