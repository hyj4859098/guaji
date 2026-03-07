@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not defined DEPLOY_SERVER set DEPLOY_SERVER=root@120.26.0.177
echo ========================================
echo   快速部署 - 仅 dist + client
echo ========================================
echo.
echo 适用: 日常业务代码更新（含 package.json 依赖变更）
echo 服务器端 npm install，包体积小
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:DEPLOY_SERVER='%DEPLOY_SERVER%'; & '%~dp0scripts\upload-deploy-quick.ps1'"
pause
