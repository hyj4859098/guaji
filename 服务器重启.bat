@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not defined DEPLOY_SERVER set DEPLOY_SERVER=root@120.26.0.177
echo ========================================
echo   服务器重启（不恢复备份）
echo ========================================
echo.
echo 仅重启游戏服务，不修改代码
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=(Get-Content '%~dp0scripts\server-restart.sh' -Raw -Encoding UTF8) -replace \"`r`n\",\"`n\" -replace \"`r\",\"`n\"; $c | ssh %DEPLOY_SERVER% 'bash -s'"
echo.
pause
