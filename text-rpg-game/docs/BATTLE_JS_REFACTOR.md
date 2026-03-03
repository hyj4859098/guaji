# battle.js 行数分析与拆分方案

## 一、行数分布（总计 ~1162 行）

| 模块 | 行数 | 占比 | 问题 |
|------|------|------|------|
| **内联 CSS** | ~350 | 30% | 样式不应写在 JS 里 |
| **render() 内联 HTML** | ~260 | 22% | 整页 HTML 塞在一个字符串里 |
| **自动喝药** | ~100 | 9% | 可独立成模块 |
| **背包药品** | ~80 | 7% | 与自动喝药耦合，可合并 |
| **战斗日志** | ~90 | 8% | 可独立成模块 |
| **其他逻辑** | ~280 | 24% | 按钮、API、事件处理 |

---

## 二、重复/冗余代码

### 1. 玩家/怪物属性块（重复 2 次，各 ~30 行）

```html
<!-- 玩家 -->
<div class="stats-list">
  <div class="stat-item"><span>物理攻击</span><span>${this.player?.phy_atk}</span></div>
  ... 7 个属性
</div>

<!-- 怪物 -->
<div class="stats-list">
  <div class="stat-item"><span>物理攻击</span><span>${this.enemy?.phy_atk}</span></div>
  ... 9 个属性
</div>
```

**可统一为**：`renderStatsList(attrs)` 一个函数生成。

### 2. HP/MP 血条块（重复 4 次）

玩家 HP、玩家 MP、怪物 HP、怪物 MP 结构完全相同，只是 id 和颜色不同。

**可统一为**：`renderStatusBar(id, label, value, max, type)`。

### 3. 角色卡片（玩家/怪物各 1 次）

头像 + 名字 + 等级，结构相同。

**可统一为**：`renderCharacterCard(data, defaultName)`。

### 4. 药水选择框（HP/MP 各 1 次，逻辑几乎一样）

`updateBagPotions` 里 hpSelect 和 mpSelect 的处理逻辑重复。

---

## 三、拆分方案

### 目标结构

```
client/
├── css/
│   └── battle.css          # 从 battle.js 抽出的样式 (~350 行)
├── js/
│   ├── pages/
│   │   └── battle.js       # 主页面，只负责编排 (~250 行)
│   └── battle/
│       ├── battle-templates.js   # HTML 模板函数
│       ├── battle-log.js        # 日志渲染
│       ├── auto-heal.js         # 自动喝药 UI + localStorage
│       └── battle-api.js         # API 调用封装
```

### 拆分后职责

| 文件 | 职责 | 预估行数 |
|------|------|----------|
| battle.css | 样式 | ~350 |
| battle.js | 页面编排、load、render 入口、事件分发 | ~250 |
| battle-templates.js | renderStatsList、renderStatusBar、renderCharacterCard | ~80 |
| battle-log.js | buildLogItemHTML、getBattleLogHTML | ~90 |
| auto-heal.js | 自动喝药配置、药水选择、localStorage | ~120 |
| battle-api.js | startBattle、startAutoBattle、stopBattle | ~50 |

**battle.js 从 1162 行 → ~250 行**，其余按职责拆分。

---

## 四、实施步骤

1. **抽出 CSS**：新建 `battle.css`，在 HTML 中引入
2. **抽出模板函数**：`renderStatsList`、`renderStatusBar`、`renderCharacterCard`
3. **抽出 battle-log**：日志相关逻辑
4. **抽出 auto-heal**：自动喝药 + 背包药品
5. **精简 battle.js**：只保留编排、load、事件分发

---

## 五、原则

- **前端只负责**：展示、交互、调用 API、接收 WebSocket
- **不负责**：伤害计算、战斗逻辑、掉落判定
- **单一职责**：每个文件只做一类事
- **无重复**：相同结构用函数生成，不复制粘贴
