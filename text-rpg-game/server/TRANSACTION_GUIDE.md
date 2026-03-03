# 事务系统使用指南

## 概述

事务系统是一个用于确保数据库操作原子性的工具，它可以保证一组相关的数据库操作要么全部成功，要么全部失败，避免数据不一致的情况。

## 核心功能

- **事务管理**：提供事务的开启、提交和回滚功能
- **事务上下文**：在事务中共享数据库连接
- **错误处理**：自动处理事务中的错误并回滚
- **TypeScript支持**：提供完整的类型定义

## 基本使用

### 导入事务工具

```typescript
import { transaction, TransactionContext } from './utils/transaction';
```

### 基本用法

```typescript
import { transaction, TransactionContext } from './utils/transaction';

async function example() {
  try {
    const result = await transaction(async (ctx: TransactionContext) => {
      // 在事务中执行数据库操作
      await ctx.execute('INSERT INTO table (name) VALUES (?)', ['test']);
      await ctx.execute('UPDATE table SET name = ? WHERE id = ?', ['updated', 1]);
      
      // 可以返回结果
      return 'success';
    });
    
    console.log('事务执行成功:', result);
  } catch (error) {
    console.error('事务执行失败:', error);
  }
}
```

## 高级用法

### 调用其他服务的事务方法

当在事务中调用其他服务的方法时，需要将事务上下文传递给这些方法：

```typescript
async function complexOperation(uid: number) {
  await transaction(async (ctx: TransactionContext) => {
    // 调用玩家服务的方法，传递事务上下文
    await playerService.addExp(uid, 100, ctx);
    await playerService.addGold(uid, 50, ctx);
    
    // 执行其他数据库操作
    await ctx.execute('INSERT INTO logs (uid, action) VALUES (?, ?)', [uid, 'reward']);
  });
}
```

### 服务方法的事务支持

在服务方法中，应该添加对事务上下文的支持：

```typescript
async addExp(uid: number, exp: number, ctx?: TransactionContext): Promise<boolean> {
  const players = await this.list(uid, ctx);
  if (players.length === 0) return false;
  
  const player = players[0];
  const newExp = player.exp + exp;
  
  return await this.update(player.id, {
    exp: newExp
  }, ctx);
}
```

## 最佳实践

1. **使用事务的场景**：
   - 涉及多个数据库操作的业务逻辑
   - 跨服务的操作
   - 重要的业务流程（如装备穿戴、战斗结算等）

2. **事务粒度**：
   - 事务应该尽可能小，只包含相关的操作
   - 避免在事务中执行耗时操作

3. **错误处理**：
   - 在事务回调中抛出错误会自动触发回滚
   - 捕获事务外的错误以处理业务逻辑错误

4. **性能考虑**：
   - 事务会锁定数据库资源，应避免长时间运行的事务
   - 对于频繁执行的操作，考虑使用批量处理

## 示例代码

### 装备穿戴示例

```typescript
async wearEquip(uid: number, equipId: number): Promise<boolean> {
  try {
    await transaction(async (ctx: TransactionContext) => {
      const equip = await this.model.get(equipId);
      if (!equip || equip.uid !== uid) throw new Error('装备不存在或不属于该用户');
      
      // 检查并处理已有装备
      const existing = await ctx.query('SELECT * FROM user_equip WHERE uid = ? AND pos = ?', [uid, equip.pos]);
      if (existing.length > 0) {
        const existingEquip = await this.model.getByEquipmentUid(existing[0].equipment_uid);
        if (existingEquip) {
          await EquipEffectUtil.removeEquipEffect(uid, existingEquip, ctx);
        }
        await ctx.execute('DELETE FROM user_equip WHERE id = ?', [existing[0].id]);
      }
      
      // 穿戴新装备
      await ctx.execute(
        'INSERT INTO user_equip (uid, equipment_uid, pos, create_time, update_time) VALUES (?, ?, ?, ?, ?)',
        [uid, equip.equipment_uid, equip.pos, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
      );
      
      // 应用装备效果
      await EquipEffectUtil.applyEquipEffect(uid, equip, ctx);
    });
    return true;
  } catch (error) {
    console.error('穿戴装备失败:', error);
    return false;
  }
}
```

### 战斗结算示例

```typescript
async processSettlement(uid: number, data: BattleStateData): Promise<void> {
  const result = data.result;
  if (!result) return;

  try {
    await transaction(async (ctx: TransactionContext) => {
      // 记录战斗结果
      const reward = JSON.stringify({
        exp: result.exp,
        gold: result.gold,
        reputation: result.reputation,
        items: result.items
      });

      await ctx.execute(
        'INSERT INTO battle (uid, enemy_id, result, reward, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, data.enemyId, result.result, reward, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
      );

      // 增加玩家属性
      await this.playerService.addExp(uid, result.exp, ctx);
      await this.playerService.addGold(uid, result.gold, ctx);
      await this.playerService.addReputation(uid, result.reputation, ctx);
    });
  } catch (error) {
    console.error('战斗结算失败:', error);
  }
}
```

## 注意事项

1. **事务上下文传递**：确保在事务中调用的所有方法都能接收并使用事务上下文
2. **错误处理**：事务中的错误会自动回滚，但需要在事务外处理业务逻辑错误
3. **性能影响**：事务会锁定数据库资源，应避免长时间运行的事务
4. **兼容性**：事务系统设计为向后兼容，不使用事务的代码仍然可以正常工作

## 总结

事务系统是保证数据一致性的重要工具，特别是在复杂的业务逻辑中。通过正确使用事务系统，可以避免数据不一致的问题，提高系统的可靠性和稳定性。

在开发新功能时，应考虑是否需要使用事务来保证操作的原子性，特别是涉及多个数据库操作的场景。