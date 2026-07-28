# HANDOFF — Estado do projeto e próximos passos

> Atualizado em 2026-07-07 (sessão Claude Fable 5). Leia junto com o `CLAUDE.md` da raiz.
> Objetivo: qualquer sessão futura retomar o trabalho sem perder contexto.

## URLs de produção (Railway, deploy automático do `main`)

- Frontend: https://hospitable-consideration-production-b9ce.up.railway.app
- Backend:  https://sistema-imobili-rio-estou-em-casa-production.up.railway.app/api/v1
- Diagnóstico do proxy: `<frontend>/api/debug-connection`
- Banco: Neon PostgreSQL (via `DATABASE_URL` no serviço backend)

## O que está PRONTO e testado (E2E em homolog local)

### Núcleo
- CRM (contatos com dedup CPF/CNPJ 409, pipeline, tarefas), imóveis (código P-ANO-NNNN),
  contratos (código C-ANO-NNNN, criação atômica com $transaction, validação por tipo).
- Tipos de contrato: SALE, RENTAL_*, BROKERAGE (valor da negociação em `saleValue`,
  contas a receber = comissão total).
- Templates de documento: Compra e Venda (com cláusulas de split e DIMOB), Locação
  Residencial, Locação Não Residencial de **Barracão/Galpão** (15 cláusulas) e de
  **Sala Comercial** (seções I–VII, cláusulas 1–20, com fiadores solidários, condomínio,
  seguro incêndio e direito de preferência). Roteados em
  `contract-template.service.generate()` pelo campo `contracts.templateKey`
  (RENTAL_WAREHOUSE | RENTAL_COMMERCIAL_ROOM); vazio = automático pelo tipo do imóvel.
- Assinatura eletrônica nativa: envelope → e-mail com link → portal `/sign/:token` →
  OTP (por e-mail em produção) → assinado, com trilha de auditoria.

### Split de comissão (corretores parceiros)
- No contrato: `partnerSplits[{contactId, percentage}]` → cria SplitRecipient
  (find-or-create do contato) + SplitRule (% da comissão). Soma ≤ 100%.
- Gestão em `/partners` (dados bancários/PIX + habilitação KYC).
- Ao receber comissão (`PATCH /financial/commissions/:id/receive`): gera
  SplitTransactions automaticamente; botão "Processar Repasse" para comissões antigas
  (idempotente); "Confirmar pagamento" executa transferência PIX real via Asaas
  quando gateway ativo (senão confirmação manual).

### Fiscal
- DIMOB por declarante com rateio PJ/PF (COSIT 237/2019): PJ tem registro próprio
  proporcional; PF autônomo soma na imobiliária (`dimob.calc.ts`, puro + testes).
  Registro automático na criação de venda/intermediação (data de assinatura).
- Exportação: JSON+CSV (`GET /fiscal/dimob/export`) e arquivo PGD TXT posicional
  (`GET /fiscal/dimob/pgd`) — larguras centralizadas em `dimob.pgd.ts`;
  **validar 1º arquivo no PGD com contador**. UI na página Fiscal → aba DIMOB.
- NFSe: env-gated Focus NFe (`FOCUS_NFE_TOKEN` + `FOCUS_NFE_ENV`); sem token,
  registro interno. Status: `GET /fiscal/nfse/:id/status`.

### Financeiro/Cobrança
- Boleto: env-gated Asaas (gateway ASAAS ativo em /billing/gateways → emissão real
  com linha digitável/PIX/bankSlipUrl e split bancário por walletId); sem gateway,
  simulado. Webhook: `POST /billing/webhook/:workspaceId` (formato Asaas suportado).
- Régua de cobrança (`DunningService`, cron 08h + `POST /financial/dunning/run`):
  OVERDUE automático, lembretes D-3/D0, cobranças 1/7/15 dias de atraso.
- Reajuste de aluguel (`AdjustmentService`, cron mensal + preview/run manual):
  IGP-M/IPCA acumulado 12m via BCB SGS (séries 189/433), 1x/ano por contrato
  (`lastAdjustedAt`), auditado; `{rate}` manual quando BCB indisponível.

### Portais/Marketing
- Feed VRSync (ZAP+/VivaReal/OLX): `GET /marketing/portals/feed/:workspaceId/:token.xml`
  (público, HMAC) + `GET /marketing/portals/feed-url` (autenticado). Definir
  `BACKEND_PUBLIC_URL` para a URL completa.
- WhatsApp Cloud API: envio real via Graph (config por workspace: phoneNumberId +
  accessToken); erros da Meta agora propagam (sem sucesso falso).

### Outros
- Portal do Proprietário: `GET /contracts/:id/owner-portal-url` → página pública
  `/owner-portal/:token` com extrato (recebido/comissões/despesas/repasse).
- Precificação assistida: `GET /properties/:id/price-suggestion` (mediana preço/m²
  de comparáveis mesmo tipo/cidade, área ±35%) + card no detalhe do imóvel.
- Dashboard com KPIs reais (`/reports/dashboard`).

## CHECKLIST DE ATIVAÇÃO EM PRODUÇÃO (configuração, não código)

| Recurso | Ação |
|---|---|
| SMTP (assinatura, régua, e-mails) | `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` no backend (Gmail: senha de app). Testar `GET /email/smtp-health` |
| Asaas (boleto/PIX/split real) | Conta Asaas sandbox → API key em Boletos→Gateways (`provider ASAAS`, default). Webhook → `/api/v1/billing/webhook/{workspaceId}` |
| Focus NFe (nota na prefeitura) | `FOCUS_NFE_TOKEN` + `FOCUS_NFE_ENV=homologacao` (exige certificado A1 na Focus) |
| WhatsApp | phoneNumberId + accessToken (Meta Business) via `PUT /whatsapp/config` |
| Portais | Colar URL de `GET /marketing/portals/feed-url` no painel do portal; definir `BACKEND_PUBLIC_URL` |
| Anti-cold-start | UptimeRobot ping 5min em `<backend>/api/v1/health` |
| CNPJ da imobiliária | Preencher no Workspace (aparece nos contratos/DIMOB) e TaxConfig (`POST /fiscal/config`) |
| DIMOB | Registrar eventos de contratos antigos: `POST /fiscal/dimob/contracts/:id/register` |

## BACKLOG — próximos passos (em ordem sugerida)

1. **Validação em produção** do fluxo completo: contrato → boleto → comissão →
   repasse → DIMOB → portal do proprietário. Corrigir o que aparecer.
2. **Qualificação de leads por IA** (env-gated `ANTHROPIC_API_KEY`): scoring/resumo
   das conversas do hub, sugestão de imóveis por perfil.
3. **Tela de configuração de gateway** mais amigável (hoje só via API/DTO).
4. **Locação — eventos DIMOB mensais automáticos**: chamar
   `dimob.registerRentalMonthEvent` quando parcela de aluguel for marcada PAID
   (hoje o método existe mas não é chamado automaticamente).
5. **Análise de crédito/seguro-fiança**: aguarda contrato com parceiro
   (CredPago/Loft) — criar `CreditProvider` plugável no padrão do split.
6. **Módulo incorporadora** (SAC/Price, repasse Caixa): decisão de produto antes.
7. Hardening: sequence Postgres p/ códigos de contrato; retry/fila (BullMQ) nos
   envios; assinatura com carimbo de tempo/ICP opcional (Clicksign).

## Ambiente da sessão (reinício de container)

Se o container reiniciar, o repositório pode ser reclonado na branch designada
(`claude/great-bardeen-rylpmg`), que está **desatualizada** — o trabalho vive em `main`.
Antes de qualquer coisa: `git fetch origin main && git checkout main`. O restart também
zera `node_modules` (rodar `npm install` em `backend/` e `frontend/`) e o Postgres local
(recriar user `homolog`/`homolog123` + base `plataforma_homolog`, `prisma migrate deploy`
e `npm run seed`). Use `./node_modules/.bin/prisma` — `npx prisma` baixa a v7, que rejeita
o schema (datasource `url`).

## Dívidas/atenções conhecidas

- `payCommission` (legado) delega a `receiveCommission`.
- E-mails da régua reenviam se o job rodar 2x no mesmo dia (aceito; disparo manual
  é para teste). Se incomodar: registrar envio por entry+dia.
- Focus NFe/Asaas nunca foram exercitados com credencial real — validar em sandbox
  no primeiro uso (o código propaga o erro do provedor com clareza).
- `Provider/Email` do feed VRSync usa e-mail placeholder — trocar pelo do workspace.
- Credenciais de homolog local: `admin@teste.com` / `Admin@123` (banco local
  `plataforma_homolog`, user `homolog`/`homolog123`).
