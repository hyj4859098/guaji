@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not defined DEPLOY_SERVER set DEPLOY_SERVER=root@120.26.0.177
echo ========================================
echo   上传部署 - 本地构建并上传
echo ========================================
echo.
echo 服务器: %DEPLOY_SERVER%
echo 适合: 有本地修改但不想 push 时使用
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:DEPLOY_SERVER='%DEPLOY_SERVER%'; & '%~dp0scripts\upload-deploy.ps1'"
pause
