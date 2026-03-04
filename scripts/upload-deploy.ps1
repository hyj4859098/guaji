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

Write-Host "[3/4] 打包并上传..."
Set-Location $root
tar -czf server-deploy.tar.gz -C text-rpg-game server/dist server/node_modules server/package.json server/init-mongodb.js client
if (-not (Test-Path server-deploy.tar.gz)) { Write-Host "FAILED: tar"; exit 1 }

Write-Host "上传中（需输入服务器密码）..."
scp server-deploy.tar.gz "${SERVER}:/opt/guaji/"
Write-Host "解压并启动（需再次输入密码）..."
ssh $SERVER "cd /opt/guaji && mkdir -p text-rpg-game && cd text-rpg-game && tar -xzf ../server-deploy.tar.gz && cd server && node init-mongodb.js && pkill -f 'node dist/app.js' 2>/dev/null; nohup node dist/app.js > /var/log/text-rpg-game.log 2>&1 &"
Remove-Item server-deploy.tar.gz -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[4/4] 完成！" -ForegroundColor Green
Write-Host "访问: http://120.26.0.177:3000" -ForegroundColor Yellow
Read-Host "按回车退出"
