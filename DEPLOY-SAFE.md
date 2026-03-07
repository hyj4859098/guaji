# 安全部署指南

## 部署流程（已内置保护）

1. **备份数据库** → 失败则中止
2. **拉取代码**
3. **构建** → 失败则中止，可回滚
4. **执行迁移**（新表）
5. **执行 init-mongodb**（增量数据）
6. **重启服务**

## 新增功能时如何同步

### 1. 新增数据库表

在 `text-rpg-game/server/scripts/migrations/` 下新建文件，例如 `002-add-activity.js`：

```javascript
module.exports = {
  async up(db) {
    const exists = await db.listCollections({ name: 'activity' }).hasNext();
    if (!exists) {
      await db.createCollection('activity');
      console.log('  创建集合: activity');
    }
  }
};
```

同时更新 `001-init-collections.js` 的 COLLECTIONS 数组，加入新表名（便于新环境初始化）。

### 2. 新增 GM 功能

正常开发，代码随 git push 一起部署。GM 前端在 `client/gm/`，后端 API 在 `server/src/api/admin/`。

### 3. 部署

```bash
git add .
git commit -m "新功能：xxx"
git push
```

双击 **快速部署.bat**

## 出问题怎么办

### 部署后报错、无法访问

在本地双击 **回滚.bat**，或在服务器执行：

```bash
cd /opt/guaji
bash scripts/rollback.sh
```

会恢复：数据库备份 + 代码到部署前版本。

### 构建失败

更新脚本会在构建失败时中止，不会重启服务。老版本继续运行。修复代码后重新 push 再部署即可。

## 备份位置

服务器上：`/opt/guaji/backups/`，保留最近 5 个备份。
