/**
 * GM 工具主入口：加载各模块，验证登录，注册全局函数供 onclick 调用
 */
import { getToken, verifyToken, logout, showToast, hideFormModal } from './modules/core.js';
import * as monster from './modules/monster.js';
import * as boss from './modules/boss.js';
import * as skill from './modules/skill.js';
import * as map from './modules/map.js';
import * as item from './modules/item.js';
import * as itemEffect from './modules/item-effect.js';
import * as equip from './modules/equip.js';
import * as drop from './modules/drop.js';
import * as level from './modules/level.js';
import * as misc from './modules/misc.js';
import * as shop from './modules/shop.js';

// 注册到 window，供 HTML onclick 调用
function registerGlobals() {
  window.loadMonsterList = monster.loadMonsterList;
  window.addMonster = monster.addMonster;
  window.saveMonster = monster.saveMonster;
  window.cancelAddMonster = monster.cancelAddMonster;
  window.editMonster = monster.editMonster;
  window.cancelEditMonster = monster.cancelEditMonster;
  window.updateMonster = monster.updateMonster;
  window.deleteMonster = monster.deleteMonster;

  window.loadBossList = boss.loadBossList;
  window.addBoss = boss.addBoss;
  window.saveBoss = boss.saveBoss;
  window.cancelAddBoss = boss.cancelAddBoss;
  window.editBoss = boss.editBoss;
  window.cancelEditBoss = boss.cancelEditBoss;
  window.updateBoss = boss.updateBoss;
  window.deleteBoss = boss.deleteBoss;

  window.loadSkillList = skill.loadSkillList;
  window.editSkill = skill.editSkill;
  window.cancelEditSkill = skill.cancelEditSkill;
  window.updateSkill = skill.updateSkill;
  window.deleteSkill = skill.deleteSkill;

  window.loadMapList = map.loadMapList;
  window.addMap = map.addMap;
  window.saveMap = map.saveMap;
  window.editMap = map.editMap;
  window.updateMap = map.updateMap;
  window.deleteMap = map.deleteMap;

  window.loadItemList = item.loadItemList;
  window.addItem = item.addItem;
  window.saveItem = item.saveItem;
  window.editItem = item.editItem;
  window.updateItem = item.updateItem;
  window.deleteItem = item.deleteItem;

  window.loadItemEffectList = itemEffect.loadItemEffectList;
  window.editItemEffect = itemEffect.editItemEffect;
  window.updateItemEffect = itemEffect.updateItemEffect;
  window.deleteItemEffect = itemEffect.deleteItemEffect;

  window.loadEquipList = equip.loadEquipList;
  window.editEquip = equip.editEquip;
  window.updateEquip = equip.updateEquip;
  window.deleteEquip = equip.deleteEquip;

  window.loadDropList = drop.loadDropList;
  window.addDrop = drop.addDrop;
  window.saveDrop = drop.saveDrop;
  window.editDrop = drop.editDrop;
  window.updateDrop = drop.updateDrop;
  window.deleteDrop = drop.deleteDrop;

  window.loadLevelList = level.loadLevelList;
  window.addLevelExp = level.addLevelExp;
  window.saveLevelExp = level.saveLevelExp;
  window.editLevel = level.editLevel;
  window.updateLevelExp = level.updateLevelExp;
  window.deleteLevel = level.deleteLevel;

  window.clearCache = misc.clearCache;
  window.getPlayerInfo = misc.getPlayerInfo;
  window.giveItemToPlayer = misc.giveItemToPlayer;
  window.setPlayerVip = misc.setPlayerVip;
  window.loadItemSelect = misc.loadItemSelect;

  window.loadShopList = shop.loadShopList;
  window.addShopItem = shop.addShopItem;
  window.saveShopItem = shop.saveShopItem;
  window.editShopItem = shop.editShopItem;
  window.updateShopItem = shop.updateShopItem;
  window.deleteShopItem = shop.deleteShopItem;

  window.hideFormModal = hideFormModal;
  window.giveGoldToPlayer = misc.giveGoldToPlayer;
  window.givePointsToPlayer = misc.givePointsToPlayer;
  window.unbindUserIp = misc.unbindUserIp;
  window.logout = logout;
  window.switchTab = switchTab;
}

function switchTab(tabName, event) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  const tab = document.getElementById(`${tabName}-tab`);
  if (tab) tab.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (event?.target) event.target.classList.add('active');

  switch (tabName) {
    case 'monster': monster.loadMonsterList(); break;
    case 'boss': boss.loadBossList(); break;
    case 'skill': skill.loadSkillList(); break;
    case 'map': map.loadMapList(); break;
    case 'item': item.loadItemList(); break;
    case 'item-effect': itemEffect.loadItemEffectList(); break;
    case 'equip': equip.loadEquipList(); break;
    case 'drop': drop.loadDropList(); break;
    case 'level': level.loadLevelList(); break;
    case 'shop': shop.loadShopList(); break;
    case 'player': misc.loadItemSelect(); break;
  }
}

async function init() {
  registerGlobals();

  if (!getToken()) {
    window.location.href = 'login.html';
    return;
  }

  const ok = await verifyToken();
  if (ok) {
    monster.loadMonsterList();
  }
}

init();
