# Zerar o banco de dados (começar do zero)

**Para que serve:** apagar TODOS os dados do sistema — imobiliárias, usuários, clientes, imóveis, contratos,
financeiro, notas — para começar a operar com dados reais num sistema limpo.

**Quando usar:** uma vez, **depois** de terminar a homologação e **antes** de cadastrar o primeiro dado real.

> ⚠️ **Depois que o sistema tiver dados reais, NUNCA rode o `zerar-banco.bat`.** Ele apaga tudo, sem distinguir
> teste de real. A única proteção é a frase de confirmação e o backup que ele faz antes.

## Como fazer a homologação sem precisar zerar antes

Não é preciso zerar o banco para homologar "do zero". Cada imobiliária cadastrada nasce vazia e não enxerga os
dados das outras:

1. Abra o sistema numa **janela anônima** e crie uma conta nova: "Imobiliária HOMOLOGAÇÃO", com um e-mail de teste
   (no Gmail funciona `seuemail+teste@gmail.com` — chega na sua caixa normal).
2. Faça nela todo o `docs/CHECKLIST-HOMOLOGACAO.md` (Asaas em **Sandbox**, nota fiscal em **homologação**).
3. Para os usuários de teste use também e-mails `+teste`. Cada e-mail só pode existir uma vez no sistema.

Terminou e está tudo certo? Aí sim, siga os passos abaixo para limpar tudo.

## Passo a passo para zerar

Reserve uns 20 minutos, num horário em que ninguém esteja usando o sistema. Precisa de **Git** e **Docker Desktop**
abertos (o mesmo dos scripts `validar-fase-N.bat`).

### Passo 1 — Atualize a pasta do projeto

Abra o **Prompt de Comando** na pasta do projeto e rode:

```bash
git checkout main
```

```bash
git pull origin main
```

→ Devem existir na pasta os arquivos `zerar-banco.bat` e `scripts\zerar-banco.sh`.

Confirme também, no Railway (backend → Deployments), que o deploy mais recente está **ACTIVE** e que ele já inclui
a correção "start em banco vazio" (o Pull Request que trouxe este documento precisa estar mesclado).

### Passo 2 — Pegue o endereço público do banco

**Se o banco está no Railway** (existe uma caixa "Postgres" no desenho do projeto):
1. Clique na caixa **Postgres** → aba **Variables**.
2. Procure **`DATABASE_PUBLIC_URL`** → clique no ícone de copiar.
   (Tem de ser a *PUBLIC*. A `DATABASE_URL` comum termina em `.railway.internal` e só funciona dentro do Railway.)

**Se o banco está no Neon** (neon.tech):
1. Entre no painel do Neon → seu projeto → **Dashboard** → **Connect**.
2. Copie a "Connection string" (começa com `postgresql://`).

→ O endereço começa com `postgresql://` e contém a senha do banco. **Não envie esse endereço para ninguém**, nem
cole em conversas.

### Passo 3 — Rode o script

1. Dê dois cliques em **`zerar-banco.bat`**.
2. Leia o aviso e aperte uma tecla.
3. Cole o endereço do banco (botão direito do mouse cola) e aperte Enter.
4. Digite `APAGAR TUDO` (em maiúsculas) e aperte Enter.

→ O script mostra, em ordem:
- `[1/4] conectado em ...` — conseguiu chegar ao banco;
- `[2/4] Backup salvo (... bytes)` — o backup foi feito na pasta **`backups`** do projeto;
- `[3/4]` — quantas imobiliárias, usuários, clientes e contratos existiam;
- `[4/4] Apagando tudo...` e, por fim, **`BANCO ZERADO`**.

Se aparecer **ERRO** com a frase "Nada foi apagado", o banco está intacto: copie a tela e envie ao desenvolvedor.
Se você errar a frase de confirmação, ele cancela sem apagar nada.

A partir deste momento o site mostra erro — é esperado, até o passo 4.

### Passo 4 — Recrie as tabelas (redeploy do backend)

1. Railway → serviço do **backend** → aba **Deployments**.
2. No deploy que está **ACTIVE**, clique nos **três pontinhos (⋮)** → **Redeploy** → confirme.
3. Espere ficar **ACTIVE** de novo (3 a 5 minutos).

→ Em **View logs** aparece a linha `Banco vazio (sem a tabela workspaces): pulando o baseline; as migrations criam
tudo do zero.` e depois `All migrations have been successfully applied.`

Se o deploy ficar vermelho, **não rode o script de novo**: mande um print dos logs ao desenvolvedor. O backup do
passo 3 permite voltar ao estado anterior.

### Passo 5 — Crie a imobiliária de verdade

1. Abra o site (Ctrl + F5). Você estará deslogado — todas as contas antigas deixaram de existir.
2. Clique em criar conta e cadastre a imobiliária real, com o seu e-mail verdadeiro.
3. Configure, nesta ordem (é a Parte A do checklist, agora "valendo"):
   - **Configurações → Workspace:** CNPJ e dados da imobiliária; perfil **Venda**.
   - **Configurações → Usuários e papéis:** convide a equipe com os e-mails reais.
   - **Financeiro → Boletos e PIX:** Asaas de **Produção** (chave nova) e o webhook novo
     (o endereço do webhook muda, porque a imobiliária é nova).
   - **Notas Fiscais → Configuração fiscal:** dados fiscais, certificado A1 e, quando o contador liberar,
     "Autorizar notas reais".

## O que este procedimento NÃO apaga

- As variáveis do Railway (continuam as mesmas).
- Cobranças já criadas no **Asaas** e notas já enviadas à **prefeitura** (por isso a homologação usa Sandbox e
  ambiente de homologação).
- A pasta `backups` no seu computador. Ela contém dados pessoais dos testes: guarde em local seguro ou apague
  quando não precisar mais. Ela **não** é enviada ao GitHub.

## Se precisar voltar atrás

O arquivo `backups\backup-antes-de-zerar-AAAAMMDD-HHMMSS.sql.gz` é uma cópia completa do banco de antes da
limpeza. Restaurar é um procedimento técnico — chame o desenvolvedor e informe o nome do arquivo.

## Detalhe técnico (para o desenvolvedor)

- `backend/start.sh` fazia `prisma migrate resolve --applied` das 8 primeiras migrations sempre. Em banco vazio isso
  as marcava como aplicadas sem criar as tabelas, e o `migrate deploy` seguinte falhava. Agora o baseline só roda
  quando a tabela `workspaces` já existe; em banco vazio as migrations rodam todas, do zero.
- `backend/scripts/start.sh` passou a chamar `../start.sh` (uma lógica só).
- O workflow `fluxo-de-ouro.yml` sobe o backend pelo `start.sh` em banco vazio, então esse caminho é testado a cada PR.
- `scripts/zerar-banco.sh`: `pg_dump` (validado com `gzip -t` e tamanho mínimo) → `DROP SCHEMA public CASCADE` →
  `CREATE SCHEMA public`. Aborta sem apagar se o backup falhar.
