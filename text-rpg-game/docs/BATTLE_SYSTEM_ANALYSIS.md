# 战斗系统分析与改进方案

## 一、当前架构概览

### 1.1 后端结构（battle.service.ts ~1160 行）

| 模块 | 行数 | 职责 | 问题 |
|------|------|------|------|
| 状态机 + Handler | ~140 | IDLE/BATTLE/SETTLEMENT/END 流转 | 与分步战斗完全独立，两套逻辑 |
| 分步战斗 (stepBattleStates) | ~350 | nextStep 手动回合 | 与 executeSingleBattle 重复实现战斗公式 |
| 实时/自动战斗 (executeBattle) | ~400 | WebSocket 推送、自动喝药 | 与分步战斗公式不一致风险 |
| 掉落/结算/工具 | ~200 | processDrop、processSettlement | 相对清晰 |

### 1.2 前端结构（battle.js ~1140 行）

| 模块 | 职责 | 问题 |
|------|------|------|
| 样式 + 模板 | 大量 inline HTML | 难以维护 |
| 自动喝药 UI + localStorage | 阈值、药水选择 | 与背包/RefreshBus 耦合 |
| handleBattleEvent | 事件处理、日志、血条 | 承担过多职责 |
| 战斗按钮/状态 | 开始/停止/禁用 | 与 RefreshBus 全量 render 冲突 |

---

## 二、主要问题分析

### 2.1 逻辑分散与重复

1. **两套战斗流程**
   - `stepBattleStates` + `nextStep`：分步战斗，HTTP 轮询
   - `battleStateMachines` + `executeSingleBattle`：实时/自动战斗，WebSocket
   - 伤害计算、命中判定在两处各自实现，易产生不一致

2. **死代码**
   - `handleContinueAutoBattle`：当前流程中未被调用（CONTINUE_AUTO_BATTLE 仅用于 IDLE→AUTO_BATTLE 初始转换，无对应 handler）

3. **状态机冗余**
   - BATTLE 与 AUTO_BATTLE 的 handler 几乎相同，可合并

### 2.2 前后端耦合复杂

1. **RefreshBus 与战斗页**
   - battle_reward → API.get → RefreshBus.emit(player/bag/equip)
   - 原逻辑：player 触发 `render()`，重建整页，按钮被重置为可用
   - 已修复：改为 `updatePlayerInfo()` 局部更新

2. **日志与清空策略**
   - 需求矛盾：既要「每场战斗清晰可见」，又要「不丢失历史」
   - 当前方案：每场 battle_start 清空，只显示当前场

### 2.3 维护成本高

- 单文件 1000+ 行，职责混杂
- 新增功能（如新技能、新 buff）需改多处
- 状态机 + 分步 + 实时 三套概念叠加，新人理解成本高

---

## 三、改进方案建议

### 方案 A：渐进式重构（推荐，风险低）

**目标**：在不推翻现有逻辑的前提下，提升可维护性。

1. **抽取战斗核心为独立模块**
   ```
   server/src/battle/
   ├── core.ts          # 伤害计算、命中判定、回合公式（纯函数）
   ├── battle.service.ts  # 编排层，调用 core
   └── step-battle.service.ts  # 分步战斗，复用 core
   ```

2. **统一伤害计算**
   - 将 `calculateHit`、伤害公式抽到 `core.ts`
   - `nextStep` 和 `executeSingleBattle` 都调用同一套公式

3. **前端拆分**
   ```
   client/js/pages/battle/
   ├── battle-page.js     # 主页面、路由
   ├── battle-log.js      # 日志组件
   ├── battle-buttons.js  # 按钮、状态
   └── auto-heal.js       # 自动喝药 UI
   ```

4. **移除死代码**
   - 删除或标注 `handleContinueAutoBattle`（若确认无用）

**预计工作量**：2–3 天

---

### 方案 B：统一战斗引擎（中等改动）

**目标**：只保留一套战斗执行逻辑。

1. **单一战斗执行器**
   - 保留 `executeSingleBattle` 作为唯一战斗执行入口
   - 分步战斗改为：每次 `nextStep` 调用「执行一步」的接口，由服务端推进一回合并返回结果
   - 或：分步战斗前端改为 WebSocket，与自动战斗共用同一推送通道

2. **状态机简化**
   - 合并 BATTLE / AUTO_BATTLE
   - 用 `isAuto` 区分行为，减少重复 handler

3. **事件驱动**
   - 战斗事件统一通过 `pushBattleEvent` 推送
   - 前端只订阅一种 battle 流，减少分支

**预计工作量**：5–7 天

---

### 方案 C：事件溯源 + 简化状态（较大改动）

**目标**：战斗过程可回放、可审计，状态更清晰。

1. **战斗事件流**
   - 每场战斗生成事件序列：round_start, player_attack, monster_attack, ...
   - 前端按事件流渲染，后端只负责生成事件、结算

2. **无状态战斗**
   - 服务端不维护「当前回合」等长连接状态
   - 每次请求携带完整上下文（或 session 存少量元数据）

3. **离线战斗**
   - 自动战斗可改为「提交任务 → 后台计算 → 推送结果」
   - 减少长连接占用

**预计工作量**：2–3 周

---

## 四、已完成的修复（本次）

| 问题 | 处理 |
|------|------|
| 日志不清空，难以查看每场 | 每场 battle_start 清空日志，只显示当前场 |
| 第一场结束后按钮被启用 | RefreshBus 触发时用 updatePlayerInfo 替代 render，避免重建按钮 |
| 战斗间无间隔 | handleSettlementComplete 中增加 1.5s 延迟 |

---

## 五、后续可选优化

1. **日志「只看当前场」开关**
   - 增加「累计模式 / 单场模式」切换，满足不同习惯

2. **战斗摘要**
   - 每场结束后显示简短摘要（伤害、回合数、掉落），再清空进入下一场

3. **分步战斗是否保留**
   - 若使用率低，可考虑下线或改为「慢速自动战斗」

4. **TypeScript 类型**
   - 为 BattleStateData、事件 payload 补充完整类型，减少隐式 any

---

## 六、总结

当前战斗系统能正常工作，但存在**逻辑分散、重复实现、单文件过大**等问题。建议优先采用**方案 A**，先抽取核心公式、拆分前端模块，再视需求考虑方案 B 或 C。
