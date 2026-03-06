/**
 * E2E 共享辅助函数
 *
 * 消除 spec 文件中的重复注册/登录/购买逻辑。
 * 所有 spec 应 require('./helpers') 而非自行定义。
 */
const { expect } = require('@playwright/test');

/**
 * 注册 → 登录 → 创建角色，等待 WS 就绪。
 * @returns {{ username: string, password: string }}
 */
async function registerLoginCreateChar(page, name = 'E2E测试') {
  const username = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
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
  await page.getByPlaceholder('请输入角色名称').fill(name);
  await page.getByRole('button', { name: '创建角色' }).click();

  await expect(page.getByText('角色创建成功')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.top-nav')).toBeVisible({ timeout: 5000 });

  await page.waitForFunction(() => {
    return typeof WS !== 'undefined' && WS._serverReady === true;
  }, { timeout: 15000 });

  return { username, password };
}

/**
 * 在商店购买指定物品。
 */
async function buyFromShop(page, itemName, quantity = 1) {
  await page.getByRole('button', { name: '商店' }).click();
  await expect(page.locator('.shop-container')).toBeVisible({ timeout: 5000 });
  let itemLoc = page.locator('.shop-item').filter({ hasText: itemName });
  if (!(await itemLoc.isVisible().catch(() => false))) {
    const pager2 = page.locator('#shop-right').getByRole('button', { name: '2' });
    if (await pager2.isVisible().catch(() => false)) await pager2.click();
  }
  itemLoc = page.locator('.shop-item').filter({ hasText: itemName });
  await expect(itemLoc).toBeVisible({ timeout: 10000 });
  await itemLoc.getByRole('button', { name: '购买' }).click();
  await expect(page.locator('#shop-confirm-popup')).toBeVisible({ timeout: 5000 });
  if (quantity > 1) {
    await page.locator('#shop-buy-qty').waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('#shop-buy-qty').evaluate((el, qty) => {
      el.value = String(qty);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, quantity);
  }
  await page.locator('#shop-confirm-popup').getByRole('button', { name: '确定' }).click();
  await expect(page.getByText(/购买成功/)).toBeVisible({ timeout: 15000 });
}

/**
 * 进入地图打一场怪物战斗。
 */
async function doMonsterBattle(page) {
  await page.getByRole('button', { name: '地图' }).click();
  await expect(page.locator('.map-container')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '怪物' }).first().click();
  await expect(page.locator('.enemy-list-container')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '战斗' }).first().click();
  await expect(page.locator('.battle-container')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '开始战斗' }).click();
  await expect(
    page.locator('.battle-log-content').filter({ hasText: /战斗胜利|战斗奖励|战斗失败|战斗平局|战斗结束/ })
  ).toBeVisible({ timeout: 45000 });
}

/**
 * 通过页面内 fetch 调后端 API，拿到 player 数据。
 */
async function getPlayerAPI(page) {
  return await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/player/get', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    return json.data;
  });
}

/**
 * 通过页面内 fetch 调后端 API，拿到背包数据。
 */
async function getBagAPI(page) {
  return await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/bag/list', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    return json.data;
  });
}

/**
 * 通过页面内 fetch 调后端 API，拿到装备栏数据。
 */
async function getEquipAPI(page) {
  return await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/equip/list', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    return json.data;
  });
}

module.exports = {
  registerLoginCreateChar,
  buyFromShop,
  doMonsterBattle,
  getPlayerAPI,
  getBagAPI,
  getEquipAPI,
};
