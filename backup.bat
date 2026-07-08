@echo off
chcp 65001 >nul
echo ============================================
echo   Backup do Sistema de Investimentos
echo ============================================
echo.

cd /d "%~dp0"
if not exist "backups" mkdir backups

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set ANO=%dt:~0,4%
set MES=%dt:~4,2%
set DIA=%dt:~6,2%
set HORA=%dt:~8,2%
set MIN=%dt:~10,2%
set ARQUIVO=backups\backup_%ANO%-%MES%-%DIA%_%HORA%-%MIN%.sql

echo Gerando backup em: %ARQUIVO%
echo.

docker exec investimentos_postgres pg_dump -U postgres -d investimentos > "%ARQUIVO%"

if errorlevel 1 (
    echo.
    echo ERRO ao gerar backup. Verifique se o Docker Desktop esta aberto
    echo e se o sistema esta rodando ^(docker compose ps^).
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Backup concluido com sucesso!
echo   Arquivo: %ARQUIVO%
echo ============================================
echo.
echo Guarde esse arquivo em lugar seguro ^(ex: Google Drive, OneDrive^).
echo.
pause
