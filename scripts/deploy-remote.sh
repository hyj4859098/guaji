#!/bin/bash
# 服务器端部署逻辑：备份 → 解压 → 初始化 → 重启
# 由 upload-deploy.ps1 通过 SSH 管道执行，生产环境不使用 Git
set -e

PROJECT_DIR="/opt/guaji"
BACKUP_DIR="$PROJECT_DIR/backups"
export PATH=/usr/local/mongodb/bin:/usr/local/bin:$PATH

echo ">>> [1/4] 备份当前部署（若存在）..."
if [ -d "$PROJECT_DIR/text-rpg-game/server/dist" ]; then
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  mkdir -p "$BACKUP_DIR"
  cp -r "$PROJECT_DIR/text-rpg-game" "$BACKUP_DIR/deploy-$TIMESTAMP"
  echo "  代码已备份: deploy-$TIMESTAMP"
  mongodump --archive="$BACKUP_DIR/db_backup_$TIMESTAMP.archive.gz" --gzip --db=turn-based-game 2>/dev/null || echo "  数据库备份跳过（可能未运行）"
  # 仅保留最近 5 份备份
  (cd "$BACKUP_DIR" && ls -td deploy-* 2>/dev/null | tail -n +6 | xargs -r rm -rf)
  (cd "$BACKUP_DIR" && ls -t db_backup_*.archive.gz 2>/dev/null | tail -n +6 | xargs -r rm -f)
else
  echo "  首次部署，无需备份"
fi

echo ">>> [2/4] 解压生产包..."
mkdir -p "$PROJECT_DIR/text-rpg-game"
cd "$PROJECT_DIR"
tar -xzf server-deploy.tar.gz -C text-rpg-game
rm -f server-deploy.tar.gz

echo ">>> [3/4] 初始化数据库..."
cd "$PROJECT_DIR/text-rpg-game/server"
node init-mongodb.js

echo ">>> [4/4] 重启服务..."
pkill -f "node dist/app.js" 2>/dev/null || true
sleep 2
if command -v pm2 &>/dev/null; then
  pm2 delete text-rpg-game 2>/dev/null || true
  pm2 start dist/app.js --name text-rpg-game
  pm2 save
  echo "已用 PM2 启动"
else
  nohup node dist/app.js > /var/log/text-rpg-game.log 2>&1 &
  echo $! > /var/run/text-rpg-game.pid
  echo "已用 nohup 启动，日志: /var/log/text-rpg-game.log"
fi

echo ""
echo "部署完成！"
