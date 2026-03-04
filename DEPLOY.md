# 部署指南

> **日常部署**：请直接查看 [部署说明.md](./部署说明.md)，使用根目录的四个 .bat 文件（首次部署、日常更新、上传部署、回滚）。

---

## 一、Git 远程仓库（本地已完成）

项目已提交到本地 Git，包含 242 个文件。

### 1. 创建远程仓库

在 **GitHub** 或 **Gitee** 上新建一个空仓库（不要勾选初始化 README）：

- GitHub: https://github.com/new
- Gitee: https://gitee.com/projects/new

### 2. 添加远程并推送

在本地项目目录执行（替换为你的仓库地址）：

```bash
cd c:\Users\Administrator\Desktop\guaji

# 添加远程（二选一）
git remote add origin https://github.com/你的用户名/guaji.git
# 或
git remote add origin https://gitee.com/你的用户名/guaji.git

# 推送
git push -u origin main
```

---

## 二、服务器部署

### 1. 在服务器上克隆

SSH 连接服务器后：

```bash
cd /opt
git clone https://github.com/你的用户名/guaji.git
# 或 Gitee
git clone https://gitee.com/你的用户名/guaji.git
```

### 2. 运行部署脚本

```bash
cd /opt/guaji
chmod +x deploy.sh
./deploy.sh
```

或手动执行：

```bash
cd /opt/guaji/text-rpg-game/server
npm install
node init-mongodb.js
npm run build
pm2 start dist/app.js --name text-rpg-game
```

### 3. 开放端口

```bash
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw enable
```

### 4. 访问游戏

浏览器打开：`http://你的服务器IP:3000`
