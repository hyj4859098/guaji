// GM工具主入口
import { checkLoginStatus, verifyToken, logout, switchTab, showToast, getToken, getApiBaseUrl } from './modules/core.js';
import monsterModule from './modules/monster.js';
import skillModule from './modules/skill.js';

// 模块管理对象
const Modules = {
  monster: monsterModule,
  skill: skillModule,
  map: {
    loadList: () => showToast('地图管理功能开发中', 'error'),
    add: () => showToast('新增地图功能开发中', 'error'),
    edit: () => showToast('编辑地图功能开发中', 'error'),
    delete: () => showToast('删除地图功能开发中', 'error')
  },
  item: {
    loadList: () => showToast('物品管理功能开发中', 'error'),
    add: () => showToast('新增物品功能开发中', 'error'),
    edit: () => showToast('编辑物品功能开发中', 'error'),
    delete: () => showToast('删除物品功能开发中', 'error')
  },
  level: {
    loadList: () => showToast('等级管理功能开发中', 'error'),
    add: () => showToast('新增等级功能开发中', 'error'),
    edit: () => showToast('编辑等级功能开发中', 'error'),
    delete: () => showToast('删除等级功能开发中', 'error')
  },
  player: {
    loadList: () => showToast('玩家管理功能开发中', 'error'),
    add: () => showToast('新增玩家功能开发中', 'error'),
    edit: () => showToast('编辑玩家功能开发中', 'error'),
    delete: () => showToast('删除玩家功能开发中', 'error')
  }
};

// 初始化GM工具
function init() {
  // 检查登录状态
  checkLoginStatus();
}

// 加载模块数据
function loadModuleData(moduleName) {
  const module = Modules[moduleName];
  if (module && module.loadList) {
    module.loadList();
  }
}

// 新增功能
function addItem(moduleName) {
  const module = Modules[moduleName];
  if (module && module.add) {
    module.add();
  }
}

// 编辑功能
function editItem(moduleName, id) {
  const module = Modules[moduleName];
  if (module && module.edit) {
    module.edit(id);
  }
}

// 删除功能
function deleteItem(moduleName, id) {
  const module = Modules[moduleName];
  if (module && module.delete) {
    module.delete(id);
  }
}

// 保存功能
function saveItem(moduleName) {
  const module = Modules[moduleName];
  if (module && module.save) {
    module.save();
  }
}

// 取消功能
function cancelEdit(moduleName) {
  const module = Modules[moduleName];
  if (module && module.cancelEdit) {
    module.cancelEdit();
  }
}

// 导出全局函数
window.init = init;
window.loadModuleData = loadModuleData;
window.addItem = addItem;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.saveItem = saveItem;
window.cancelEdit = cancelEdit;
window.logout = logout;
window.switchTab = switchTab;
window.showToast = showToast;

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);