# API 接口文档

> 基础路径：`/api`。除标注「公开」外，均需在 Header 中携带 `Authorization: Bearer <token>`。

## 通用响应格式

```json
{ "code": 0, "msg": "ok", "data": { ... } }
```

- `code`: 0 成功，非 0 失败
- `msg`: 提示信息
- `data`: 业务数据

---

## 1. 配置

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/config/client | 公开 | 客户端运行时配置（wsUrl、wsPort） |
| GET | /api/config/enhance_materials | 需登录 | 强化材料 item_id 配置 |

---

## 2. 用户

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | /api/user/login | 公开 | 登录 |
| POST | /api/user/register | 公开 | 注册 |

---

## 3. 玩家

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/player/get | 获取当前玩家 |
| GET | /api/player/list | 玩家列表 |
| POST | /api/player/add | 创建角色 |
| POST | /api/player/update | 更新角色 |
| POST | /api/player/delete | 删除角色 |

---

## 4. 背包

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/bag/list | 背包列表 |
| POST | /api/bag/use | 使用物品 |
| POST | /api/bag/update | 更新物品 |
| POST | /api/bag/clear-equipment | 清空装备 |
| POST | /api/bag/delete | 删除物品 |
| POST | /api/bag/wear | 穿戴装备 |

---

## 5. 装备

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/equip/list | 装备列表 |
| POST | /api/equip/wear | 穿戴 |
| POST | /api/equip/remove | 卸下 |
| POST | /api/equip/enhance | 强化 |
| POST | /api/equip/bless | 祝福 |
| POST | /api/equip/trade | 交易 |

---

## 6. 战斗

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/battle/start | 开始战斗 |
| POST | /api/battle/auto | 自动战斗 |
| POST | /api/battle/resume | 恢复战斗 |
| POST | /api/battle/stop | 停止战斗 |
| GET | /api/battle/status | 战斗状态 |

---

## 7. 地图 / 怪物

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/map/list | 公开 | 地图列表 |
| GET | /api/map/get | 公开 | 地图详情 |
| GET | /api/monster/list | 公开 | 怪物列表 |
| GET | /api/monster/get | 公开 | 怪物详情 |
| GET | /api/monster/level | 公开 | 按等级查怪物 |
| GET | /api/monster/map | 公开 | 地图怪物 |

---

## 8. 商店 / 拍卖 / 技能 / 多倍卡

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/shop/list | 商品列表 |
| POST | /api/shop/buy | 购买 |
| GET | /api/shop/currencies | 货币类型 |
| GET | /api/auction/list | 拍卖列表 |
| POST | /api/auction/list | 上架 |
| POST | /api/auction/buy | 购买 |
| GET | /api/auction/records | 记录 |
| POST | /api/auction/off-shelf | 下架 |
| GET | /api/skill/list | 技能列表 |
| POST | /api/skill/learn | 学习 |
| POST | /api/skill/equip | 装备技能 |
| POST | /api/skill/unequip | 卸下技能 |
| GET | /api/skill/equipped | 已装备技能 |
| GET | /api/boost/config | 多倍卡配置 |
| POST | /api/boost/toggle | 开关多倍 |

---

## 9. Boss / PVP / 排行榜

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/boss/list | Boss 列表 |
| GET | /api/boss/get | Boss 详情 |
| POST | /api/boss/challenge | 挑战 |
| POST | /api/boss/stop | 停止 |
| GET | /api/pvp/opponent | 对手 |
| POST | /api/pvp/challenge | 挑战 |
| GET | /api/rank/list | 排行榜 |

---

## 10. 物品

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/item/get | 物品详情 |
| GET | /api/item/list | 物品列表 |
| POST | /api/item/use | 使用 |
| GET | /api/item/usage | 使用记录 |

---

## 11. GM 管理（/api/admin）

需先调用 `/api/admin/auth/login` 获取 admin token，再在 Header 中携带 `Authorization: Bearer <admin_token>`。

- `/api/admin/auth/login` - 管理员登录
- `/api/admin/auth/clear-cache` - 清缓存
- `/api/admin/monster/*` - 怪物 CRUD
- `/api/admin/boss/*` - Boss CRUD
- `/api/admin/map/*` - 地图 CRUD
- `/api/admin/item/*` - 物品 CRUD
- `/api/admin/skill/*` - 技能 CRUD
- `/api/admin/shop/*` - 商店 CRUD
- `/api/admin/player/*` - 玩家管理（发放金币、道具等）
- 等

---

## 环境变量（服务端）

| 变量 | 说明 | 默认 |
|------|------|------|
| PORT | HTTP 端口 | 3000 |
| WS_PORT | WebSocket 端口 | 3001 |
| JWT_SECRET | JWT 密钥 | （开发默认） |
| MONGODB_URI | MongoDB 连接 | mongodb://localhost:27017 |
| MONGODB_DATABASE | 数据库名 | turn-based-game |
| WS_URL | 生产 WS 完整 URL | 空 |

详见 `server/.env.example`。
