@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   从服务器恢复 - 下载生产环境代码到本地
echo ========================================
echo.
echo 服务器: 120.26.0.177
echo 将下载到: 项目同级目录的 guaji-从服务器恢复 文件夹
echo.
echo 下载完成后，可将该文件夹中的文件复制到当前项目覆盖
echo 或直接使用该文件夹继续开发
echo.
echo 需输入服务器 root 密码
echo.

set "TARGET=%~dp0..\guaji-从服务器恢复"
scp -r root@120.26.0.177:/opt/guaji "%TARGET%"

echo.
echo ========================================
echo 下载完成！
echo 位置: %TARGET%
echo.
echo 若本地代码已改崩，可：
echo 1. 打开 guaji-从服务器恢复 文件夹
echo 2. 将其中的 text-rpg-game 等文件夹复制到当前项目覆盖
echo ========================================
pause
