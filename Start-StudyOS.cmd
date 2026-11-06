@echo off
setlocal
cd /d "%~dp0"
if not exist "dist\index.html" (
    echo [Study OS] Build nao encontrado. Execute o setup primeiro:
    echo powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
    pause
    exit /b 1
)
set "STUDYOS_HOST=127.0.0.1"
set "PORT=4317"
if exist ".studyos-data\research-path.txt" set /p STUDYOS_RESEARCH_DIR=<".studyos-data\research-path.txt"
echo [Study OS] Iniciando em http://127.0.0.1:4317
echo [Study OS] Mantenha esta janela aberta enquanto estuda.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:4317'"
call npm.cmd start
set "exitCode=%ERRORLEVEL%"
echo.
echo [Study OS] Servidor encerrado (codigo %exitCode%).
pause
exit /b %exitCode%
