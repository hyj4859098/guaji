@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   日常更新 - 拉取代码并重新部署
echo ========================================
echo.
echo 服务器: 120.26.0.177
echo 前提: 请先 git push 推送代码到远程仓库
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content '%~dp0scripts\daily-update.sh' -Raw -Encoding UTF8 | ssh root@120.26.0.177 'bash -s'"
echo.
pause
