@echo off
chcp 65001 >nul
echo ============================================
echo   Estou em Casa - Validar a FASE 4
echo   (contrato de venda e pos-venda)
echo ============================================
echo.
echo Este script NAO mexe no sistema que esta no ar.
echo Ele baixa a versao da Fase 4 e roda, dentro do Docker,
echo a compilacao e os testes automaticos do backend e do frontend.
echo Precisa: Git e Docker Desktop abertos (icone da baleia verde).
echo.

cd /d "%~dp0"

echo [1/4] Baixando a versao da Fase 4 do GitHub...
git fetch origin feat/fase-4-contrato-venda
if errorlevel 1 goto erro_git
git checkout feat/fase-4-contrato-venda
if errorlevel 1 goto erro_git
git pull origin feat/fase-4-contrato-venda
if errorlevel 1 goto erro_git

echo.
echo [2/4] Backend: instalar, compilar, checar tipos e rodar testes...
echo       (a primeira vez demora alguns minutos)
docker run --rm -v "%cd%\backend":/app -v /app/node_modules -w /app node:20-alpine sh -c "apk add --no-cache openssl >/dev/null && npm ci --no-audit --no-fund && ./node_modules/.bin/prisma generate && npm run build && npx tsc --noEmit && npx jest --ci"
if errorlevel 1 goto erro_backend

echo.
echo [3/4] Frontend: instalar e checar tipos...
docker run --rm -v "%cd%\frontend":/app -v /app/node_modules -v /app/.next -w /app node:20-alpine sh -c "npm ci --no-audit --no-fund && npx tsc --noEmit"
if errorlevel 1 goto erro_frontend

echo.
echo [4/4] Tudo certo!
echo ============================================
echo   FASE 4 VALIDADA
echo   - Backend: build, tipos e testes OK
echo   - Frontend: tipos OK
echo.
echo   Proximo passo: siga o roteiro de teste manual
echo   (docs\FASE-4.md) e, se estiver tudo bem,
echo   aprove o Pull Request da Fase 4 no GitHub.
echo ============================================
echo.
pause
exit /b 0

:erro_git
echo.
echo ERRO ao baixar do GitHub. Verifique sua internet e tente de novo.
pause
exit /b 1

:erro_backend
echo.
echo ERRO no backend (compilacao ou testes). Role a tela para cima,
echo copie as linhas em vermelho/FAIL e envie para o desenvolvedor.
pause
exit /b 1

:erro_frontend
echo.
echo ERRO no frontend (checagem de tipos). Role a tela para cima,
echo copie as mensagens de erro e envie para o desenvolvedor.
pause
exit /b 1
