@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   首次部署 - 新服务器完整部署
echo ========================================
echo.
echo 服务器: 120.26.0.177
echo 将执行: 安装环境 + 克隆代码 + 构建 + 启动
echo 约需 5-10 分钟，需输入服务器 root 密码
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content '%~dp0scripts\first-deploy.sh' -Raw -Encoding UTF8 | ssh root@120.26.0.177 'bash -s'"
echo.
pause
