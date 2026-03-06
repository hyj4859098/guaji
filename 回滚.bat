@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not defined DEPLOY_SERVER set DEPLOY_SERVER=root@120.26.0.177
echo ========================================
echo   回滚 - 恢复到部署前状态
echo ========================================
echo.
echo 警告: 仅在部署出问题时使用！
echo.
set /p confirm=确认回滚? (输入 y 继续):
if /i not "%confirm%"=="y" (
  echo 已取消
  pause
  exit /b
)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=(Get-Content '%~dp0scripts\rollback.sh' -Raw -Encoding UTF8) -replace \"`r`n\",\"`n\" -replace \"`r\",\"`n\"; $c | ssh %DEPLOY_SERVER% 'bash -s'"
echo.
pause
