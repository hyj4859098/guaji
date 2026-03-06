/**
 * E2E：双人玩法 - 拍卖购买、PVP、交易
 * 前置：服务已启动，MongoDB 已 init
 *
 * 测试商品 price=0，无需打怪。
 */
const { test, expect } = require('@playwright/test');
const { registerLoginCreateChar, buyFromShop } = require('./helpers');

test.describe('双人玩法 E2E', () => {
  test('拍卖购买：A 上架 → B 购买', async ({ browser }) => {
    test.setTimeout(60000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerLoginCreateChar(pageA, '卖家A');
      await buyFromShop(pageA, '强化石');
      await pageA.getByRole('button', { name: '角色' }).click();
      await pageA.locator('#backpack .bag-tab').filter({ hasText: '材料' }).click();
      await pageA.locator('.bag-item').filter({ hasText: '强化石' }).getByRole('button', { name: '上架' }).click();
      await pageA.locator('#auctionListPrice').fill('1');
      await pageA.getByRole('button', { name: '确定上架' }).click();
      await expect(pageA.getByText('上架成功')).toBeVisible({ timeout: 5000 });

      await registerLoginCreateChar(pageB, '买家B');
      await pageB.getByRole('button', { name: '拍卖' }).click();
      await expect(pageB.locator('.auction-container')).toBeVisible({ timeout: 5000 });
      await expect(pageB.locator('.auction-table').getByRole('button', { name: '购买' }).first()).toBeVisible({ timeout: 10000 });
      await pageB.locator('.auction-table').getByRole('button', { name: '购买' }).first().click();
      await pageB.getByRole('button', { name: '确定' }).click();
      await expect(pageB.getByText(/购买成功/)).toBeVisible({ timeout: 10000 });

      await pageB.getByRole('button', { name: '角色' }).click();
      await pageB.locator('#backpack .bag-tab').filter({ hasText: '材料' }).click();
      await expect(pageB.locator('.bag-item-name').filter({ hasText: '强化石' })).toBeVisible({ timeout: 15000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('PVP：A 与 B 同地图，B 挑战 A', async ({ browser }) => {
    test.setTimeout(90000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerLoginCreateChar(pageA, '被挑战者');
      await registerLoginCreateChar(pageB, '挑战者');

      await pageA.getByRole('button', { name: '地图' }).click();
      await expect(pageA.locator('.map-container')).toBeVisible({ timeout: 10000 });
      await pageA.getByRole('button', { name: 'Boss' }).first().click();
      await expect(pageA.locator('.boss-list-container')).toBeVisible({ timeout: 5000 });

      await pageB.getByRole('button', { name: '地图' }).click();
      await expect(pageB.locator('.map-container')).toBeVisible({ timeout: 10000 });
      await pageB.getByRole('button', { name: 'Boss' }).first().click();
      await expect(pageB.locator('.boss-list-container')).toBeVisible({ timeout: 5000 });

      await expect(pageB.locator('.pvp-player-card').first()).toBeVisible({ timeout: 20000 });
      await pageB.locator('.pvp-challenge-btn').first().click();
      await expect(pageB.locator('.battle-container')).toBeVisible({ timeout: 5000 });
      await pageB.getByRole('button', { name: '开始战斗' }).click();
      await expect(
        pageB.locator('.battle-log-content').filter({ hasText: /战斗胜利|战斗奖励|战斗失败|战斗平局|战斗结束/ })
      ).toBeVisible({ timeout: 60000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('交易：A 邀请 B，双方确认完成交易', async ({ browser }) => {
    test.setTimeout(60000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerLoginCreateChar(pageA, '交易方A');
      await registerLoginCreateChar(pageB, '交易方B');

      await pageB.getByRole('button', { name: '交易' }).click();
      await expect(pageB.locator('.trade-container')).toBeVisible({ timeout: 5000 });

      await pageA.getByRole('button', { name: '交易' }).click();
      await expect(pageA.locator('.trade-container')).toBeVisible({ timeout: 5000 });

      await expect(pageA.locator('.player-card')).toBeVisible({ timeout: 10000 });
      await pageA.locator('.player-card').filter({ hasText: '交易方B' }).locator('.invite-btn').click();
      await pageB.getByRole('button', { name: '接受' }).click();

      await expect(pageA.locator('.trade-panel')).toBeVisible({ timeout: 5000 });
      await expect(pageB.locator('.trade-panel')).toBeVisible({ timeout: 5000 });

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
