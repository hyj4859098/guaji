# 快速修复：将本地正确的 rate-limit.js 上传到服务器
# 解决服务器 dist 未更新的问题
$ErrorActionPreference = "Stop"
if (-not $env:DEPLOY_SERVER) { $env:DEPLOY_SERVER = "root@120.26.0.177" }
$SERVER = $env:DEPLOY_SERVER
$root = Split-Path -Parent $PSScriptRoot

$localFile = "$root\text-rpg-game\server\dist\middleware\rate-limit.js"
$remotePath = "/opt/guaji/text-rpg-game/server/dist/middleware/"

if (-not (Test-Path $localFile)) {
    Write-Host "本地 rate-limit.js 不存在，请先执行: cd text-rpg-game\server && npm run build"
    exit 1
}

Write-Host "上传 rate-limit.js 到服务器..."
scp $localFile "${SERVER}:${remotePath}rate-limit.js"
Write-Host "重启服务..."
ssh $SERVER "cd /opt/guaji/text-rpg-game/server && pm2 restart text-rpg-game"
$hostPart = if ($SERVER -match '@(.+)$') { $Matches[1] } else { $SERVER }; Write-Host "完成！访问: http://${hostPart}:3000"
