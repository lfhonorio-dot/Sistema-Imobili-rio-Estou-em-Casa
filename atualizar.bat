@echo off
chcp 65001 >nul
echo ============================================
echo   Atualizando o Sistema de Investimentos
echo ============================================
echo.

cd /d "%~dp0"

echo [1/4] Baixando as novidades do GitHub...
git pull origin claude/hopeful-gauss-qshmuv
if errorlevel 1 (
    echo.
    echo ERRO ao baixar atualizacoes. Verifique sua internet e tente de novo.
    pause
    exit /b 1
)

echo.
echo [2/4] Parando o sistema...
docker compose stop backend frontend

echo.
echo [3/4] Reconstruindo com as novidades (pode levar alguns minutos)...
docker compose build backend frontend

echo.
echo [4/4] Iniciando o sistema...
docker compose up -d backend frontend

echo.
echo ============================================
echo   Pronto! Aguarde ~30 segundos e acesse:
echo   http://127.0.0.1:3000
echo ============================================
echo.
pause
