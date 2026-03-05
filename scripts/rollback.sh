#!/bin/bash
# 回滚：从备份恢复上一版部署（生产环境不使用 Git）
# 使用: 双击 回滚.bat
set -e

PROJECT_DIR="/opt/guaji"
BACKUP_DIR="$PROJECT_DIR/backups"
export PATH=/usr/local/mongodb/bin:/usr/local/bin:$PATH

echo "=========================================="
echo "  回滚到上一版部署"
echo "=========================================="

# 1. 查找最新备份
LATEST_DEPLOY=$(ls -td "$BACKUP_DIR"/deploy-* 2>/dev/null | head -1)
if [ -z "$LATEST_DEPLOY" ]; then
  echo ">>> 无部署备份，无法回滚"
  exit 1
fi

BACKUP_NAME=$(basename "$LATEST_DEPLOY")
TIMESTAMP="${BACKUP_NAME#deploy-}"
echo ">>> 恢复备份: $BACKUP_NAME"

# 2. 恢复数据库（若有对应备份）
DB_BACKUP="$BACKUP_DIR/db_backup_$TIMESTAMP.archive.gz"
if [ -f "$DB_BACKUP" ]; then
  echo ">>> 恢复数据库: $DB_BACKUP"
  mongorestore --archive="$DB_BACKUP" --gzip --db=turn-based-game --drop
else
  echo ">>> 无数据库备份，跳过恢复"
fi

# 3. 恢复代码
echo ">>> 恢复代码..."
rm -rf "$PROJECT_DIR/text-rpg-game"
cp -r "$LATEST_DEPLOY" "$PROJECT_DIR/text-rpg-game"

# 4. 重启服务
echo ">>> 重启服务..."
pkill -f "node dist/app.js" 2>/dev/null || true
sleep 2
cd "$PROJECT_DIR/text-rpg-game/server"
if command -v pm2 &>/dev/null; then
  pm2 delete text-rpg-game 2>/dev/null || true
  pm2 start dist/app.js --name text-rpg-game
  pm2 save
  echo "已用 PM2 重启"
else
  nohup node dist/app.js > /var/log/text-rpg-game.log 2>&1 &
  echo $! > /var/run/text-rpg-game.pid
  echo "已用 nohup 重启"
fi

echo ""
echo "=========================================="
echo "回滚完成！"
echo "=========================================="
