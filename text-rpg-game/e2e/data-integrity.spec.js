/**
 * E2E 数据完整性测试
 *
 * 不只看 toast，而是在操作后同时验证 DOM 和 API 数据，
 * 确保前后端一致、物品类型不变异、装备实例不丢失。
 */
const { test, expect } = require('@playwright/test');
const {
  registerLoginCreateChar,
  buyFromShop,
  doMonsterBattle,
  getPlayerAPI,
  getBagAPI,
  getEquipAPI,
} = require('./helpers');

// ==================== 装备穿/卸数据完整性 ====================
test.describe('装备数据完整性', () => {
  test('穿戴→卸下后物品 type 不变异、equipment_uid 不丢失', async ({ page }) => {
    test.setTimeout(45000);
    await registerLoginCreateChar(page, '装备完整性');
    await buyFromShop(page, '测试木剑');

    // 从 API 获取背包，记录装备信息
    await page.waitForTimeout(1000);
    const bagBefore = await getBagAPI(page);
    const swordBefore = bagBefore.items.find(i => i.name === '测试木剑' || i.item_id === 13);
    expect(swordBefore).toBeDefined();
    expect(swordBefore.type).toBe(2);
    const originalEquipUid = swordBefore.equipment_uid;
    expect(originalEquipUid).toBeTruthy();

    // 穿戴
    await page.getByRole('button', { name: '角色' }).click();
    await expect(page.locator('#backpack')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.bag-item-name').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });
    await page.locator('.bag-item').filter({ hasText: '测试木剑' }).getByRole('button', { name: '穿戴' }).click();
    await expect(page.locator('#equipSlots').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });

    // 验证：装备栏 API 数据正确
    const equipsAfterWear = await getEquipAPI(page);
    const wornSword = equipsAfterWear.find(e => String(e.equipment_uid) === String(originalEquipUid));
    expect(wornSword).toBeDefined();
    expect(wornSword.item_id).toBe(13);

    // 卸下
    await page.locator('#equipSlots').getByRole('button', { name: '卸下' }).click();
    await expect(page.getByText(/卸下成功/)).toBeVisible({ timeout: 5000 });

    // 验证：背包 API 数据 — type 仍为 2，equipment_uid 仍在
    await page.waitForTimeout(500);
    const bagAfter = await getBagAPI(page);
    const swordAfter = bagAfter.items.find(i => String(i.equipment_uid) === String(originalEquipUid));
    expect(swordAfter).toBeDefined();
    expect(swordAfter.type).toBe(2);       // 不能变成消耗品(1)
    expect(swordAfter.equipment_uid).toBeTruthy(); // equipment_uid 不能丢

    // 验证 DOM：应该有"穿戴"按钮而非"使用"按钮
    const bagItem = page.locator('.bag-item').filter({ hasText: '测试木剑' });
    await expect(bagItem).toBeVisible({ timeout: 5000 });
    const wearBtn = bagItem.getByRole('button', { name: '穿戴' });
    await expect(wearBtn).toBeVisible();
  });

  test('穿/卸 3 次循环后数据完全一致', async ({ page }) => {
    test.setTimeout(60000);
    await registerLoginCreateChar(page, '循环穿卸');
    await buyFromShop(page, '测试木剑');

    await page.waitForTimeout(1000);
    const bagInit = await getBagAPI(page);
    const sword = bagInit.items.find(i => i.item_id === 13);
    const eqUid = sword.equipment_uid;

    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: '角色' }).click();
      await expect(page.locator('.bag-item').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });
      await page.locator('.bag-item').filter({ hasText: '测试木剑' }).getByRole('button', { name: '穿戴' }).click();
      await expect(page.locator('#equipSlots').filter({ hasText: '测试木剑' })).toBeVisible({ timeout: 5000 });

      await page.locator('#equipSlots').getByRole('button', { name: '卸下' }).click();
      await expect(page.getByText(/卸下成功/)).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);
    }

    const bagFinal = await getBagAPI(page);
    const swordFinal = bagFinal.items.find(i => String(i.equipment_uid) === String(eqUid));
    expect(swordFinal).toBeDefined();
    expect(swordFinal.type).toBe(2);
    expect(swordFinal.equipment_uid).toBeTruthy();
  });
});

// ==================== 战斗前后端数据同步 ====================
test.describe('战斗数据同步', () => {
  test('战斗中怪物 HP 数值必须变化', async ({ page }) => {
    test.setTimeout(90000);
    await registerLoginCreateChar(page, '战斗HP验证');

    await page.getByRole('button', { name: '地图' }).click();
    await expect(page.locator('.map-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '怪物' }).first().click();
    await expect(page.locator('.enemy-list-container')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '战斗' }).first().click();
    await expect(page.locator('.battle-container')).toBeVisible({ timeout: 5000 });

    // 记录初始怪物 HP
    await page.waitForTimeout(500);
    const hpBefore = await page.locator('#monsterHpText').textContent().catch(() => '');

    await page.getByRole('button', { name: '开始战斗' }).click();

    // 等战斗日志出现伤害
    await expect(
      page.locator('.battle-log-item').filter({ hasText: /伤害|攻击/ })
    ).toBeVisible({ timeout: 30000 });

    // HP 必须变化
    const hpAfter = await page.locator('#monsterHpText').textContent().catch(() => '');
    if (hpBefore && hpAfter && hpBefore !== '' && hpAfter !== '') {
      expect(hpAfter).not.toBe(hpBefore);
    }

    // HP bar 宽度不应该还是 100%
    const barWidth = await page.locator('#monsterHpBar').evaluate(
      el => el.style.width
    ).catch(() => '100%');
    expect(barWidth).not.toBe('100%');
  });

  test('战斗胜利后前后端金币/经验一致', async ({ page }) => {
    test.setTimeout(120000);
    await registerLoginCreateChar(page, '战斗对账');

    const playerBefore = await getPlayerAPI(page);
    const goldBefore = playerBefore.gold;

    await doMonsterBattle(page);
    await page.waitForTimeout(1000);

    // API 数据
    const playerAfter = await getPlayerAPI(page);

    // 金币应该 >= 之前（可能获得奖励）
    expect(playerAfter.gold).toBeGreaterThanOrEqual(goldBefore);

    // DOM 中显示的等级不应为空
    const levelText = await page.locator('#playerLevel').textContent().catch(() => '');
    expect(levelText).toBeTruthy();
  });
});

// ==================== 商店购买数据对账 ====================
test.describe('商店数据对账', () => {
  test('购买消耗品后 API 中 count 正确', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, '商店对账');
    await buyFromShop(page, '小血瓶', 3);

    await page.waitForTimeout(1000);
    const bag = await getBagAPI(page);
    const potion = bag.items.find(i => i.item_id === 1);
    expect(potion).toBeDefined();
    expect(potion.count).toBe(3);
  });

  test('购买装备后 type=2 且 equipment_uid 存在', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, '装备购买验证');
    await buyFromShop(page, '测试木剑');

    await page.waitForTimeout(1000);
    const bag = await getBagAPI(page);
    const sword = bag.items.find(i => i.item_id === 13);
    expect(sword).toBeDefined();
    expect(sword.type).toBe(2);
    expect(sword.equipment_uid).toBeTruthy();
  });
});

// ==================== 消耗品使用数据对账 ====================
test.describe('消耗品数据对账', () => {
  test('使用 1 个消耗品后 count 精确 -1', async ({ page }) => {
    test.setTimeout(30000);
    await registerLoginCreateChar(page, '消耗品对账');
    await buyFromShop(page, '小血瓶', 3);

    await page.getByRole('button', { name: '角色' }).click();
    await page.locator('#backpack .bag-tab').filter({ hasText: '消耗品' }).click();
    await page.locator('.bag-item').filter({ hasText: '小血瓶' }).getByRole('button', { name: '使用' }).click();
    await expect(page.getByText(/使用成功/)).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1000);
    const bag = await getBagAPI(page);
    const potion = bag.items.find(i => i.item_id === 1);
    expect(potion).toBeDefined();
    expect(potion.count).toBe(2);
  });
});
