# GM 工具与道具逻辑检查报告

> 检查时间：道具效果统一重构后  
> 检查范围：GM 工具、后端 Admin API、道具使用流程

---

## 一、GM 工具模块检查结果

### 1. 物品管理 (item.js) ✅ 已修复

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 类型选项完整性 | ✅ 已修复 | **原问题**：type 下拉只有 1/2/3/4，编辑多倍卡(id 101-112)、VIP卡(id 201)、永久属性果实(id 120-125) 时，类型会错误保存为 1，破坏游戏逻辑。<br>**修复**：已补充 type 5（多倍卡）、type 6（VIP卡）选项。 |
| 回血/回蓝字段 | ✅ 正常 | 使用 hp_restore、mp_restore，与数据库一致。 |
| API 调用 | ✅ 正常 | `/admin/item` 增删改查，与后端一致。 |

### 2. 掉落配置 (drop.js) ✅ 正常

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 概率支持小数 | ✅ 正常 | 已使用 parseFloat，支持 0.1%、0.01% 等。 |
| 怪物/Boss 掉落 | ✅ 正常 | 调用 `/admin/monster_drop`、`/admin/boss_drop`。 |

### 3. 技能管理 (skill.js) ✅ 正常

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 技能书 ID (book_id) | ✅ 正常 | 关联 item 表，学习时由 skill 表 book_id 查找。<br>**注意**：GM 新建技能书类物品后，需在「道具效果」中为该物品添加 `learn_skill` 配置，否则玩家点背包「使用」会提示「该物品无法直接使用」。技能页直接学技能不依赖配置。 |
| API 调用 | ✅ 正常 | `/admin/skill` 增删改查。 |

### 4. 商店管理 (shop.js) ✅ 正常

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 商品配置 | ✅ 正常 | 选择物品、价格、分类，与 bag.addItem 流程兼容。 |
| 发放逻辑 | ✅ 正常 | 购买走 shop 接口，最终调用 bagService.addItem。 |

### 5. 玩家操作 (misc.js) ✅ 正常

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 发放物品 | ✅ 正常 | `/admin/player/give-item` → bagService.addItem，支持所有物品类型。 |
| 发放金币/积分 | ✅ 正常 | 直接更新玩家数据。 |
| 设置 VIP | ✅ 正常 | `/admin/player/vip`，独立于道具系统。 |
| 解绑 IP | ✅ 正常 | `/admin/user/unbind-ip`。 |

### 6. 其他 GM 模块 (boss/monster/map/equip/level) ✅ 正常

与道具使用逻辑无直接关联，未发现受影响点。

---

## 二、后端 item.service 修复

| 问题 | 修复 |
|------|------|
| `getItemUsage` 使用 `item.hp`/`item.mp` | 改为 `hp_restore`/`mp_restore`，血药蓝药说明可正确显示。 |
| `calculateItemAttributes` 消耗品用 `item.hp`/`item.mp` | 改为 `hp_restore`/`mp_restore`。 |

---

## 三、道具使用流程（重构后）确认

| 场景 | 入口 | 是否依赖 item_effect 表 | 状态 |
|------|------|-----------------------------|------|
| 背包点「使用」 | bag.service.useItem | ✅ 是，无配置则报错 | 正常 |
| 战斗/Boss 自动喝药 | bag.service.useItem(bagId) | ✅ 血药(3)蓝药(4)有 config | 正常 |
| 技能页学技能 | skillService.learnSkill(book_id) | ❌ 不依赖 | 正常 |
| GM 发放物品 | bagService.addItem | ❌ 不依赖 | 正常 |
| 商店购买 | bagService.addItem | ❌ 不依赖 | 正常 |

---

## 四、部位（pos）唯一数据源

- **item.pos** 为唯一数据源，仅装备类型（type=2）可配置
- 物品管理：类型选「装备」时显示部位及装备属性区，保存时同步创建/更新 equip_base
- 装备管理：仅编辑、删除、查看；新增装备请在物品管理中完成

## 五、GM 使用注意事项（唯一入口）

1. **功能性道具**（材料 6/7/8/10、扩容袋 11、多倍卡 101-112、永久属性果实 120-125、VIP 201）由 init-mongodb 初始化，**不可通过 GM 新增**（多倍卡需 boost_category 等字段，GM 表单无此配置）。GM 可编辑名称、描述等，勿修改类型或效果相关字段。
2. **物品管理** 为其余物品的创建入口：
   - 消耗品/材料：填回血或回蓝 → 自动恢复药水
   - 道具/技能书(type 4)：选「使用效果」→ 技能书/扩容袋/永久属性果实，按需填参数
2. **技能书**：选效果「技能书」并填写「同时创建技能」，保存时自动创建技能并关联。技能管理仅保留编辑、删除、查看。
3. **道具效果**：仅保留编辑、删除、查看。新增效果请到物品管理编辑该物品并设置效果类型后保存。
4. **装备**：在物品管理创建（类型选装备，填写部位及 HP/MP/攻防等），一步完成 item + equip_base。装备管理仅保留编辑、删除、查看。

---

## 六、道具效果迁移至数据库（最新）

- **item_effect 表**：存储 item_id、effect_type、attr、value、max、also_add_current
- **GM 工具**：新增「道具效果」标签页，可增删改查，新建技能书/消耗品后直接在此配置
- **删除**：`item-effect.config.ts` 已移除，逻辑统一从数据库读取

## 七、init-mongodb（集合 + 功能性道具）

- **创建集合**：user、player、bag、equip_instance、item、equip_base、item_effect、shop 等
- **插入功能性道具**（ID 全部从 config.functional_items 读取，无硬编码）：
  - enhance_materials：强化石、防爆符、幸运符、祝福油
  - expand_bag：扩容袋
  - boost_ids：多倍卡 12 张
  - stat_fruit_ids：永久属性果实 6 个
  - vip_card：VIP 卡
- **修改 ID**：直接改 config 表 `functional_items` 的 value 后重跑 init，或通过 GM 配置管理（若已扩展）
- **由 GM 创建**：装备、药水、技能书、怪物、地图、等级经验、商店等

## 八、历史修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `client/gm/js/modules/core.js` | 新增 EQUIP_POS_NAMES、posOptions（部位唯一常量） |
| `client/gm/js/modules/item.js` | 部位仅装备类型显示，用下拉；补充 type 5、6 选项及 TYPE_MAP |
| `client/gm/js/modules/equip.js` | 移除部位输入，创建时从 item 取；编辑时只读显示 |
| `server/src/api/admin/equip_base.ts` | 创建时 pos 从 item 取；更新时不再接受 pos |
| `server/src/service/item.service.ts` | updateItem 时同步 equip_base.pos；getItemUsage、calculateItemAttributes 使用 hp_restore/mp_restore |
| `server/init-mongodb.js` | 创建集合 + 从 config.functional_items 读取 ID 插入功能性道具，无硬编码 |
| `server/src/service/enhance-config.service.ts` | 从 config 读取强化材料 ID，避免硬编码 |
| `server/src/api/config.ts` | GET /api/config/enhance_materials 供前端读取 |
| `client/js/pages/enhance.js` | 从配置读取材料 ID，不再硬编码 [6,7,8,10] |
