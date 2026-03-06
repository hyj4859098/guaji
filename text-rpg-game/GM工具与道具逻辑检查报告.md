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

## 二、血药/蓝药恢复值：唯一数据源（无两套逻辑）

- **统一入口**：`utils/item-type.ts` 的 `getHpRestore(item)`、`getMpRestore(item)`
- **逻辑**：优先 `hp_restore`/`mp_restore`，兼容旧字段 `hp`/`mp`
- **使用处**：item.service、item-effect.service、bag.service、shop.service、auction.service 均调用上述函数，禁止各处重复实现

---

## 三、各类物品堆叠与逻辑检查（道具逻辑大改后）

| 物品类型 | type | 堆叠逻辑 | 效果字段 | 状态 |
|----------|------|----------|----------|------|
| 消耗品（血药/蓝药） | 1 | model.addItem 合并 | hp_restore/mp_restore → getHpRestore/getMpRestore | ✅ 已统一 |
| 装备 | 2 | 每件独立 equipment_uid | equip_base 属性 | ✅ 正常 |
| 材料（强化石等） | 3 | model.addItem 合并 | 无使用效果 | ✅ 已统一 |
| 道具（技能书/扩容袋/果实） | 4 | model.addItem 合并 | item_effect 表 | ✅ 已统一 |
| 多倍卡 | 5 | model.addItem 合并 | boost_category、boost_multiplier | ✅ 已统一 |
| VIP 卡 | 6 | model.addItem 合并 | vip_days | ✅ 已统一 |

**堆叠修复说明**：消耗品/材料/道具（type≠2）统一走 `bag.model.addItem`，不再用 list+find 自定义逻辑，避免因 uid/equipment_uid 差异导致无法合并。

**其他效果字段**：vip_days、boost_category、boost_multiplier、add_stat 的 attr/value 均从 item 表或 item_effect 表单一读取，无重复实现。

---

## 四、道具使用流程确认

| 场景 | 入口 | 是否依赖 item_effect 表 | 状态 |
|------|------|-----------------------------|------|
| 背包点「使用」 | bag.service.useItem | ✅ 是，无配置则报错 | 正常 |
| 战斗/Boss 自动喝药 | bag.service.useItem(bagId) | ✅ 血药(3)蓝药(4)有 config | 正常 |
| 技能页学技能 | skillService.learnSkill(book_id) | ❌ 不依赖 | 正常 |
| GM 发放物品 | bagService.addItem | ❌ 不依赖 | 正常 |
| 商店购买 | bagService.addItem | ❌ 不依赖 | 正常 |

---

## 五、部位（pos）唯一数据源

- **item.pos** 为唯一数据源，仅装备类型（type=2）可配置
- 物品管理：类型选「装备」时显示部位及装备属性区，保存时同步创建/更新 equip_base
- 装备管理：仅编辑、删除、查看；新增装备请在物品管理中完成

## 六、GM 使用注意事项（唯一入口）

1. **功能性道具**（材料 6/7/8/10、扩容袋 11、多倍卡 101-112、永久属性果实 120-125、VIP 201）由 init-mongodb 初始化，**不可通过 GM 新增**（多倍卡需 boost_category 等字段，GM 表单无此配置）。GM 可编辑名称、描述等，勿修改类型或效果相关字段。
2. **物品管理** 为其余物品的创建入口：
   - 消耗品/材料：填回血或回蓝 → 自动恢复药水
   - 道具/技能书(type 4)：选「使用效果」→ 技能书/扩容袋/永久属性果实，按需填参数
2. **技能书**：选效果「技能书」并填写「同时创建技能」，保存时自动创建技能并关联。技能管理仅保留编辑、删除、查看。
3. **道具效果**：仅保留编辑、删除、查看。新增效果请到物品管理编辑该物品并设置效果类型后保存。
4. **装备**：在物品管理创建（类型选装备，填写部位及 HP/MP/攻防等），一步完成 item + equip_base。装备管理仅保留编辑、删除、查看。

---

## 七、道具效果迁移至数据库（最新）

- **item_effect 表**：存储 item_id、effect_type、attr、value、max、also_add_current
- **GM 工具**：新增「道具效果」标签页，可增删改查，新建技能书/消耗品后直接在此配置
- **删除**：`item-effect.config.ts` 已移除，逻辑统一从数据库读取

## 八、init-mongodb（集合 + 功能性道具）

- **创建集合**：user、player、bag、equip_instance、item、equip_base、item_effect、shop 等
- **插入功能性道具**（ID 全部从 config.functional_items 读取，无硬编码）：
  - enhance_materials：强化石、防爆符、幸运符、祝福油
  - expand_bag：扩容袋
  - boost_ids：多倍卡 12 张
  - stat_fruit_ids：永久属性果实 6 个
  - vip_card：VIP 卡
- **修改 ID**：直接改 config 表 `functional_items` 的 value 后重跑 init，或通过 GM 配置管理（若已扩展）
- **由 GM 创建**：装备、药水、技能书、怪物、地图、等级经验、商店等

## 九、上线前审计（最新）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 血药/蓝药恢复 | ✅ | 统一 getHpRestore/getMpRestore，item-effect、bag、shop、auction 一致 |
| 装备属性来源 | ✅ | calculateItemAttributes 装备从 equip_base 读取，消耗品用 getHpRestore/getMpRestore |
| equip_base 创建 | ✅ | 仅 type=2 可创建；物品 type 从 2 改为非 2 时自动删除 equip_base |
| 掉落 itemInfo 空 | ✅ | battle/boss/auction/offline-battle 中 itemInfo 为空时跳过，不默认 type=2 |
| 背包 addItem | ✅ | type 1–6 校验；type≠2 走 model.addItem 堆叠 |
| 前端 tooltip | ✅ | hp_restore ?? hp、mp_restore ?? mp 兼容旧数据 |
| 离线挂机掉落 | ✅ | processDrops 中 itemInfo 不存在时跳过，避免引用已删除物品 |

## 十、历史修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `client/gm/js/modules/core.js` | 新增 EQUIP_POS_NAMES、posOptions（部位唯一常量） |
| `client/gm/js/modules/item.js` | 部位仅装备类型显示，用下拉；补充 type 5、6 选项及 TYPE_MAP |
| `client/gm/js/modules/equip.js` | 移除部位输入，创建时从 item 取；编辑时只读显示 |
| `server/src/api/admin/equip_base.ts` | 创建时 pos 从 item 取；更新时不再接受 pos |
| `server/src/service/item.service.ts` | updateItem 时同步 equip_base.pos；getItemUsage、calculateItemAttributes 使用 getHpRestore/getMpRestore；getItemUsage 补充 type 5/6；calculateItemAttributes 改为 async，装备从 equip_base 读取 |
| `server/src/utils/item-type.ts` | 新增 getHpRestore、getMpRestore 统一入口 |
| `server/src/service/bag.service.ts` | addItem 消耗品/材料/道具改用 model.addItem，确保堆叠合并；addItem 增加 type 1–6 校验 |
| `server/init-mongodb.js` | 创建集合 + 从 config.functional_items 读取 ID 插入功能性道具，无硬编码 |
| `server/src/service/enhance-config.service.ts` | 从 config 读取强化材料 ID，避免硬编码 |
| `server/src/api/config.ts` | GET /api/config/enhance_materials 供前端读取 |
| `client/js/pages/enhance.js` | 从配置读取材料 ID，不再硬编码 [6,7,8,10] |
| `client/js/core/tooltip.js` | 血药/蓝药显示 hp_restore ?? hp、mp_restore ?? mp 兼容旧数据 |
| `server/src/service/offline-battle.service.ts` | processDrops 中 itemInfo 不存在时跳过 |

---

## 十一、系统性检查（全链路）

### 11.1 血药/蓝药数据流 ✅

| 环节 | 实现 | 状态 |
|------|------|------|
| 后端 bag.list | getHpRestore/getMpRestore | ✅ |
| 后端 shop/auction | getHpRestore/getMpRestore | ✅ |
| 后端 item-effect | getHpRestore/getMpRestore | ✅ |
| 后端 offline-battle | 来自 bag.list，已含正确值 | ✅ |
| 前端 tooltip | hp_restore ?? hp 兼容 | ✅ |
| 前端 battle 药水筛选 | 来自 bag API，数据正确 | ✅ |

### 11.2 装备类型判断 ✅

| 位置 | 实现 | 状态 |
|------|------|------|
| 后端 trade/shop/auction/offline-battle | isEquipment(itemInfo) | ✅ |
| 后端 equip_instance/equip_base | item.type === 2 | ✅ |
| 前端 auction/enhance/trade | Helper.isEquipment | ✅ |

### 11.3 物品 type 校验 ✅

| 位置 | 校验 | 状态 |
|------|------|------|
| admin/item POST/PUT | type 1–6 | ✅ |
| bag.addItem | type 1–6，异常抛错 | ✅ |
| equip_base 创建 | 仅 type=2 | ✅ |

### 11.4 空值/异常防护 ✅

| 场景 | 处理 | 状态 |
|------|------|------|
| battle/boss processDrop itemInfo 空 | continue 跳过 | ✅ |
| auction list itemInfo 空 | continue 跳过 | ✅ |
| offline processDrops itemInfo 空 | continue 跳过 | ✅ |
| bag.useItem itemInfo 空 | 抛错 | ✅ |
| shop 购买 itemInfo 空 | 抛错 | ✅ |

### 11.5 装备实现统一性 ✅

| 环节 | 数据源 | 实现 | 状态 |
|------|--------|------|------|
| **装备基础属性** | equip_base 表 | 唯一存储 base_phy_atk、base_phy_def 等 | ✅ |
| **创建入口** | admin/item | type=2 保存时 syncEquipBase | ✅ |
| **实例创建** | equip_instance | createFromBase（手动）、createFromDrop（掉落）均从 equip_base 读取 | ✅ |
| **实例创建调用** | bag/battle/boss/offline | 统一走 equipInstanceService.createFromBase 或 createFromDrop | ✅ |
| **属性构建** | equip_instance.service | buildEquipAttrs、buildBaseAttrs 均从 equip_base 取 | ✅ |
| **拍卖行** | auction.service | 有 instance 用 buildEquipAttrs；无 instance 有 equipBase 时直接组装 | ✅ |
| **穿戴效果** | equip-effect.ts | 从 equip_attributes 取 phy_atk、phy_def 等，与 buildEquipAttrs 输出一致 | ✅ |
| **前端 tooltip** | equip_attributes / base_attributes | 使用 phy_atk、phy_def 等，与后端一致 | ✅ |

**命名约定**：装备实例属性统一用 `phy_atk`、`phy_def`、`mag_atk`、`mag_def`、`hit_rate`、`dodge_rate`、`crit_rate`。item.service.calculateItemAttributes 返回 `attack`/`defense` 仅用于物品模板（/api/item），与装备实例的 phy_atk/phy_def 为不同场景。

### 11.6 可选优化（非必须）

| 项 | 说明 | 优先级 |
|----|------|--------|
| 前端 battle.js 药水筛选 | 可加 `(i.hp_restore ?? i.hp)` 兼容极端旧缓存 | 低 |
| Helper.getHpRestore | 前端可加统一方法，与后端对称 | 低 |
| ItemType 枚举 | 可补充 5、6 常量，避免魔法数字 | 低 |
| bag.wearItem equip_attributes 空 | instance 被删但 bag 残留时，当前用全 0 兜底；可改为按 equipment_uid 重取 instance 或拒绝穿戴 | 低 |

---

## 十二、其他系统实现一致性检查

### 12.1 战斗系统

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 伤害公式 | ✅ | `battle/core.ts` 唯一实现，在线/离线均调用 |
| 在线战斗属性 | ✅ | battle/boss 战斗前应用 phy_def_pct、mag_def_pct、max_hp_pct |
| **离线战斗属性** | ❌ | **未应用 phy_def_pct、mag_def_pct、max_hp_pct**，与在线不一致 |
| 自动喝药 | ✅ | 在线用 bagService.useItem；离线用 state.potions（来自 bag.list） |
| 技能来源 | ✅ | 均用 skillService.getEquippedSkills |

### 12.2 商店/拍卖/交易

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 商店购买 | ✅ | 校验商品、物品、货币；getHpRestore/getMpRestore |
| 拍卖上架/购买 | ✅ | 装备用 equipment_uid；非装备用 count |
| **交易 transferItems** | ❌ | **非装备扣减按 item_id 找第一个格**，未按 ti.bag_id；多堆叠时可能扣错格 |

### 12.3 玩家/技能/强化/祝福

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 装备属性应用 | ✅ | EquipEffectUtil 统一 |
| 技能学习/装备 | ✅ | skill 表 + player_skill |
| 强化材料 | ✅ | enhance-config 从 config 表读取 |
| 祝福/强化成功率 | ✅ | 逻辑清晰 |

### 12.4 PVP/等级/多倍卡/VIP

| 检查项 | 状态 | 说明 |
|--------|------|------|
| PVP 战斗 | ✅ | 使用 runBattle，与 PVE 一致 |
| 等级经验 | ✅ | level_exp 表 |
| 多倍卡 | ⚠️ | useBoostCard 用 itemInfo.type===5，未用 getItemType（规范建议统一） |
| VIP | ✅ | isVipActive 统一 |

### 12.5 建议优先修复

1. **离线战斗**：在 simulateOneBattle 前对 state 应用 phy_def_pct、mag_def_pct、max_hp_pct
2. **交易 transferItems**：非装备按 ti.bag_id 查找对应背包格，用 reduceBagItemCount 或按 bag_id 精确扣减
