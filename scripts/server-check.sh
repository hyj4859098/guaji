#!/bin/bash
# 服务器状态检查：进程、端口、日志
# 使用: 双击 服务器检查.bat，或 ssh 后执行 bash server-check.sh
PROJECT_DIR="/opt/guaji"
LOG_DIR="$PROJECT_DIR/text-rpg-game/server/logs"

echo "=========================================="
echo "  服务器状态检查"
echo "=========================================="
echo ""

echo ">>> 1. Node 进程"
ps aux | grep -E "node.*dist/app" | grep -v grep || echo "  (无运行中的游戏服务)"
echo ""

echo ">>> 2. 端口占用"
(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E ':3000|:3001' || echo "  3000/3001 未监听"
echo ""

echo ">>> 3. PM2 状态（若有）"
if command -v pm2 &>/dev/null; then
  pm2 list 2>/dev/null | grep -E "text-rpg|name|online" || echo "  PM2 无 text-rpg-game"
else
  echo "  PM2 未安装"
fi
echo ""

echo ">>> 4. 最近日志（最后 20 行）"
if [ -d "$LOG_DIR" ]; then
  LATEST=$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    echo "  文件: $LATEST"
    tail -20 "$LATEST" 2>/dev/null | sed 's/^/  /'
  else
    echo "  无日志文件"
  fi
else
  echo "  日志目录不存在"
fi
echo ""

echo ">>> 5. MongoDB"
pgrep -x mongod >/dev/null && echo "  MongoDB 运行中" || echo "  MongoDB 未运行"
echo ""

echo "=========================================="
echo "若需重启: pm2 restart text-rpg-game"
echo "或: cd /opt/guaji/text-rpg-game/server && node dist/app.js"
echo "=========================================="
