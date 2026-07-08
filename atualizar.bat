@echo off
chcp 65001 >nul
echo ============================================
echo   Atualizando o Sistema de Investimentos
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Baixando as novidades do GitHub...
git pull origin claude/hopeful-gauss-qshmuv
if errorlevel 1 (
    echo.
    echo ERRO ao baixar atualizacoes. Verifique sua internet e tente de novo.
    pause
    exit /b 1
)

echo.
echo [2/3] Reconstruindo o sistema com as novidades...
echo       (pode levar alguns minutos na primeira vez)
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo ERRO ao reconstruir. Verifique se o Docker Desktop esta aberto
    echo (icone da baleia verde) e tente de novo.
    pause
    exit /b 1
)

echo.
echo [3/3] Aguardando o sistema ficar pronto...
echo       (o backend instala o que falta e atualiza o banco sozinho)
echo.
echo Aguarde cerca de 1 minuto e acesse:
echo    http://127.0.0.1:3000
echo.
echo Se aparecer "Failed to fetch" ao entrar, espere mais 30 segundos
echo (o backend ainda esta terminando de iniciar) e tente de novo.
echo.
echo ============================================
echo   Pronto!
echo ============================================
echo.
pause
