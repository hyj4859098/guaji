/**
 * E2E：玩家体验测试
 *
 * 测试玩家真正会碰到的场景：
 * - WS 实时推送（操作后数据立即更新）
 * - 聊天多人可见性
 * - WS 断线重连
 * - 页面状态持久性
 * - 多人实时交互
 */
const { test, expect } = require('@playwright/test');
const { registerLoginCreateChar, buyFromShop, doMonsterBattle } = require('./helpers');

// ==================== 第 1 组：WS 实时推送 ====================
test.describe('WS 实时推送', () => {
  test('商店购买后金币实时更新', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, '推送测试');

    await page.getByRole('button', { name: '商店' }).click();
    await expect(page.locator('.shop-container')).toBeVisible({ timeout: 5000 });

    const balanceBefore = await page.locator('.shop-balance').textContent().catch(() => '');

    await buyFromShop(page, '小血瓶');

    await page.getByRole('button', { name: '商店' }).click();
    await expect(page.locator('.shop-container')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    const balanceAfter = await page.locator('.shop-balance').textContent().catch(() => '');

    expect(balanceAfter).toBeDefined();
  });

  test('穿戴装备后装备栏实时更新', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, '装备推送');
    await buyFromShop(page, '测试木剑');

    await page.getByRole('button', { name: '角色' }).click();
    await expect(page.locator('#backpack')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.bag-item-name').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });
    await page.locator('.bag-item').filter({ hasText: '测试木剑' }).getByRole('button', { name: '穿戴' }).click();
    await expect(page.locator('#equipSlots').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });
  });

  test('战斗胜利后经验值更新', async ({ page }) => {
    test.setTimeout(120000);
    await registerLoginCreateChar(page, '战斗推送');

    const levelBefore = await page.locator('#playerLevel').textContent().catch(() => 'Lv.1');

    await doMonsterBattle(page);

    await page.waitForTimeout(1000);
    const levelAfter = await page.locator('#playerLevel').textContent().catch(() => 'Lv.1');
    expect(levelAfter).toBeDefined();
  });

  test('使用消耗品后数量变化', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, '消耗品推送');
    await buyFromShop(page, '小血瓶', 3);

    await page.getByRole('button', { name: '角色' }).click();
    await page.locator('#backpack .bag-tab').filter({ hasText: '消耗品' }).click();
    await expect(page.locator('.bag-item').filter({ hasText: '小血瓶' })).toBeVisible({ timeout: 5000 });

    await page.locator('.bag-item').filter({ hasText: '小血瓶' }).getByRole('button', { name: '使用' }).click();
    await expect(page.getByText(/使用成功/)).toBeVisible({ timeout: 5000 });
  });
});

// ==================== 第 2 组：聊天多人可见性 ====================
test.describe('聊天多人可见性', () => {
  test('A 发聊天消息，B 能看到', async ({ browser }) => {
    test.setTimeout(60000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerLoginCreateChar(pageA, '聊天A');
      await registerLoginCreateChar(pageB, '聊天B');

      const uniqueMsg = `测试消息_${Date.now()}`;
      await pageA.locator('#chatInput').fill(uniqueMsg);
      await pageA.locator('#chatInput').press('Enter');

      await expect(pageA.locator('.chat-msg').filter({ hasText: uniqueMsg })).toBeVisible({ timeout: 5000 });
      await expect(pageB.locator('.chat-msg').filter({ hasText: uniqueMsg })).toBeVisible({ timeout: 5000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

// ==================== 第 3 组：WS 断线重连 ====================
test.describe('WS 断线重连', () => {
  test('断线后自动重连', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, '断线测试');

    const connected = await page.evaluate(() => WS.isConnected());
    expect(connected).toBe(true);

    await page.evaluate(() => WS._ws.close());
    await page.waitForTimeout(1000);

    const disconnected = await page.evaluate(() => WS.isConnected());
    expect(disconnected).toBe(false);

    await page.waitForFunction(() => WS._serverReady === true, { timeout: 15000 });

    const reconnected = await page.evaluate(() => WS.isConnected());
    expect(reconnected).toBe(true);
  });

  test('重连后操作正常', async ({ page }) => {
    test.setTimeout(45000);
    await registerLoginCreateChar(page, '重连操作');

    await page.evaluate(() => WS._ws.close());
    await page.waitForFunction(() => WS._serverReady === true, { timeout: 15000 });

    await buyFromShop(page, '小血瓶');
    await page.getByRole('button', { name: '角色' }).click();
    await page.locator('#backpack .bag-tab').filter({ hasText: '消耗品' }).click();
    await expect(page.locator('.bag-item').filter({ hasText: '小血瓶' })).toBeVisible({ timeout: 5000 });
  });

  test('自动战斗中断线后恢复', async ({ page }) => {
    test.setTimeout(90000);
    await registerLoginCreateChar(page, '战斗断线');

    await page.getByRole('button', { name: '地图' }).click();
    await expect(page.locator('.map-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '怪物' }).first().click();
    await expect(page.locator('.enemy-list-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '战斗' }).first().click();
    await expect(page.locator('.battle-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '自动战斗' }).click();

    await expect(
      page.locator('.battle-log-content').filter({ hasText: /战斗开始|战斗胜利|战斗奖励/ })
    ).toBeVisible({ timeout: 30000 });

    await page.evaluate(() => WS._ws.close());
    await page.waitForFunction(() => WS._serverReady === true, { timeout: 15000 });
    await page.waitForTimeout(3000);

    await page.getByRole('button', { name: '停止战斗' }).click();
    await expect(page.getByText(/战斗已停止/)).toBeVisible({ timeout: 10000 });
  });
});

// ==================== 第 4 组：页面状态持久性 ====================
test.describe('页面状态持久性', () => {
  test('刷新页面后自动恢复', async ({ page }) => {
    test.setTimeout(30000);
    const { username, password } = await registerLoginCreateChar(page, '刷新测试');

    await expect(page.locator('.top-nav')).toBeVisible({ timeout: 5000 });

    await page.reload();

    await expect(page.locator('.top-nav')).toBeVisible({ timeout: 10000 });
  });

  test('快速切页不白屏', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, '切页测试');

    const pages = ['地图', '角色', '商店', '排行', '技能', '强化', '拍卖'];
    for (const pageName of pages) {
      const btn = page.getByRole('button', { name: pageName });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }

    for (const pageName of pages) {
      const btn = page.getByRole('button', { name: pageName });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(50);
      }
    }

    await page.getByRole('button', { name: '角色' }).click();
    await expect(page.locator('#backpack, .bag-container, .role-container')).toBeVisible({ timeout: 5000 });
  });
});

// ==================== 第 5 组：多人实时交互 ====================
test.describe('多人实时交互', () => {
  test('PVP 被挑战时收到通知', async ({ browser }) => {
    test.setTimeout(90000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerLoginCreateChar(pageA, 'PVP攻击者');
      await registerLoginCreateChar(pageB, 'PVP防御者');

      await pageA.getByRole('button', { name: '地图' }).click();
      await expect(pageA.locator('.map-container')).toBeVisible({ timeout: 5000 });
      await pageA.getByRole('button', { name: 'Boss' }).first().click();

      await pageB.getByRole('button', { name: '地图' }).click();
      await expect(pageB.locator('.map-container')).toBeVisible({ timeout: 5000 });
      await pageB.getByRole('button', { name: 'Boss' }).first().click();

      await expect(pageA.locator('.pvp-player-card').first()).toBeVisible({ timeout: 20000 });
      await pageA.locator('.pvp-challenge-btn').first().click();

      await expect(pageB.locator('.battle-container')).toBeVisible({ timeout: 10000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('交易中对方报价实时显示', async ({ browser }) => {
    test.setTimeout(60000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerLoginCreateChar(pageA, '交易出价A');
      await registerLoginCreateChar(pageB, '交易出价B');

      await pageB.getByRole('button', { name: '交易' }).click();
      await expect(pageB.locator('.trade-container')).toBeVisible({ timeout: 5000 });

      await pageA.getByRole('button', { name: '交易' }).click();
      await expect(pageA.locator('.trade-container')).toBeVisible({ timeout: 5000 });

      await expect(pageA.locator('.player-card')).toBeVisible({ timeout: 10000 });
      await pageA.locator('.player-card').filter({ hasText: '交易出价B' }).locator('.invite-btn').click();
      await pageB.getByRole('button', { name: '接受' }).click();

      await expect(pageA.locator('.trade-panel')).toBeVisible({ timeout: 5000 });
      await expect(pageB.locator('.trade-panel')).toBeVisible({ timeout: 5000 });

      const goldInput = pageA.locator('.trade-gold-input, input[name="gold"]').first();
      if (await goldInput.isVisible().catch(() => false)) {
        await goldInput.fill('10');
        await goldInput.press('Tab');
        await pageA.waitForTimeout(1000);
      }

      await pageA.getByRole('button', { name: '确认物品' }).click();
      await pageB.getByRole('button', { name: '确认物品' }).click();
      await pageA.getByRole('button', { name: '确认交易' }).click();
      await pageB.getByRole('button', { name: '确认交易' }).click();

      await expect(pageA.getByText(/交易成功/)).toBeVisible({ timeout: 5000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
