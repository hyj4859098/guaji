# 脚本说明

## 完整测试体系（发布前必跑）

所有测试使用**独立测试库** `turn-based-game-test`，不污染正式库。

| 命令 | 说明 | 前置条件 |
|------|------|----------|
| `cd server && npm run test` | 单元测试（Jest） | 无 |
| `cd server && npm run test:verify-db` | 验证 init-mongodb 结果 | MongoDB 已启动，且已对测试库执行 init-mongodb |
| `cd server && npm run test:api` | GM + 玩家 API 集成测试 | MongoDB + 服务器已启动（可用 `npm run dev:test` 连接测试库） |
| `cd server && npm run test:ws` | WebSocket 连接与消息测试 | MongoDB + 服务器已启动 |
| `cd server && npm run test:full` | **全量测试**（单元+init+验证+db层+API+WS） | 仅需 MongoDB 已启动，会自动初始化测试库并启动服务器 |

**一键全量测试**（自动初始化测试库、启动测试服务器）：
```bash
cd text-rpg-game/server
npm run test:full
```

**仅跑不依赖服务器的测试**：
```bash
node scripts/test-all.js --skip-api
```

详细测试规范见 `docs/测试规范.md`。

---

## 代码质量检测

### check-data-channel.js

检测数据通道混用（规范：同一份数据只能使用 API 或 WebSocket 一种通道）。

**用法**（在 `server` 目录下）：
```bash
npm run lint:channel
```

**检测内容**：API 端点与 WebSocket 订阅的重叠、可能的 API 轮询。

---

## 测试脚本

### test-gm-apis.js

测试 GM 工具相关 API 是否正常。

**前置条件**：MongoDB 和服务器已启动。

**用法**：
```bash
# 使用默认管理员 admin / admin123（需先运行 create-test-admin.js 创建）
node scripts/test-gm-apis.js

# 指定管理员
ADMIN_USER=你的用户名 ADMIN_PASS=你的密码 node scripts/test-gm-apis.js
```

**测试项**：登录、物品列表(全量/分页/分类)、物品详情、装备基础、道具效果、技能、掉落、装备一站式创建、物品增删改。

### test-player-apis.js

测试玩家端 API 是否正常。

**前置条件**：MongoDB 和服务器已启动。

**用法**：
```bash
node scripts/test-player-apis.js
```

**测试项**：注册、创建角色、背包、装备、技能、地图、怪物、商店、配置、玩家、多倍卡、等级经验、排行榜、战斗、拍卖行。

### verify-init-mongodb.js

验证 init-mongodb 初始化结果（集合、配置、功能性道具）。默认使用测试库 `turn-based-game-test`。

**前置条件**：MongoDB 已启动，且已对目标库执行过 `MONGODB_DATABASE=xxx node server/init-mongodb.js`。

**用法**：
```bash
node scripts/verify-init-mongodb.js
# 或指定库：MONGODB_DATABASE=turn-based-game node scripts/verify-init-mongodb.js
```

---

## GM 相关脚本

### create-test-admin.js

创建测试用管理员 `admin` / `admin123`，用于 API 测试。

```bash
node scripts/create-test-admin.js
```

### check-admin.js

检查数据库中是否存在管理员用户。

```bash
node scripts/check-admin.js
```
