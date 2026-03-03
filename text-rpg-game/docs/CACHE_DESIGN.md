# Map 内存缓存设计

## 目的

减轻战斗等高读写场景下的数据库压力，保证数据一致性。

## 缓存项

| 数据 | Key | TTL | 失效时机 |
|------|-----|-----|----------|
| 玩家列表 | `uid` | 30s | update、addExp、addGold、addReputation、addHp、addMp |
| 已装备技能 | `uid` | 60s | equipSkill、unequipSkill、learnSkill |
| 怪物配置 | `monsterId` | 5min | monster update、delete |

## 一致性保证

1. **读**：先查缓存，未命中再查库并回填
2. **写**：更新数据库后立即 `invalidate` 对应 key
3. **事务**：`ctx` 存在时不读缓存，保证事务内一致性

## 涉及文件

- `utils/mem-cache.ts` - 通用 TTL 缓存
- `service/cache.service.ts` - 缓存实例与失效入口
- `service/player.service.ts` - 玩家缓存
- `service/skill.service.ts` - 已装备技能缓存
- `service/monster.service.ts` - 怪物缓存
