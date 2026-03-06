# 文字回合制挂机游戏

## 快速启动（小白版）

### 1. 确保 MongoDB 已启动

项目使用 MongoDB 存储数据，请先启动 MongoDB 服务。

### 2. 启动后端

在项目根目录打开命令行，执行：

```
cd server
npm run dev
```

看到 `HTTP Server running on port 3000` 表示启动成功。

**开发模式说明**：`npm run dev` 使用热重载，修改 `server/src` 下的代码并保存后会自动重启，无需手动重启。若使用 `npm start` 则运行编译后的代码，修改后需先执行 `npm run build` 再重启。

### 3. 访问游戏

在浏览器打开：**http://localhost:3000**

后端会同时提供前端页面，无需单独启动前端。

---

## 项目配置

支持环境变量，复制 `server/.env.example` 为 `server/.env` 并修改：

- **PORT**: HTTP 端口（默认 3000）
- **JWT_SECRET**: JWT 密钥（生产环境必须修改）
- **MONGODB_URI**: MongoDB 连接（默认 mongodb://localhost:27017）
- **MONGODB_DATABASE**: 数据库名（默认 turn-based-game）
- **WS_PORT**: WebSocket 端口（默认 3001）
- **WS_URL**: 生产环境可设完整 WS 地址（如 wss://domain.com/ws）

不配置 `.env` 时使用默认值，开发可直接运行。

## 访问地址

- 游戏主界面: http://localhost:3000
- 后端 API: http://localhost:3000/api
- WebSocket: ws://localhost:3001
