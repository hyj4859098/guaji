# 战斗事件流 - 单一数据流说明

## 设计原则

1. **唯一推送入口**：服务端仅通过 `pushBattleEvent` / `pushBattleEventsBatch` 推送，无其他分支
2. **唯一接收入口**：客户端仅通过 `main.js` 的 `WS.on('battle')` 接收，battle.js 不再注册
3. **回合原子性**：每回合所有事件（含 auto_heal）收集后批量推送，避免分裂/先后顺序
4. **防重机制**：服务端 `_seq` 单调递增，客户端跳过 `_seq <= _lastSeenSeq` 的重复事件

## 服务端推送路径

```
executeSingleBattle
├── pushBattleEvent('battle_start')
├── [每回合]
│   ├── auto_heal（如有）→ addEvent（并入 batch）
│   ├── round_start → addEvent
│   ├── 技能/普攻/魔攻/怪物 → addEvent
│   └── pushBattleEventsBatch(roundEvents)  ← 唯一回合推送
├── pushBattleEvent('battle_win'|'battle_lose'|'battle_draw')
└── processSettlement → pushBattleEvent('battle_reward')
handleSettlementComplete → pushBattleEvent('battle_end')
```

## 客户端接收路径

```
WS.on('battle', data)
├── data.batch && data.events → handleBattleEventBatch(events)
│   └── for each: _handleSingleEvent(ev) → battleLogs.push → syncLogDOM 一次
└── else → handleBattleEvent(data)
    └── _handleSingleEvent(data) → syncLogDOM
```

## 数据源

- **battleLogs**：唯一日志数据源，仅由 `_handleSingleEvent` 写入
- **getDisplayLogs()**：从最后一次 `battle_start` 起截取，新战斗开始时才“清除”上一场
- **syncLogDOM()**：唯一渲染入口，将 getDisplayLogs() 转为 DOM
