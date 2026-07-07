# Sistema Imobiliário "Estou em Casa" — Guia para o Claude Code

CRM + ERP para imobiliárias brasileiras. Monorepo: `backend/` (NestJS + Prisma +
PostgreSQL/Neon + Redis) e `frontend/` (Next.js 14 App Router + Tailwind/shadcn +
React Query + Zustand). Deploy: Railway, auto-deploy do branch `main`.

> **Estado detalhado, backlog e checklist de ativação: leia `docs/HANDOFF.md` antes
> de qualquer trabalho novo.**

## Arquitetura essencial

- API com prefixo `/api/v1`; respostas de sucesso em `{ success, data, timestamp }`
  (TransformInterceptor) e erros em `{ statusCode, message, error, timestamp, path }`.
- Auth: JWT access+refresh (7d) em localStorage+cookies. Rotas do dashboard protegidas
  por `AuthGuard` client-side (middleware Next desabilitado de propósito — não reativar).
- Em produção o browser chama `/api-proxy/*`, que o Next rewrita para `BACKEND_URL`
  (runtime env). `NEXT_PUBLIC_API_URL` é fallback. Não hardcodar URLs.
- Multi-tenant por `X-Workspace-Id` + `WorkspaceGuard` (row-level security). O
  `WorkspaceGuard` e o `JwtAuthGuard` respeitam `@Public()`.
- Endpoints públicos por token HMAC stateless (assinatura `/sign/:token`, portal do
  proprietário `/owner-portal/:token`, feed VRSync). Segredo: `HMAC_SECRET`.
- Integrações externas são **env-gated**: sem credencial → modo simulado/registro
  interno; com credencial → chamada real que **propaga erro** (nunca fingir sucesso).
  Padrão em: Asaas (boleto/PIX/split), Focus NFe, WhatsApp Cloud API, SMTP.
- Crons (@nestjs/schedule): régua de cobrança (diária 08h, `DunningService`) e
  reajuste de aluguel IGP-M/IPCA via BCB SGS (mensal dia 1, `AdjustmentService`).

## Comandos

- Backend: `cd backend && npm run build && node dist/main.js` (dev local exige
  Postgres `plataforma_homolog` e as envs de `backend/.env`; secrets JWT ≥32 chars,
  `ENCRYPTION_KEY` = 64 hex — validação Zod derruba o boot se inválido).
- Migrations: `npx prisma migrate deploy` roda automaticamente no boot via
  `backend/start.sh` (que também auto-resolve migrations marcadas como falhas).
  Depois de mudar `schema.prisma`: `npx prisma generate` antes do tsc.
- Testes: `cd backend && npx jest` (specs em `src/**/*.spec.ts`).
- Frontend: `cd frontend && npx tsc --noEmit` e `npm run build` antes de commitar.

## Invariantes de segurança (NUNCA violar)

- Toda query filtra por `workspaceId`; soft delete (`deletedAt`), nunca DELETE físico.
- Nunca logar CPF/CNPJ/telefone/e-mail/senha/token; nunca expor stacktrace em produção.
- Nunca commitar `.env` real nem secrets no código.
- Webhooks públicos exigem validação (HMAC/token); e-signature/OTP: `otp_dev` só
  aparece fora de produção.
- Falha de entrega (e-mail/WhatsApp/gateway) deve virar erro visível, nunca status
  de sucesso gravado sem confirmação.

## Armadilhas conhecidas

- Ao editar uma migration já aplicada localmente, `migrate deploy` segue ok; em
  produção o `start.sh` auto-resolve `unique_contact_document` (P3009 histórico).
- CPF/CNPJ/e-mail vazios devem ser normalizados para NULL (índices únicos parciais
  em contacts tratam '' como valor).
- Código sequencial de contrato (`C-{ano}-{NNNN}`) usa findFirst+parse na transação;
  sob alta concorrência considerar sequence do Postgres.
- `saleValue` em contratos BROKERAGE guarda o **valor da negociação** (base da
  comissão); o contas a receber da intermediação é a comissão, não a negociação.
