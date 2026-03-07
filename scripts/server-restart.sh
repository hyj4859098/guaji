#!/bin/bash
# 仅重启游戏服务，不恢复备份
set -e
PROJECT_DIR="/opt/guaji"
export PATH=/usr/local/mongodb/bin:/usr/local/bin:$PATH

echo ">>> 停止旧进程..."
pkill -f "node dist/app.js" 2>/dev/null || true
sleep 2

echo ">>> 启动服务..."
cd "$PROJECT_DIR/text-rpg-game/server"
if command -v pm2 &>/dev/null; then
  pm2 delete text-rpg-game 2>/dev/null || true
  pm2 start dist/app.js --name text-rpg-game --cwd "$PROJECT_DIR/text-rpg-game/server"
  pm2 save
  echo "已用 PM2 启动"
  pm2 logs text-rpg-game --lines 5 --nostream
else
  nohup node dist/app.js > /var/log/text-rpg-game.log 2>&1 &
  echo $! > /var/run/text-rpg-game.pid
  echo "已用 nohup 启动，日志: /var/log/text-rpg-game.log"
  tail -10 /var/log/text-rpg-game.log
fi
echo ""
echo "重启完成！"
