@echo off
chcp 65001 >nul
echo ============================================
echo   Estou em Casa - Validar a FASE 8
echo   (teste automatico do fluxo de ouro)
echo ============================================
echo.
echo Este script NAO mexe no sistema que esta no ar.
echo Ele baixa a versao da Fase 8 e, dentro do Docker:
echo   - cria um banco de dados de TESTE vazio (descartavel);
echo   - compila e roda os testes do backend;
echo   - liga o sistema e percorre a venda inteira, da captacao
echo     do imovel ate a DIMOB, com Asaas, prefeitura e e-mail simulados;
echo   - confere os tipos do frontend.
echo Precisa: Git e Docker Desktop abertos (icone da baleia verde).
echo.

cd /d "%~dp0"

echo [1/4] Baixando a versao da Fase 8 do GitHub...
git fetch origin feat/fase-8-e2e
if errorlevel 1 goto erro_git
git checkout feat/fase-8-e2e
if errorlevel 1 goto erro_git
git pull origin feat/fase-8-e2e
if errorlevel 1 goto erro_git

echo.
echo [2/4] Criando o banco de dados de TESTE (descartavel)...
docker rm -f ec-fase8-db >nul 2>&1
docker network rm ec-fase8 >nul 2>&1
docker network create ec-fase8 >nul
if errorlevel 1 goto erro_docker
docker run -d --name ec-fase8-db --network ec-fase8 -e POSTGRES_USER=teste -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=fluxo_de_ouro postgres:16-alpine >nul
if errorlevel 1 goto erro_docker

echo.
echo [3/4] Backend: compilar, testes e FLUXO DE OURO completo...
echo       (a primeira vez demora varios minutos)
docker run --rm --network ec-fase8 -v "%cd%\backend":/app -v /app/node_modules -w /app -e DATABASE_URL=postgresql://teste:teste@ec-fase8-db:5432/fluxo_de_ouro node:20-alpine sh test/api/rodar-no-docker.sh
if errorlevel 1 goto erro_backend

echo.
echo [4/4] Frontend: instalar e checar tipos...
docker run --rm -v "%cd%\frontend":/app -v /app/node_modules -v /app/.next -w /app node:20-alpine sh -c "npm ci --no-audit --no-fund && npx tsc --noEmit"
if errorlevel 1 goto erro_frontend

call :limpar
echo.
echo ============================================
echo   FASE 8 VALIDADA
echo   - Backend: build, tipos e testes OK
echo   - Fluxo de ouro e testes de integracao OK
echo   - Frontend: tipos OK
echo.
echo   Proximo passo: siga o checklist de homologacao
echo   (docs\CHECKLIST-HOMOLOGACAO.md) e as instrucoes
echo   de docs\FASE-8.md para ligar o bloqueio de merge.
echo ============================================
echo.
pause
exit /b 0

:limpar
docker rm -f ec-fase8-db >nul 2>&1
docker network rm ec-fase8 >nul 2>&1
exit /b 0

:erro_git
echo.
echo ERRO ao baixar do GitHub. Verifique sua internet e tente de novo.
pause
exit /b 1

:erro_docker
call :limpar
echo.
echo ERRO ao criar o banco de teste no Docker. Confira se o Docker Desktop
echo esta aberto (baleia verde) e tente de novo.
pause
exit /b 1

:erro_backend
call :limpar
echo.
echo ERRO no backend (compilacao, testes ou fluxo de ouro). Role a tela
echo para cima, copie as linhas com FAIL / FALHOU / ERRO e envie para o
echo desenvolvedor.
pause
exit /b 1

:erro_frontend
call :limpar
echo.
echo ERRO no frontend (checagem de tipos). Role a tela para cima,
echo copie as mensagens de erro e envie para o desenvolvedor.
pause
exit /b 1
