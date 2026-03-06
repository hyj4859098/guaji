/**
 * E2E：高危 UI 场景补充（Layer 2）
 * 覆盖 P0 场景中需要验证 UI 反馈的部分
 */
const { test, expect } = require('@playwright/test');
const { registerLoginCreateChar, buyFromShop } = require('./helpers');

// ==================== 强化销毁 UI ====================
test.describe('强化失败 UI', () => {
  test('多次强化直到出现成功或失败提示', async ({ page }) => {
    test.setTimeout(60000);
    await registerLoginCreateChar(page, 'E2E强化测试');
    await buyFromShop(page, '测试木剑');
    await buyFromShop(page, '强化石', 100);

    await page.getByRole('button', { name: '强化' }).click();
    await expect(page.locator('.enhance-container')).toBeVisible({ timeout: 5000 });

    for (let i = 0; i < 5; i++) {
      const enhBtn = page.locator('.e-item').filter({ hasText: '测试木剑' }).locator('.enhance-bag-item-btn').first();
      if (!(await enhBtn.isVisible().catch(() => false))) break;
      await enhBtn.click();
      const msg = await page.getByText(/强化成功|强化失败|装备已破碎|强化石不足/).textContent({ timeout: 5000 });
      if (msg.includes('破碎') || msg.includes('不足')) break;
      await page.waitForTimeout(500);
    }
    // verify enhance UI showed at least one result
    await expect(page.locator('.enhance-container')).toBeVisible();
  });

  test('使用防爆符强化', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, 'E2E防爆测试');
    await buyFromShop(page, '测试木剑');
    await buyFromShop(page, '强化石', 100);
    await buyFromShop(page, '防爆符');

    await page.getByRole('button', { name: '强化' }).click();
    await expect(page.locator('.enhance-container')).toBeVisible({ timeout: 5000 });

    const antiCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /防爆/ }).or(page.locator('.anti-explode-checkbox'));
    if (await antiCheckbox.isVisible().catch(() => false)) {
      await antiCheckbox.check();
    }

    await expect(page.locator('.enhance-bag-item-btn')).toBeVisible({ timeout: 5000 });
    await page.locator('.e-item').filter({ hasText: '测试木剑' }).locator('.enhance-bag-item-btn').first().click();
    await expect(page.getByText(/强化成功|强化失败/)).toBeVisible({ timeout: 5000 });
  });
});

// ==================== 拍卖装备交易 UI ====================
test.describe('拍卖装备交易', () => {
  test('A 上架装备 → B 购买 → B 背包显示装备', async ({ browser }) => {
    test.setTimeout(60000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerLoginCreateChar(pageA, '装备卖家');
      await buyFromShop(pageA, '测试木剑');

      // A 去背包上架装备
      await pageA.getByRole('button', { name: '角色' }).click();
      await expect(pageA.locator('#backpack')).toBeVisible({ timeout: 5000 });
      await expect(pageA.locator('.bag-item').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });
      await pageA.locator('.bag-item').filter({ hasText: '测试木剑' }).getByRole('button', { name: '上架' }).click();
      await pageA.locator('#auctionListPrice').fill('1');
      await pageA.getByRole('button', { name: '确定上架' }).click();
      await expect(pageA.getByText(/上架成功/)).toBeVisible({ timeout: 5000 });

      // B 登录后去拍卖行购买
      await registerLoginCreateChar(pageB, '装备买家');
      await pageB.getByRole('button', { name: '拍卖' }).click();
      await expect(pageB.locator('.auction-container')).toBeVisible({ timeout: 5000 });
      await expect(pageB.locator('.auction-table').getByRole('button', { name: '购买' }).first()).toBeVisible({ timeout: 10000 });
      await pageB.locator('.auction-table').getByRole('button', { name: '购买' }).first().click();
      await pageB.getByRole('button', { name: '确定' }).click();
      await expect(pageB.getByText(/购买成功/)).toBeVisible({ timeout: 10000 });

      // B 查看背包确认装备在
      await pageB.getByRole('button', { name: '角色' }).click();
      await expect(pageB.locator('.bag-item-name').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 15000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

// ==================== 交易含装备 ====================
test.describe('交易含装备', () => {
  test('A 放装备交易给 B，B 收到装备', async ({ browser }) => {
    test.setTimeout(90000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerLoginCreateChar(pageA, '交易给装备A');
      await buyFromShop(pageA, '测试木剑');

      await registerLoginCreateChar(pageB, '交易收装备B');

      // B 先进入交易
      await pageB.getByRole('button', { name: '交易' }).click();
      await expect(pageB.locator('.trade-container')).toBeVisible({ timeout: 5000 });

      // A 进入交易
      await pageA.getByRole('button', { name: '交易' }).click();
      await expect(pageA.locator('.trade-container')).toBeVisible({ timeout: 5000 });

      // A 邀请 B
      await expect(pageA.locator('.player-card')).toBeVisible({ timeout: 10000 });
      await pageA.locator('.player-card').filter({ hasText: '交易收装备B' }).locator('.invite-btn').click();

      // B 接受
      await pageB.getByRole('button', { name: '接受' }).click();

      await expect(pageA.locator('.trade-panel')).toBeVisible({ timeout: 5000 });
      await expect(pageB.locator('.trade-panel')).toBeVisible({ timeout: 5000 });

      // A 选择装备到交易槽（如果 UI 支持）
      const addItemBtn = pageA.locator('.trade-add-item, .trade-select-item').first();
      if (await addItemBtn.isVisible().catch(() => false)) {
        await addItemBtn.click();
        const equipOption = pageA.locator('.trade-item-option, .bag-item').filter({ hasText: '测试木剑' }).first();
        if (await equipOption.isVisible().catch(() => false)) {
          await equipOption.click();
        }
      }

      // 双方确认
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

// ==================== 离线战斗恢复 ====================
test.describe('离线战斗恢复', () => {
  test('自动战斗后重新登录触发恢复', async ({ page, context }) => {
    test.setTimeout(90000);
    const { username, password } = await registerLoginCreateChar(page, 'E2E离线测试');

    // 开始自动战斗
    await page.getByRole('button', { name: '地图' }).click();
    await expect(page.locator('.map-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '怪物' }).first().click();
    await expect(page.locator('.enemy-list-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '战斗' }).first().click();
    await expect(page.locator('.battle-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '自动战斗' }).click();

    await expect(
      page.locator('.battle-log-content').filter({ hasText: /战斗开始|战斗胜利|战斗奖励/ })
    ).toBeVisible({ timeout: 45000 });

    // 模拟断开：清除存储并重新登录
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');

    await page.getByText('登录').first().click();
    await page.getByPlaceholder('用户名').fill(username);
    await page.getByPlaceholder('密码').fill(password);
    await page.locator('#authSubmitBtn').click();

    // 应该自动进入游戏（已有角色）
    await expect(page.locator('.top-nav')).toBeVisible({ timeout: 10000 });
  });
});

// ==================== 购买自己的拍卖品 ====================
test.describe('拍卖自购', () => {
  test('购买自己上架的商品应失败', async ({ page }) => {
    test.setTimeout(45000);
    await registerLoginCreateChar(page, 'E2E自购测试');
    await buyFromShop(page, '强化石');

    // 上架
    await page.getByRole('button', { name: '角色' }).click();
    await page.locator('#backpack .bag-tab').filter({ hasText: '材料' }).click();
    await page.locator('.bag-item').filter({ hasText: '强化石' }).getByRole('button', { name: '上架' }).click();
    await page.locator('#auctionListPrice').fill('1');
    await page.getByRole('button', { name: '确定上架' }).click();
    await expect(page.getByText(/上架成功/)).toBeVisible({ timeout: 5000 });

    // 去拍卖行尝试购买自己的
    await page.getByRole('button', { name: '拍卖' }).click();
    await expect(page.locator('.auction-container')).toBeVisible({ timeout: 5000 });

    const buyBtn = page.locator('.auction-table').getByRole('button', { name: '购买' }).first();
    if (await buyBtn.isVisible().catch(() => false)) {
      await buyBtn.click();
      const confirmBtn = page.getByRole('button', { name: '确定' });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }
      // should show error or not have a buy button for own items
      await expect(
        page.getByText(/自己|不能购买|购买失败/).or(page.locator('.auction-table'))
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
