#!/bin/bash
# 首次部署：新服务器完整部署（环境 + 克隆代码 + 构建 + 启动）
# 服务器: 120.26.0.177
# 使用: 在本地双击 首次部署.bat，会通过 SSH 在服务器执行本脚本
set -e

GIT_REPO="https://github.com/hyj4859098/guaji.git"
PROJECT_DIR="/opt/guaji"

echo "=========================================="
echo "  文字挂机游戏 - 首次部署"
echo "=========================================="

# 第一步：添加 Swap
echo ""
echo ">>> [1/6] 添加 Swap（防止内存不足）..."
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
  echo "Swap 已添加"
else
  swapon /swapfile 2>/dev/null || true
  echo "Swap 已存在"
fi

# 第二步：安装 Node.js
echo ""
echo ">>> [2/6] 安装 Node.js..."
if ! command -v node &> /dev/null; then
  cd /tmp
  NODE_VER="18.19.0"
  wget -q "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-linux-x64.tar.xz" -O node.tar.xz
  tar -xf node.tar.xz -C /usr/local --strip-components=1
  rm -f node.tar.xz
  echo 'export PATH=/usr/local/bin:$PATH' >> /etc/profile
  export PATH=/usr/local/bin:$PATH
  echo "Node.js 已安装: $(node -v)"
else
  export PATH=/usr/local/bin:$PATH
  echo "Node.js 已存在: $(node -v)"
fi

# 第三步：安装 MongoDB
echo ""
echo ">>> [3/6] 安装 MongoDB..."
if [ -d /usr/local/mongodb ] && ! /usr/local/mongodb/bin/mongod --version &>/dev/null; then
  echo "检测到旧版 MongoDB 无法运行，重装..."
  rm -rf /usr/local/mongodb
fi

if ! command -v mongod &> /dev/null && [ ! -x /usr/local/mongodb/bin/mongod ]; then
  cd /tmp
  if command -v dnf &>/dev/null; then
    MONGO_TGZ="mongodb-linux-x86_64-rhel80-6.0.5.tgz"
  else
    MONGO_TGZ="mongodb-linux-x86_64-rhel70-6.0.5.tgz"
  fi
  wget -q "https://fastdl.mongodb.org/linux/${MONGO_TGZ}" -O mongodb.tgz
  tar -xzf mongodb.tgz
  MONGO_DIR="${MONGO_TGZ%.tgz}"
  rm -rf /usr/local/mongodb
  mv "$MONGO_DIR" /usr/local/mongodb
  rm -f mongodb.tgz
  echo 'export PATH=/usr/local/mongodb/bin:$PATH' >> /etc/profile
  export PATH=/usr/local/mongodb/bin:$PATH
  mkdir -p /data/db
  /usr/local/mongodb/bin/mongod --fork --logpath /var/log/mongod.log --dbpath /data/db
  echo "MongoDB 已安装并启动"
else
  export PATH=/usr/local/mongodb/bin:/usr/local/bin:$PATH
  pgrep -x mongod >/dev/null || (mkdir -p /data/db && /usr/local/mongodb/bin/mongod --fork --logpath /var/log/mongod.log --dbpath /data/db 2>/dev/null || true)
  echo "MongoDB 已存在"
fi

# 第四步：克隆代码（若不存在）
echo ""
echo ">>> [4/6] 准备项目代码..."
if [ ! -d "$PROJECT_DIR/.git" ]; then
  if ! command -v git &>/dev/null; then
    echo "安装 git..."
    (command -v yum &>/dev/null && yum install -y git) || (command -v apt-get &>/dev/null && apt-get update && apt-get install -y git) || { echo "请手动安装 git"; exit 1; }
  fi
  if [ -d "$PROJECT_DIR" ]; then
    echo "目录已存在但无 Git，将清空后重新克隆..."
    rm -rf "$PROJECT_DIR"
  fi
  mkdir -p "$(dirname $PROJECT_DIR)"
  git clone "$GIT_REPO" "$PROJECT_DIR"
  echo "代码已克隆到 $PROJECT_DIR"
else
  echo "项目已存在，跳过克隆"
fi

# 第五步：构建并启动
echo ""
echo ">>> [5/6] 构建项目..."
export PATH=/usr/local/mongodb/bin:/usr/local/bin:$PATH
export NODE_OPTIONS="--max-old-space-size=512"

cd "$PROJECT_DIR/text-rpg-game/server"
rm -rf node_modules
npm install --no-audit --no-fund
echo ">>> 初始化数据库..."
node init-mongodb.js
echo ">>> 构建..."
npm run build

echo ""
echo ">>> [6/6] 启动服务..."
if command -v pm2 &>/dev/null; then
  pm2 delete text-rpg-game 2>/dev/null || true
  pm2 start dist/app.js --name text-rpg-game
  pm2 save
  echo "已用 PM2 启动"
else
  pkill -f "node dist/app.js" 2>/dev/null || true
  nohup node dist/app.js > /var/log/text-rpg-game.log 2>&1 &
  echo $! > /var/run/text-rpg-game.pid
  echo "已用 nohup 启动，日志: /var/log/text-rpg-game.log"
fi

# 开放端口
echo ""
firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

echo ""
echo "=========================================="
echo "首次部署完成！"
echo "访问: http://120.26.0.177:3000"
echo "=========================================="
