# 刷新机制分析

## 一、整体架构

```
数据变更来源：
├── WebSocket 推送（服务端主动）
│   └── main.js: WS.on('player'/'bag'/'equip') → RefreshBus.emit(type, data)
└── API 响应后前端主动刷新
    └── 各页面在 API 成功后 → RefreshBus.emit(type, data) 或 this.load()
```

**RefreshBus 订阅者**（main.js setupRefreshBus）：
- `player`: 更新 role、equip、battle、顶部栏
- `bag`: 更新 bag、battle 药水、enhance
- `equip`: 更新 equip 页

---

## 二、各场景重复刷新情况

### 1. 使用药品（useItem）

| 来源 | 动作 | 结果 |
|------|------|------|
| **服务端** bag.service.useItem | sendToUser player + bag | WS 推送 2 次 |
| **前端** BagPage.useItem / BagComponent.useItem | this.load() + API.get player + RefreshBus.emit('player') | 本地刷新 2 次 |

**实际流程**：
1. API.post('/bag/use') 成功
2. 服务端 useItem 执行 → sendToUser(player) + sendToUser(bag)
3. 前端 this.load() → API.get bag → 直接 render（第 1 次 bag 刷新）
4. 前端 API.get player → RefreshBus.emit('player')（第 1 次 player 刷新）
5. WS 收到 player → RefreshBus.emit('player')（第 2 次 player 刷新）
6. WS 收到 bag → RefreshBus.emit('bag') → handler 更新 bag + battle + enhance（第 2 次 bag 刷新）

**结论**：player 刷新 2 次，bag 刷新 2 次（含一次直接 load 渲染）。

---

### 2. 丢弃物品（dropItem）

| 来源 | 动作 | 结果 |
|------|------|------|
| **服务端** bag.service.delete | 无 WS 推送 | - |
| **前端** | 不同实现 | - |

**BagPage.dropItem**（bag.js）：
- API.get bag → RefreshBus.emit('bag') → 单次刷新 ✓

**BagComponent.dropItem**（bag-component.js）：
- this.load() → API.get bag → 直接更新 allItems + renderBag（第 1 次）
- RefreshBus.emit('bag', this.allItems) → handler 再更新 Pages.bag + render（第 2 次）

**结论**：BagComponent 场景下 bag 刷新 2 次。

---

### 3. 穿戴装备（wearItem）

**BagPage.wearItem**（/bag/wear）：
- 服务端 bag.service.wearItem：无 WS 推送
- 前端：3 个 API.get + 3 个 RefreshBus.emit → 单次刷新 ✓

**equip.js wearItem**（/equip/wear）：
- 服务端 equip.service.wearEquip：无 WS 推送
- 前端：3 个 API.get + 3 个 RefreshBus.emit → 单次刷新 ✓

---

### 4. 装备强化（enhance）

| 来源 | 动作 | 结果 |
|------|------|------|
| **服务端** equip_upgrade.service | sendToUser bag | WS 推送 1 次 |
| **前端** enhance.doEnhance | this.load() | 本地刷新 1 次 |

**实际流程**：
1. API.post('/equip/enhance') 成功
2. 前端 this.load() → API.get bag → render（第 1 次）
3. 服务端 sendToUser bag
4. WS 收到 bag → RefreshBus.emit('bag') → handler 中 `if (State.currentPage === 'enhance') Pages.enhance.load()`（第 2 次）

**结论**：enhance 页加载 2 次。

---

### 5. 战斗结算（battle settle）

- 服务端 battle.service.settle：sendToUser player + bag
- 前端：仅通过 WS 接收，无 API 重复刷新 ✓

---

## 三、问题汇总

| 场景 | 重复刷新 | 原因 |
|------|----------|------|
| 使用药品 | player×2, bag×2 | 服务端 WS + 前端 API+emit 双通道 |
| 丢弃物品（BagComponent） | bag×2 | this.load() + RefreshBus.emit 双写 |
| 装备强化 | enhance×2 | this.load() + WS→RefreshBus→enhance.load() |
| 穿戴装备 | 无 | 服务端无 WS，仅前端刷新 |
| 战斗结算 | 无 | 仅 WS，无前端重复 |

---

## 四、简化建议

### 原则：**以服务端推送为主，前端不再在 API 成功后主动 emit**

### 1. 使用药品（useItem）

**服务端**：已推送 player + bag，无需改。

**前端**（BagPage + BagComponent）：
- 移除：`this.load()`、`API.get('/player/list')`、`RefreshBus.emit('player')`
- 保留：`API.post`、Toast
- 依赖：WS 推送 → RefreshBus → 各页面更新

若 WS 未连接或延迟，可考虑在 WS 连接失败时做一次兜底 API 拉取（可选）。

### 2. 丢弃物品（dropItem）

**BagComponent**：
- 移除：`this.load()`
- 改为：`const bags = await API.get('/bag/list'); RefreshBus.emit('bag', bags.data)`（与 BagPage 一致）
- 或：服务端 bag.service.delete 增加 WS 推送 bag，前端只发 API，不主动刷新

**BagPage**：已合理，可保持不变。

### 3. 装备强化（enhance）

**方案 A**：移除前端 `this.load()`，完全依赖 WS bag 推送。
- 风险：若 equip_upgrade 未推送 bag，enhance 不刷新（需确认服务端是否必推）

**方案 B**：RefreshBus 的 bag handler 中，对 enhance 页不做 `load()`，由 enhance 自己的 `this.load()` 负责。
- 即：`if (State.currentPage === 'enhance')` 分支移除，enhance 仅通过自己的 doEnhance 后 load 刷新。

### 4. 穿戴装备（wear/remove）

当前无 WS，仅前端刷新，逻辑清晰。若希望统一为「服务端推送」，可在 equip.service / bag.service 的 wear/remove 成功后增加 sendToUser(player, equip, bag)，前端移除 API 拉取 + emit。

---

## 五、已实施简化（2025-03）

1. **useItem**（BagPage + BagComponent）：已移除 load + API+emit，仅依赖服务端 WS 推送
2. **BagComponent.dropItem**：已改为 fetch + 本地更新 + emit，去掉 load
3. **enhance**：已移除 doEnhance 后的 this.load()，依赖 WS bag → RefreshBus → enhance.load()
4. **main.js bag handler**：已增加 BagComponent 同步，bag 变更时自动更新嵌入的背包组件

---

## 六、服务端 WS 推送一览

| 服务 | 方法 | 推送类型 |
|------|------|----------|
| bag.service | useItem | player, bag |
| bag.service | delete | 无 |
| bag.service | wearItem | 无 |
| equip.service | wearEquip / removeEquip | 无 |
| equip_upgrade.service | enhance | bag |
| battle.service | settle | player, bag |
