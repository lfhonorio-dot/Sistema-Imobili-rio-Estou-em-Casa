@echo off
chcp 65001 >nul
echo ============================================================
echo   Estou em Casa - ZERAR O BANCO DE DADOS
echo ============================================================
echo.
echo   ATENCAO: este script APAGA TODOS OS DADOS do sistema:
echo   imobiliarias, usuarios, clientes, imoveis, contratos,
echo   financeiro, notas fiscais - TUDO.
echo.
echo   Use SOMENTE antes de comecar a operar com dados reais.
echo   Antes de apagar, ele salva um backup na pasta "backups".
echo.
echo   Leia antes: docs\ZERAR-BANCO.md
echo   Precisa: Docker Desktop aberto (icone da baleia verde).
echo.
pause

cd /d "%~dp0"
if not exist backups mkdir backups

echo.
echo Cole aqui o endereco PUBLICO do banco (comeca com postgresql://)
echo e aperte Enter. Onde pegar: docs\ZERAR-BANCO.md, passo 2.
set "DBURL="
set /p "DBURL=Endereco do banco: "
if "%DBURL%"=="" goto cancelado

echo.
echo Para confirmar, digite exatamente (em maiusculas):  APAGAR TUDO
set "CONF="
set /p "CONF=Confirmacao: "
if not "%CONF%"=="APAGAR TUDO" goto cancelado

echo.
docker run --rm -e "DATABASE_URL=%DBURL%" -e "CONFIRMA=APAGAR TUDO" -v "%cd%\backups":/backup -v "%cd%\scripts":/s:ro postgres:17-alpine sh /s/zerar-banco.sh
if errorlevel 1 goto erro

echo.
echo ============================================================
echo   BANCO ZERADO. O backup esta na pasta "backups".
echo.
echo   AGORA: no Railway, faca o REDEPLOY do backend
echo   (docs\ZERAR-BANCO.md, passo 4). Ele recria as tabelas.
echo   Depois crie a conta da imobiliaria no site.
echo ============================================================
echo.
pause
exit /b 0

:cancelado
echo.
echo Cancelado. NADA foi apagado.
pause
exit /b 1

:erro
echo.
echo O script parou com ERRO. Leia as mensagens acima: se aparecer
echo "Nada foi apagado", o banco esta intacto. Copie a tela e envie
echo para o desenvolvedor.
pause
exit /b 1
