# 装备强化系统设计方案

## 一、系统定位与扩展性

### 1.1 命名与架构

建议将模块命名为 **装备提升系统**（Equipment Upgrade System），而非仅「强化」，便于后续扩展附魔、祝福等：

```
server/src/service/equip_upgrade.service.ts   # 装备提升服务（强化/附魔/祝福统一入口）
server/src/api/equip_upgrade.ts               # 或扩展现有 equip.ts
```

- **强化（Enhance）**：当前实现，提升 enhance_level
- **附魔（Enchant）**：预留，可扩展 equip_instance 表字段 `enchant_data`
- **祝福（Bless）**：预留，可扩展 `bless_level` 等

### 1.2 数据模型扩展建议

`equip_instance` 表已有 `enhance_level`，后续可增加：

- `enchant_data`（JSON）：附魔属性
- `bless_level`：祝福等级

---

## 二、材料与消耗规则

### 2.1 材料 ID 常量

| 材料       | item_id | 用途                         |
|------------|---------|------------------------------|
| 强化石     | 6       | 强化必需，数量按公式计算     |
| 装备防爆符 | 7       | 失败时避免装备损坏，每次用 1 |
| 装备幸运符 | 8       | 提升成功率 20%，每次用 1     |

### 2.2 强化等级上限

- **最大强化等级**：20 级
- 达到 20 级后不可继续强化

### 2.3 主属性提升规则

- 强化**仅提升主属性**（main_value / main_value_2）
- 按**百分比**提升，每级 +15%，20 级共 +300%

| 强化等级 | 主属性倍率 | 提升幅度 |
|----------|------------|----------|
| 0        | 100%       | 0%       |
| 1        | 115%       | +15%     |
| 5        | 175%       | +75%     |
| 10       | 250%       | +150%    |
| 20       | 400%       | +300%    |

公式：`主属性倍率 = 1 + enhance_level × 0.15`

### 2.4 强化石消耗公式

```
消耗数量 = 目标强化等级² × 100
```

| 当前等级 | 目标等级 | 消耗强化石 |
|----------|----------|------------|
| 0        | 1        | 1×1×100 = 100 |
| 1        | 2        | 2×2×100 = 400 |
| 2        | 3        | 3×3×100 = 900 |
| 19       | 20       | 20×20×100 = 40000 |

### 2.5 成功率

- 基础：`100% - (目标等级 - 1) × 10%`，最低 20%
- 装备幸运符：+20%

示例：

| 目标等级 | 基础成功率 | 用幸运符后 |
|----------|------------|------------|
| 1        | 100%       | 100%       |
| 2        | 90%        | 100%       |
| 3        | 80%        | 100%       |
| 5        | 60%        | 80%        |
| 9        | 20%        | 40%        |

### 2.6 失败惩罚

- 失败时：30% 概率装备损坏（装备实例及背包/装备栏记录删除）
- 装备防爆符：失败时装备不损坏

### 2.7 材料消耗

- 强化石：按公式消耗，成功/失败都扣
- 装备幸运符：勾选则每次消耗 1，成功/失败都扣
- 装备防爆符：勾选则每次消耗 1，成功/失败都扣

---

## 三、服务端实现

### 3.1 装备提升服务

**文件**：`server/src/service/equip_upgrade.service.ts`

```typescript
// 核心逻辑
async enhance(uid, instanceId, options: {
  useLuckyCharm: boolean;   // 是否使用幸运符
  useAntiExplode: boolean;  // 是否使用防爆符
}): Promise<{ success, broken, enhance_level?, message? }>
```

流程：

1. 校验装备归属、实例存在
2. 获取当前 enhance_level，若已达 20 级则拒绝；计算目标等级
3. 按公式计算强化石消耗，校验背包数量
4. 若勾选幸运符/防爆符，校验数量并各扣 1
5. 扣强化石
6. 随机判定成功/失败
7. 失败则 30% 判定损坏（有防爆符则不计）
8. 成功则更新 enhance_level，失败且损坏则调用 destroyOnEnhanceFail

### 3.2 材料校验

- 从背包读取 item_id 为 6、7、8 的数量
- 按勾选情况校验：强化石必够，幸运符/防爆符勾选则各需 ≥1

### 3.3 API 设计

**POST /api/equip/enhance**（扩展现有）

```json
{
  "instance_id": 123,           // 装备实例 ID（equipment_uid）
  "use_lucky_charm": true,      // 是否使用幸运符
  "use_anti_explode": true      // 是否使用防爆符
}
```

返回：`{ success, broken, enhance_level, message }`

---

## 四、前端实现

### 4.1 布局与背包

- 上：装备栏（约 70%）
- 下：材料栏（约 30%）

### 4.2 装备栏

- 数据来源：`API.get('/bag/list')`，筛选 `type === 2` 且 `equipment_uid` 存在
- 展示：背包内装备列表，含名称、强化等级、主属性
- 交互：选中装备，点击「强化」按钮

### 4.3 材料栏

- 数据来源：`API.get('/bag/list')`，筛选 `item_id in [6, 7, 8]`
- 展示：强化石、装备防爆符、装备幸运符，及各自数量
- 交互：勾选是否使用幸运符、防爆符

### 4.4 背包组件复用

- `BagComponent` 位于 `client/js/core/bag-component.js`
- 支持 `initBag(bagId, containerId, options = {})`
- `options.typeFilter`：按类型过滤
- `options.mode`：`full` / `select` / `preview`

建议：新建强化页，不直接复用 BagComponent，而是：

1. 调用 `API.get('/bag/list')` 获取背包
2. 按 type 和 item_id 筛选装备与材料
3. 自定义布局和勾选逻辑

### 4.5 页面结构

```
client/js/pages/enhance.js   # 强化页
```

- **导航**：在顶部导航栏增加「强化」按钮，点击进入强化页面
- 上区：装备网格（含强化按钮）
- 下区：材料列表（勾选框 + 数量）

---

## 五、实现步骤建议

1. **服务端**
   - 新建 `equip_upgrade.service.ts`，实现 `enhance` 逻辑
   - 修改 `equip.ts` 的 `/enhance` 接口，使用新服务并传入材料选项
   - 材料消耗通过 `bag.service` 扣减

2. **前端**
   - 新建 `enhance.js` 页面
   - 在 `main.js` 中注册路由和导航
   - 实现装备栏、材料栏、强化按钮和勾选逻辑

3. **测试**
   - 校验材料不足、装备不存在等错误
   - 校验成功/失败、损坏/不损坏逻辑

---

## 六、数据流示意

```
用户选择装备 + 勾选材料
    → 点击强化
    → POST /api/equip/enhance
    → equip_upgrade.service.enhance()
        → 校验材料 → 扣材料 → 判定成功/失败
        → 成功：更新 enhance_level
        → 失败：30% 损坏（有防爆符则否）
    → 返回结果
    → 刷新背包 / 装备 / 玩家
```

---

## 七、附录：物品类型与背包结构

- 背包：`/api/bag/list` 返回 `{ item_id, count, equipment_uid, ... }`
- 装备：`type === 2`，有 `equipment_uid` 表示装备实例
- 材料：`item_id in [6,7,8]`，按 type 区分（通常为材料类）
