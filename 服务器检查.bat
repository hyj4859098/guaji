@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not defined DEPLOY_SERVER set DEPLOY_SERVER=root@120.26.0.177
echo ========================================
echo   服务器状态检查
echo ========================================
echo.
echo 将执行: 进程、端口、日志、MongoDB 检查
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=(Get-Content '%~dp0scripts\server-check.sh' -Raw -Encoding UTF8) -replace \"`r`n\",\"`n\" -replace \"`r\",\"`n\"; $c | ssh %DEPLOY_SERVER% 'bash -s'"
echo.
pause
