# 核心公共服务文档

## 1. DataStorageService

### 1.1 概述
DataStorageService 是一个统一的数据存储服务，封装了数据库操作，提供了统一的 CRUD 接口、事务支持和批量操作功能。

### 1.2 功能特性
- 统一的 CRUD 操作接口
- 事务支持
- 批量插入操作
- 条件查询
- 错误处理和日志记录

### 1.3 方法说明

#### 1.3.1 基本操作

| 方法名 | 参数 | 返回值 | 描述 |
|-------|------|-------|------|
| `query(sql, params)` | sql: string, params: any[] | any | 执行 SQL 查询 |
| `getById(table, id)` | table: string, id: number | any  null | 根据 ID 获取数据 |
| `getByCondition(table, condition)` | table: string, condition: any | any  null | 根据条件获取数据 |
| `list(table, condition?)` | table: string, condition?: any | any[] | 获取数据列表 |
| `insert(table, data)` | table: string, data: any | number | 插入数据，返回 ID |
| `update(table, id, data)` | table: string, id: number, data: any | boolean | 更新数据，返回是否成功 |
| `delete(table, id)` | table: string, id: number | boolean | 删除数据，返回是否成功 |
| `batchInsert(table, dataList)` | table: string, dataList: any[] | number[] | 批量插入数据，返回 ID 列表 |

#### 1.3.2 事务操作

| 方法名 | 参数 | 返回值 | 描述 |
|-------|------|-------|------|
| `beginTransaction()` | 无 | Transaction | 开始事务 |

Transaction 对象方法：
- `commit()`: 提交事务
- `rollback()`: 回滚事务

### 1.4 使用示例

#### 1.4.1 基本 CRUD 操作

```typescript
import { dataStorageService } from './src/service/data-storage.service';

// 插入数据
const insertId = await dataStorageService.insert('player', {
  uid: 1,
  name: '测试玩家',
  level: 1,
  exp: 0,
  hp: 100,
  max_hp: 100,
  gold: 1000
});

// 获取数据
const player = await dataStorageService.getById('player', insertId);

// 更新数据
const updateResult = await dataStorageService.update('player', insertId, {
  gold: 2000,
  level: 2
});

// 删除数据
const deleteResult = await dataStorageService.delete('player', insertId);

// 列表查询
const players = await dataStorageService.list('player', { uid: 1 });

// 批量插入
const batchData = [
  { uid: 1, name: '批量测试1', level: 1, exp: 0, hp: 100, max_hp: 100, gold: 1000 },
  { uid: 1, name: '批量测试2', level: 1, exp: 0, hp: 100, max_hp: 100, gold: 1000 }
];
const batchIds = await dataStorageService.batchInsert('player', batchData);
```

#### 1.4.2 事务操作

```typescript
import { dataStorageService } from './src/service/data-storage.service';

// 开始事务
const transaction = await dataStorageService.beginTransaction();

try {
  // 执行一系列操作
  await dataStorageService.insert('player', { uid: 1, name: '测试玩家' });
  await dataStorageService.insert('bag', { uid: 1, item_id: 1, count: 10 });
  
  // 提交事务
  await transaction.commit();
} catch (error) {
  // 回滚事务
  await transaction.rollback();
  throw error;
}
```

## 2. ConfigService

### 2.1 概述
ConfigService 是一个配置管理服务，统一管理游戏配置，支持从文件和数据库加载配置，具有缓存和热重载功能。

### 2.2 功能特性
- 从文件和数据库加载配置
- 配置缓存
- 热重载功能
- 保存配置到文件和数据库
- 专门的技能、怪物和物品配置获取方法

### 2.3 方法说明

| 方法名 | 参数 | 返回值 | 描述 |
|-------|------|-------|------|
| `get(configName, defaultValue?)` | configName: string, defaultValue?: T | T | 获取配置 |
| `set(configName, value)` | configName: string, value: any | void | 设置配置 |
| `saveToFile(configName)` | configName: string | void | 保存配置到文件 |
| `saveToDb(configName)` | configName: string | Promise<void> | 保存配置到数据库 |
| `refresh(configName?)` | configName?: string | Promise<void> | 刷新配置 |
| `getSkillConfig(skillId)` | skillId: number | any | 获取技能配置 |
| `getMonsterConfig(monsterId)` | monsterId: number | any | 获取怪物配置 |
| `getItemConfig(itemId)` | itemId: number | any | 获取物品配置 |

### 2.4 使用示例

#### 2.4.1 基本配置操作

```typescript
import { configService } from './src/service/config.service';

// 设置配置
configService.set('test_config', { value: 'test_value', timestamp: Date.now() });

// 获取配置
const configValue = configService.get('test_config');

// 获取配置（带默认值）
const defaultConfig = configService.get('non_existent_config', 'default_value');

// 保存配置到文件
configService.saveToFile('test_config');

// 保存配置到数据库
await configService.saveToDb('test_config');

// 刷新配置
await configService.refresh();

// 刷新指定配置
await configService.refresh('test_config');
```

#### 2.4.2 游戏配置操作

```typescript
import { configService } from './src/service/config.service';

// 获取技能配置
const skillConfig = configService.getSkillConfig(1);

// 获取怪物配置
const monsterConfig = configService.getMonsterConfig(1);

// 获取物品配置
const itemConfig = configService.getItemConfig(1);
```

## 3. 集成到现有服务

### 3.1 更新 Model 层

将现有 Model 层的数据库操作替换为使用 DataStorageService：

```typescript
// 旧代码
import { query } from '../config/db';

export class PlayerModel {
  async get(id: number) {
    const rows = await query('SELECT * FROM player WHERE id = ?', [id]);
    return rows[0] || null;
  }
  // ... 其他方法
}

// 新代码
import { dataStorageService } from '../service/data-storage.service';

export class PlayerModel {
  async get(id: number) {
    return await dataStorageService.getById('player', id);
  }
  // ... 其他方法
}
```

### 3.2 使用 ConfigService 管理配置

在需要使用配置的地方，使用 ConfigService 来获取配置：

```typescript
import { configService } from './src/service/config.service';

// 获取技能配置
const skillConfig = configService.getSkillConfig(skillId);
if (skillConfig) {
  // 使用技能配置
  const damage = skillConfig.damage;
  const cost = skillConfig.cost;
  // ...
}
```

## 4. 最佳实践

1. **统一使用核心服务**：所有数据访问操作都应该通过 DataStorageService 进行，所有配置管理都应该通过 ConfigService 进行。

2. **使用事务**：对于需要保证原子性的操作，使用事务来确保数据一致性。

3. **合理使用缓存**：ConfigService 会自动缓存配置，避免频繁加载配置文件或数据库。

4. **定期刷新配置**：在系统运行过程中，定期调用 `refresh()` 方法来更新配置，确保配置的实时性。

5. **错误处理**：核心服务已经内置了错误处理和日志记录，使用时可以根据需要进行额外的错误处理。

## 5. 性能考虑

1. **批量操作**：对于大量数据的插入，使用 `batchInsert` 方法可以提高性能。

2. **事务管理**：合理使用事务可以减少数据库连接次数，提高性能。

3. **配置缓存**：ConfigService 的缓存机制可以减少文件和数据库访问，提高性能。

4. **条件查询**：使用 `getByCondition` 和 `list` 方法的条件参数可以减少返回的数据量，提高查询性能。

## 6. 总结

核心公共服务（DataStorageService 和 ConfigService）为系统提供了统一的数据访问和配置管理接口，提高了代码的一致性和可维护性。通过使用这些服务，开发人员可以更加专注于业务逻辑的实现，而不是底层的技术细节。

这些服务的设计考虑了性能、可靠性和可扩展性，为系统的长期发展奠定了基础。