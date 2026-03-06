# 运维 Runbook

> 生产环境日常运维与故障排查速查手册。

---

## 一、项目概览

| 组件 | 端口/说明 |
|------|-----------|
| HTTP API | 3000 |
| WebSocket | 3001 |
| 数据库 | MongoDB |
| 进程管理 | PM2（`text-rpg-game`） |

---

## 二、健康检查

**端点**：`GET /api/health`

**返回字段**：

| 字段 | 说明 |
|------|------|
| `status` | `ok`（正常）或 `degraded`（DB 不可用） |
| `uptime` | 进程运行秒数 |
| `db` | `connected` 或 `disconnected` |
| `memory` | RSS 内存占用（MB） |
| `timestamp` | 当前时间 ISO 字符串 |

- HTTP 200：服务正常且 DB 已连接  
- HTTP 503：DB 未连接（服务仍可响应，但业务可能异常）

---

## 三、常见问题排查

### a. 服务未响应

1. `pm2 status` 查看进程是否在跑
2. `curl http://localhost:3000/api/health` 检查健康状态
3. 检查 MongoDB 是否可达：`mongosh` 或 `mongo` 连接测试

### b. 数据库连接失败

1. 检查 `MONGODB_URI` 环境变量是否正确
2. 检查 `mongod` 是否运行：`ps aux | grep mongod` 或 `systemctl status mongod`
3. 检查网络/防火墙是否允许连接

### c. WebSocket 断连

1. 检查 3001 端口是否监听：`netstat -tlnp | grep 3001`
2. 若经 Nginx 代理，检查 `proxy_pass`、`Upgrade`、`Connection` 配置
3. 确认前端 `WS_URL` 与后端实际 WS 地址一致

### d. 部署失败

1. 查看 `deploy-remote.sh` 执行日志（SSH 输出或 CI 日志）
2. 部署后会自动调用 `/api/health`，未通过会提示
3. 使用 `rollback.sh` 或 `回滚.bat` 回滚到上一版

---

## 四、部署流程

详见 `部署指南.md`。简要步骤：

1. CI 通过 → 构建 → 上传生产包
2. 服务器执行 `deploy-remote.sh`：备份 → 解压 → init-mongodb → 重启
3. 部署后自动健康检查（10 次重试，每次间隔 3 秒）

---

## 五、回滚方式

- **服务器上**：执行 `scripts/rollback.sh`
- **Windows 本地**：双击项目根目录的 `回滚.bat`（通过 SSH 在服务器执行回滚）

回滚会从 `backups/deploy-*` 恢复代码，若有对应 `db_backup_*` 则恢复数据库，然后重启服务。

---

## 六、环境变量清单

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEPLOY_SERVER` | 部署用 | 部署目标服务器地址 |
| `JWT_SECRET` | ✅ | 强随机字符串 |
| `MONGODB_URI` | ✅ | MongoDB 连接串 |
| `MONGODB_DATABASE` | 否 | 默认 `turn-based-game` |
| `WS_URL` | 否 | 若 WS 经代理，设完整 URL（如 `wss://xxx.com/ws`） |
| `CORS_ORIGINS` | 否 | 允许的跨域来源 |
| `PORT` | 否 | HTTP 端口，默认 3000 |
| `WS_PORT` | 否 | WebSocket 端口，默认 3001 |

---

## 七、日志位置

| 方式 | 路径 |
|------|------|
| PM2 | `pm2 logs text-rpg-game` |
| 文件（nohup 模式） | `/var/log/text-rpg-game.log` |
