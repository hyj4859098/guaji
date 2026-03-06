@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not defined DEPLOY_SERVER set DEPLOY_SERVER=root@120.26.0.177
echo ========================================
echo   首次部署 - 新服务器环境准备
echo ========================================
echo.
echo 服务器: %DEPLOY_SERVER%
echo 将执行: 安装 Node、MongoDB、Swap 等环境
echo 完成后请双击「上传部署.bat」完成首次代码部署
echo 约需 5 分钟，需输入服务器 root 密码
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content '%~dp0scripts\first-deploy.sh' -Raw -Encoding UTF8 | ssh %DEPLOY_SERVER% 'bash -s'"
echo.
pause
