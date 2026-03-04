@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   上传部署 - 本地构建并上传
echo ========================================
echo.
echo 服务器: 120.26.0.177
echo 适合: 有本地修改但不想 push 时使用
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\upload-deploy.ps1"
pause
