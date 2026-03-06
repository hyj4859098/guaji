#!/bin/bash
# 快速部署：备份 → 解压 + npm install + 初始化（仅首次）→ 重启
# 由 upload-deploy-quick.ps1 通过 SSH 管道执行
# 说明：init-mongodb.js 仅在首次部署执行；后续新增物品请写临时迁移脚本
set -e

PROJECT_DIR="/opt/guaji"
BACKUP_DIR="$PROJECT_DIR/backups"
export PATH=/usr/local/mongodb/bin:/usr/local/bin:$PATH

echo ">>> [1/5] 备份当前部署（若存在）..."
FIRST_DEPLOY=1
if [ -d "$PROJECT_DIR/text-rpg-game/server/dist" ]; then
  FIRST_DEPLOY=0
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  mkdir -p "$BACKUP_DIR"
  cp -r "$PROJECT_DIR/text-rpg-game" "$BACKUP_DIR/deploy-$TIMESTAMP"
  echo "  代码已备份: deploy-$TIMESTAMP"
  mongodump --archive="$BACKUP_DIR/db_backup_$TIMESTAMP.archive.gz" --gzip --db=turn-based-game 2>/dev/null || echo "  数据库备份跳过"
  (cd "$BACKUP_DIR" && ls -td deploy-* 2>/dev/null | tail -n +6 | xargs -r rm -rf)
  (cd "$BACKUP_DIR" && ls -t db_backup_*.archive.gz 2>/dev/null | tail -n +6 | xargs -r rm -f)
else
  echo "  首次部署，无需备份"
fi

cd "$PROJECT_DIR"
mkdir -p text-rpg-game
echo ">>> [2/5] Extracting dist + client + package.json + package-lock.json + init-mongodb.js..."
tar -xzf update-deploy.tar.gz -C text-rpg-game
rm -f update-deploy.tar.gz
echo ">>> [3/5] Installing production deps (clean install)..."
cd "$PROJECT_DIR/text-rpg-game/server"
rm -rf node_modules
# 使用国内镜像，避免 npm 官方源超时
npm config set registry https://registry.npmmirror.com 2>/dev/null || true
# npm ci 根据 lock 文件精确安装，比 npm install 更可靠
npm ci --production --no-audit --no-fund 2>/dev/null || npm install --production --no-audit --no-fund
# 若 express-rate-limit 未安装，应用会降级运行（限流禁用），不阻塞部署
if [ ! -d "node_modules/express-rate-limit" ]; then
  echo "WARN: express-rate-limit 未安装，应用将降级运行（登录限流已禁用）"
fi
echo ">>> [4/5] 数据库初始化..."
if [ "$FIRST_DEPLOY" = "1" ]; then
  echo "  首次部署，执行 init-mongodb.js"
  node init-mongodb.js
else
  echo "  非首次部署，跳过初始化（新增物品请运行临时迁移脚本）"
fi
npm install dotenv --no-save --no-audit --no-fund 2>/dev/null || true
echo ">>> [5/5] Restarting service..."
pkill -f "node dist/app.js" 2>/dev/null || true
sleep 2
if command -v pm2 &>/dev/null; then
  pm2 delete text-rpg-game 2>/dev/null || true
  pm2 start dist/app.js --name text-rpg-game --cwd "$PROJECT_DIR/text-rpg-game/server"
  pm2 save
  echo "已用 PM2 启动"
  sleep 2
  pm2 logs text-rpg-game --lines 15 --nostream 2>/dev/null || pm2 status
else
  nohup node dist/app.js > /var/log/text-rpg-game.log 2>&1 &
  echo $! > /var/run/text-rpg-game.pid
  echo "已用 nohup 启动，日志: /var/log/text-rpg-game.log"
  sleep 2
  tail -15 /var/log/text-rpg-game.log
fi
echo ""
echo "Quick deploy done!"
