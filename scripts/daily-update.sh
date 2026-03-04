#!/bin/bash
# 日常更新：拉取最新代码并重新构建、重启
# 使用: 在本地双击 日常更新.bat
# 前提: 先 git push 推送代码到远程仓库
set -e

echo "=========================================="
echo "  文字挂机游戏 - 日常更新"
echo "=========================================="

cd /opt/guaji

# 记录当前版本（用于回滚）
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
echo "$PREV_COMMIT" > /opt/guaji/.rollback_commit
echo ">>> 当前版本: $PREV_COMMIT"

# 拉取代码（强制同步，避免本地修改导致冲突）
echo ""
echo ">>> [1/4] 拉取最新代码..."
git fetch origin
git reset --hard origin/main

# 构建
echo ""
echo ">>> [2/4] 安装依赖..."
cd text-rpg-game/server
npm install --no-audit --no-fund

echo ">>> [3/4] 构建项目..."
npm run build || { echo "构建失败！可执行 回滚.bat 恢复"; exit 1; }

echo ">>> [4/4] 更新数据库..."
node init-mongodb.js

# 重启服务
echo ""
echo ">>> 重启服务..."
pkill -f "node dist/app.js" 2>/dev/null || true
sleep 2
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
echo "更新完成！"
echo "若出问题，可执行 回滚.bat"
echo "=========================================="
