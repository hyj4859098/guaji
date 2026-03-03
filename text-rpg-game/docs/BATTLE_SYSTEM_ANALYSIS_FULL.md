# 战斗系统完整分析

## 一、延迟问题（导致等待过久）

### 服务端 battle.service.ts 中所有 delay

| 位置 | 延迟 | 说明 |
|------|------|------|
| 行 393 | **800ms** | 自动战斗场间延迟（非首场） |
| 行 475 | **2000ms** | ⚠️ 每场战斗 battle_start 之后，开场固定等 2 秒 |
| 行 623 | **1000ms** | 每回合结束后 |
| 行 640/644/648 | **500ms** | battle_draw / battle_lose / battle_win 之后 |

**单场战斗延迟合计**（假设 2 回合）：
- 开场：2000ms
- 回合1：1000ms
- 回合2：1000ms
- 结束：500ms
- **≈ 4.5 秒** 纯等待

**自动战斗 10 场**：约 45 秒纯延迟 + 实际战斗时间。

### WebSocket ws-manager.ts

- `setTimeout(process, 100)`：消息队列重试间隔，仅用于连接未就绪时，**与战斗无关**
- `setInterval`：30 秒心跳，**与战斗无关**

**结论**：WebSocket 本身没有战斗相关延迟，主要延迟在 battle.service 的 delay 调用。

---

## 二、奖励不显示的可能原因

1. **battle_reward 推送时机**：在 `processSettlement` 中推送，理论上每场结束都会推送。
2. **前端清空逻辑**：收到 `battle_start` 时清空上一场日志。若 `battle_start` 在 `battle_reward` 之后很快到达，奖励可能刚显示就被清掉。
3. **API 阻塞**：`startBattle` 会 await 所有战斗完成才返回，自动战斗时 HTTP 一直阻塞，但 WebSocket 事件应正常推送。

---

## 三、状态机结构问题

### 3.1 多套逻辑、重复注册

```
状态机 handler 注册（battle.service.ts）:
├── IDLE + START_BATTLE        → handleBattleStart
├── BATTLE + STOP_BATTLE       → handleBattleStop
├── BATTLE + BATTLE_COMPLETE   → handleBattleComplete
├── SETTLEMENT + STOP_BATTLE   → handleBattleStop
├── SETTLEMENT + SETTLEMENT_COMPLETE → handleSettlementComplete
├── SETTLEMENT + CONTINUE_AUTO_BATTLE → handleContinueAutoBattle  ← 从未被触发！
├── AUTO_BATTLE + START_BATTLE → handleBattleStart
├── AUTO_BATTLE + STOP_BATTLE  → handleBattleStop
├── AUTO_BATTLE + BATTLE_COMPLETE → handleBattleComplete
├── AUTO_BATTLE + SETTLEMENT_COMPLETE → handleSettlementComplete
└── END + RESET                → handleReset
```

**问题**：
- `handleContinueAutoBattle` 注册在 `SETTLEMENT + CONTINUE_AUTO_BATTLE`，但 `CONTINUE_AUTO_BATTLE` 只在 `startBattle` 时从 `IDLE` 发出，**永远不会在 SETTLEMENT 时触发**，属于死代码。
- `BATTLE` 与 `AUTO_BATTLE` 的 handler 几乎完全相同，存在重复。

### 3.2 自动战斗实际流程

```
startBattle(isAuto=true)
  → transition(CONTINUE_AUTO_BATTLE)   [IDLE → AUTO_BATTLE，无 handler]
  → transition(START_BATTLE)           [AUTO_BATTLE → BATTLE，handleBattleStart]
  → handleBattleStart → executeBattle  [第 1 场]
  → transition(BATTLE_COMPLETE)        [BATTLE → SETTLEMENT]
  → handleBattleComplete → processSettlement → push battle_reward
  → transition(SETTLEMENT_COMPLETE)    [SETTLEMENT → BATTLE]
  → handleSettlementComplete
      → 直接调用 executeBattle（不经过 transition）[第 2 场]
      → transition(BATTLE_COMPLETE)
      → ... 循环直到 currentRound >= maxRounds
```

**问题**：第 2 场及之后的战斗是 `handleSettlementComplete` 直接调用 `executeBattle`，不再经过 `START_BATTLE`，状态在 `BATTLE` 与 `SETTLEMENT` 之间反复横跳，逻辑不直观。

### 3.3 currentRound 可能错误

`handleSettlementComplete` 中 `setStateData({ ...data, result })` 会覆盖 `executeBattle` 内部对 `stateData.currentRound` 的修改，可能导致 `currentRound` 未正确递增，影响 `maxRounds` 判断。

---

## 四、简化建议

### 4.1 立即可做（修复延迟 + 奖励）

1. **去掉或大幅缩短 battle_start 后的 2000ms 延迟**（行 475）  
   - 建议：0ms 或 100ms，仅作兼容保留。

2. **缩短回合间 1000ms**（行 623）  
   - 建议：300ms，保证可读性即可。

3. **缩短战斗结束 500ms**（行 640/644/648）  
   - 建议：100ms。

4. **缩短场间 800ms**（行 393）  
   - 建议：300ms，保证奖励可见即可。

5. **前端**：在清空日志前，确保 `battle_reward` 已渲染，可加极短延迟（如 100ms）再清空，或改为在收到 `battle_reward` 后延迟清空。

### 4.2 中期重构（简化状态机）

1. **合并 BATTLE 与 AUTO_BATTLE**  
   - 用 `stateData.isAuto` 区分，减少重复 handler。

2. **删除 handleContinueAutoBattle**  
   - 未被使用，可直接移除。

3. **统一自动战斗循环**  
   - 用单一 `runAutoBattleLoop(uid, enemyId, maxRounds)` 替代「状态机 + 直接调用 executeBattle」的混合方式，逻辑更清晰。

4. **修复 currentRound**  
   - 在 `handleSettlementComplete` 中使用 `stateMachine.getStateData()` 获取最新 `currentRound`，再与 `result` 合并后 `setStateData`。

### 4.3 长期（可选）

- 将「展示节奏」交给前端控制：服务端只推送事件，不负责 delay；前端用动画或定时器控制展示节奏。
