# 战斗奖励 - 设计说明

## 展示原则：一种功能只在一处显示

战斗奖励**仅**显示在**战斗日志**中，作为 `battle_reward` 事件的一条记录，不再单独设置右侧面板。

---

## 数据流

| 来源 | 处理 |
|------|------|
| **WebSocket** | 收到 `battle_reward` → 推入 `battleLogs` → `syncLogDOM` 渲染 |
| **API** | battle/start 或 battle/auto 返回 → `applyRewardFromData` → 推入/更新 `battleLogs` → `syncLogDOM` |

---

## 诊断

```js
window.diagnoseBattleReward()
```

检查 `battleLogs` 中是否有 `battle_reward` 事件。
