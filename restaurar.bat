@echo off
chcp 65001 >nul
echo ============================================
echo   Restaurar Backup do Sistema
echo ============================================
echo.
echo ATENCAO: isso vai APAGAR os dados atuais do sistema
echo e substituir pelo conteudo do arquivo de backup escolhido.
echo.

cd /d "%~dp0"

echo Backups disponiveis:
echo.
dir /b /o-d backups\*.sql 2>nul
echo.

set /p ARQUIVO="Digite o nome exato do arquivo de backup (ex: backup_2026-07-08_10-30.sql): "

if not exist "backups\%ARQUIVO%" (
    echo.
    echo Arquivo nao encontrado em backups\%ARQUIVO%
    pause
    exit /b 1
)

echo.
set /p CONFIRMA="Tem certeza que deseja restaurar '%ARQUIVO%'? Isso apaga os dados atuais. (S/N): "
if /i not "%CONFIRMA%"=="S" (
    echo Operacao cancelada.
    pause
    exit /b 0
)

echo.
echo Restaurando...
docker exec -i investimentos_postgres psql -U postgres -d investimentos < "backups\%ARQUIVO%"

if errorlevel 1 (
    echo.
    echo ERRO ao restaurar. Verifique se o Docker Desktop esta aberto
    echo e se o sistema esta rodando ^(docker compose ps^).
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Restauracao concluida!
echo ============================================
echo.
pause
