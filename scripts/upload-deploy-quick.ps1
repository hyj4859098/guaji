# 快速部署：仅上传 dist + client + package.json（业务代码变更时用）
# 不包含 node_modules，上传体积小；服务器端 npm install --production 安装依赖
# 适用：日常业务代码更新，不传测试工具（devDependencies）
# 服务器: 使用 DEPLOY_SERVER 环境变量（见 .env.deploy.example）
$ErrorActionPreference = "Stop"
if (-not $env:DEPLOY_SERVER) { $env:DEPLOY_SERVER = "root@120.26.0.177" }
$SERVER = $env:DEPLOY_SERVER
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  快速部署 - 业务代码 + 依赖安装" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "上传: dist + client + package.json，服务器端 npm install --production" -ForegroundColor Gray
Write-Host "不传 node_modules，不传测试工具" -ForegroundColor Gray
Write-Host ""

Set-Location "text-rpg-game\server"
Write-Host "[1/4] 清理并构建..."
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED"; exit 1 }

Write-Host "[2/4] 打包（dist + client + package.json + package-lock.json + init-mongodb.js）..."
Set-Location $root
tar -czf update-deploy.tar.gz -C text-rpg-game server/dist server/package.json server/package-lock.json server/init-mongodb.js client
if (-not (Test-Path update-deploy.tar.gz)) { Write-Host "FAILED: tar"; exit 1 }

Write-Host "[3/4] 上传（需输入服务器密码）..."
scp update-deploy.tar.gz "${SERVER}:/opt/guaji/"
Write-Host "服务器端：解压、安装依赖、重启（需再次输入密码）..."
$deployScript = (Get-Content "$PSScriptRoot\deploy-remote-quick.sh" -Raw -Encoding UTF8) -replace "`r`n", "`n" -replace "`r", "`n"
$deployScript | ssh $SERVER "bash -s"
Remove-Item update-deploy.tar.gz -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[4/4] 完成！" -ForegroundColor Green
$hostPart = if ($SERVER -match '@(.+)$') { $Matches[1] } else { $SERVER }; Write-Host "访问: http://${hostPart}:3000" -ForegroundColor Yellow
Read-Host "Press Enter to exit"
