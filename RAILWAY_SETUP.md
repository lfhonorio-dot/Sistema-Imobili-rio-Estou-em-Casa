# Configuração no Railway

Guia das variáveis de ambiente dos serviços **backend** e **frontend**.
Os segredos (JWT/ENCRYPTION/HMAC) NÃO ficam neste arquivo — gere-os com
`openssl rand -hex 32` e cole apenas no painel do Railway.

---

## 1. Serviço FRONTEND

| Variável | Valor | Obrigatório |
|---|---|---|
| `BACKEND_URL` | `https://SEU-BACKEND.up.railway.app/api/v1` | ✅ Sim — sem isso o app não fala com a API |

> A URL do backend está em: Railway → serviço backend → Settings → Networking → Public Domain.
> Lembre de incluir o sufixo `/api/v1`.

---

## 2. Serviço BACKEND

### 2.1 Obrigatórias (o app NÃO sobe sem elas)

| Variável | Como obter | Regra |
|---|---|---|
| `DATABASE_URL` | Referência do Postgres do Railway: `${{Postgres.DATABASE_URL}}` | string |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` | ≥ 32 caracteres |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` | ≥ 32 caracteres |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | exatamente 64 hex |
| `HMAC_SECRET` | `openssl rand -hex 32` | ≥ 32 caracteres |

### 2.2 URLs (CORS + links de assinatura)

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://SEU-FRONTEND.up.railway.app` |
| `APP_URL` | `https://SEU-FRONTEND.up.railway.app` |

> `APP_URL` é usada para montar o link `/sign/{token}` enviado por e-mail.

### 2.3 E-mail / SMTP (necessário para assinatura e notificações)

| Variável | Exemplo (Gmail) |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `seu@gmail.com` |
| `SMTP_PASS` | senha de app do Google (16 dígitos) |
| `SMTP_FROM` | `"Imobiliária <seu@gmail.com>"` |

> Gmail: ative verificação em 2 etapas → "Senhas de app" → gere uma para "Correio".
> Teste depois em `GET /api/v1/email/smtp-health` (autenticado): deve retornar `ok: true`.

### 2.4 Opcionais (têm default, mas recomendado)

| Variável | Valor |
|---|---|
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (se houver serviço Redis) |

---

## 3. Migrations (automático)

Não é necessário rodar nada manualmente. No deploy, `start.sh` executa
`npx prisma migrate deploy` antes de iniciar o servidor, aplicando todas
as migrations pendentes.

---

## 4. Checklist pós-deploy

- [ ] `https://SEU-FRONTEND/api/debug-connection` → `backendStatus: "ok"`
- [ ] `GET /api/v1/email/smtp-health` → `ok: true`
- [ ] Login funciona sem loop de redirect
- [ ] Criar contrato de venda → financeiro + comissão gerados
- [ ] Solicitar assinatura → e-mail chega com botão "Assinar Documento"
