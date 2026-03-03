#!/bin/bash
# 文字回合制挂机游戏 - 服务器部署脚本
set -e

echo "=== 开始部署 ==="
cd "$(dirname "$0")/text-rpg-game/server"

echo ">>> 安装依赖..."
npm install

echo ">>> 初始化 MongoDB 数据库..."
node init-mongodb.js

echo ">>> 构建项目..."
npm run build

echo ">>> 启动服务 (PM2)..."
pm2 delete text-rpg-game 2>/dev/null || true
pm2 start dist/app.js --name text-rpg-game
pm2 save

echo "=== 部署完成 ==="
echo "访问: http://$(curl -s ifconfig.me 2>/dev/null || echo '服务器IP'):3000"
