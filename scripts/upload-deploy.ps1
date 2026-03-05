# 上传部署：本地构建后打包上传到服务器
# 适合：有本地修改但不想 push 时使用
# 服务器: 120.26.0.177
$ErrorActionPreference = "Stop"
$SERVER = "root@120.26.0.177"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  上传部署 - 本地构建并上传" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "text-rpg-game\server"
Write-Host "[1/4] npm install..."
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED"; exit 1 }

Write-Host "[2/4] npm run build..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED"; exit 1 }

Write-Host "移除开发依赖（生产环境仅保留运行时依赖）..."
npm prune --production

Write-Host "[3/4] 打包并上传..."
Set-Location $root
tar -czf server-deploy.tar.gz -C text-rpg-game server/dist server/node_modules server/package.json server/init-mongodb.js client
# 恢复本地开发依赖（prune 已修改了 node_modules）
Set-Location "text-rpg-game\server"
npm install --no-audit --no-fund | Out-Null
Set-Location $root
if (-not (Test-Path server-deploy.tar.gz)) { Write-Host "FAILED: tar"; exit 1 }

Write-Host "上传中（需输入服务器密码）..."
scp server-deploy.tar.gz "${SERVER}:/opt/guaji/"
Write-Host "服务器端：备份、解压、启动（需再次输入密码）..."
$deployScript = Get-Content "$PSScriptRoot\deploy-remote.sh" -Raw -Encoding UTF8
$deployScript | ssh $SERVER "bash -s"
Remove-Item server-deploy.tar.gz -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[4/4] 完成！" -ForegroundColor Green
Write-Host "访问: http://120.26.0.177:3000" -ForegroundColor Yellow
Read-Host "按回车退出"
