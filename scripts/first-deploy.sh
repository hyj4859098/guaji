#!/bin/bash
# 首次部署：仅安装服务器环境（Node、MongoDB 等），不克隆代码
# 生产环境采用「生产包部署」，不使用 Git
# 服务器: 使用 DEPLOY_SERVER 环境变量（默认 root@120.26.0.177），由 .bat 调用时传入
# 使用: 双击 首次部署.bat 安装环境，完成后双击 上传部署.bat 完成首次部署
set -e

PROJECT_DIR="/opt/guaji"

echo "=========================================="
echo "  文字挂机游戏 - 首次部署（环境准备）"
echo "=========================================="

# 第一步：添加 Swap
echo ""
echo ">>> [1/4] 添加 Swap（防止内存不足）..."
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
echo ">>> [2/4] 安装 Node.js..."
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
echo ">>> [3/4] 安装 MongoDB..."
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

# 第四步：创建目录结构
echo ""
echo ">>> [4/4] 创建项目目录..."
mkdir -p "$PROJECT_DIR/text-rpg-game/server"
mkdir -p "$PROJECT_DIR/backups"
echo "目录已创建: $PROJECT_DIR"

# 开放端口
echo ""
firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

echo ""
echo "=========================================="
echo "环境准备完成！"
echo "请在本机双击「上传部署.bat」完成首次部署"
echo "（上传部署会打包 dist、node_modules、client 等生产代码并上传）"
echo "=========================================="
