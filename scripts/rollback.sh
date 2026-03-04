#!/bin/bash
# 回滚：恢复到部署前的状态（数据库 + 代码）
# 仅在部署出问题时使用
set -e

cd /opt/guaji
BACKUP_DIR="/opt/guaji/backups"
export PATH=/usr/local/mongodb/bin:/usr/local/bin:$PATH

echo "=========================================="
echo "  回滚到部署前状态"
echo "=========================================="

# 1. 恢复数据库（若有备份）
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/db_backup_*.archive.gz 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
  echo ">>> 恢复数据库: $LATEST_BACKUP"
  mongorestore --archive="$LATEST_BACKUP" --gzip --db=turn-based-game --drop
else
  echo ">>> 无数据库备份，跳过恢复"
fi

# 2. 回滚代码
ROLLBACK_COMMIT=$(cat /opt/guaji/.rollback_commit 2>/dev/null || echo "")
if [ -n "$ROLLBACK_COMMIT" ]; then
  echo ">>> 回滚代码到 $ROLLBACK_COMMIT ..."
  git reset --hard "$ROLLBACK_COMMIT"
else
  echo ">>> 回滚代码到上一版本..."
  git reset --hard HEAD~1
fi

# 3. 重新构建并重启
cd text-rpg-game/server
npm install --no-audit --no-fund
npm run build

echo ">>> 重启服务..."
pkill -f "node dist/app.js" 2>/dev/null || true
sleep 2
if command -v pm2 &>/dev/null; then
  pm2 delete text-rpg-game 2>/dev/null || true
  pm2 start dist/app.js --name text-rpg-game
  pm2 save
else
  nohup node dist/app.js > /var/log/text-rpg-game.log 2>&1 &
  echo $! > /var/run/text-rpg-game.pid
fi

echo ""
echo "=========================================="
echo "回滚完成！"
echo "=========================================="
