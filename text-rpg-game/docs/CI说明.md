# CI 说明

## 0. 已接入的 GitHub 工具

| 工具 | 用途 | 配置 |
|------|------|------|
| **Dependabot** | 依赖更新、安全漏洞 PR | `.github/dependabot.yml`，每周一检查 |
| **CodeQL** | 代码安全扫描（SQL 注入、XSS 等） | `.github/workflows/codeql.yml` |
| **Codecov** | 覆盖率报告 | CI 中自动上传，公开仓库免费；私有仓库需在 [codecov.io](https://codecov.io) 添加仓库并配置 `CODECOV_TOKEN` |

---

## 一、当前 CI 覆盖范围

| 阶段 | 检查项 | 说明 |
|------|--------|------|
| **Lint** | ESLint | 代码规范、未使用变量、语法问题 |
| **Lint** | 数据通道检查 | 确保 API/WebSocket 使用符合规范 |
| **Test** | 构建 | `tsc` 编译，类型错误会失败 |
| **Test** | 单元测试 | Jest，含覆盖率（statements 75%/branches 65%/functions 85%/lines 78%） |
| **Test** | 数据库验证 | init-mongodb 结构正确性 |
| **Test** | GM API | 管理接口 |
| **Test** | 玩家 API | 游戏接口 |
| **Test** | 防漏洞测试 | 负向参数、越权等 |
| **Test** | WebSocket | 实时通信 |

---

## 二、CI 严格程度

| 项目 | 当前 | 说明 |
|------|------|------|
| **Lint 错误** | ✅ 阻断 | 任何 ESLint error 会导致失败 |
| **Lint 警告** | ⚠️ 不阻断 | 默认不失败，可加 `--max-warnings 0` 变严 |
| **覆盖率** | ✅ 75%/65%/85%/78% | 不达标则失败，详见 `测试规范.md` |
| **重复代码** | ❌ 未纳入 | jscpd 较慢，未加入 CI |
| **依赖循环** | ❌ 未纳入 | depcruise 仅 info，未加入 CI |
| **前端** | ❌ 未纳入 | 客户端 JS 无 lint/test |

---

## 三、能否保证每次提交无问题？

**能拦截的：**
- 编译/类型错误
- 单元测试失败
- API/WebSocket 集成失败
- 防漏洞测试失败
- ESLint 报错
- 数据通道规范违反

**暂未拦截的：**
- 前端 JS 语法/逻辑错误
- 重复代码增加
- 依赖循环
- 覆盖率下降（阈值过低）

**结论**：CI 能挡住大部分后端问题，但**不能 100% 保证**。建议：
- 合并前人工 review 关键改动
- 上线前做一次完整回归
- 逐步提高覆盖率阈值
