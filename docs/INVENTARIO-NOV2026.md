# INVENTÁRIO — Novembro/2026 (Fase 0, somente leitura)

> Gerado em 14/11/2026 a partir da `main` no commit `2b509e8` (merge do PR #9).
> Nenhum arquivo de código foi alterado nesta fase. As evidências são `arquivo:linha`
> na `main`. "Tela ligada" = existe página do frontend que chama o endpoint.
>
> Verificação técnica feita nesta fase (na `main`, sem alterações):
> - backend `npm run build` → OK · `tsc --noEmit` → OK · `jest` → **7 suítes, 43 testes, 43 passando**
> - frontend `tsc --noEmit` → OK
> - Os testes em `backend/test/*.e2e-spec.ts` (6 arquivos) **não rodam** em nenhum script nem no CI
>   (`.github/workflows/backend-tests.yml` roda só `npx jest`, que olha `src/`).

Legenda da coluna "Ponta a ponta": **SIM** funciona inteiro · **PARCIAL** funciona com lacunas
relevantes · **STUB** finge que funciona (retorna sucesso sem executar) · **NÃO** não existe.

---

## a) Tabela de funções

| # | Função | Endpoint no backend? | Tela ligada? | Teste automatizado? | Ponta a ponta | Evidência e observações |
|---|---|---|---|---|---|---|
| 1 | Cadastro de imóveis | SIM | SIM | NÃO | **PARCIAL** | CRUD em `backend/src/modules/erp/properties/properties.controller.ts:39-148`. Só **um** proprietário (`schema.prisma:617` `ownerId`). Não existe autorização de venda (data, validade, exclusividade, % comissão, captador), controle de chaves nem histórico de preço. Fotos são só URLs (`properties.service.ts:410-419`) — não há upload/armazenamento de arquivo no sistema. Documentos (`documents.controller.ts`) não têm tela. |
| 2 | Cadastro de clientes | SIM | SIM | NÃO | **PARCIAL** | `contacts.controller.ts:46-171`. Tem PF/PJ (`schema.prisma:312`) e origem (`:335`). Falta cônjuge, regime de bens, perfil de interesse. Busca de CEP é "em breve" (`frontend/components/crm/contact-form.tsx:47,223`). Importação/exportação existem no backend (`contacts.controller.ts:63,78`) sem tela. |
| 3 | Funil (pipeline/negócios) | SIM | SIM | NÃO | **PARCIAL** | `deals.controller.ts:37-101`, `pipelines.controller.ts`. Motivo de perda já é obrigatório (`deals.service.ts:251`). "Ganho" **não** abre contrato (`deals.service.ts:290-294`, só `console.log`). Não há filtro "meus negócios" na tela (backend aceita `assigneeId`, `deals.service.ts:49`). Etapas padrão de venda não existem — são criadas manualmente em `/settings/pipelines`. |
| 4 | Tarefas | SIM | SIM | NÃO | **PARCIAL** | `activities.controller.ts:36-93`. Filtro por responsável é ignorado: DTO tem `assigneeId` (`activities.dto.ts:104`) mas o serviço não usa (`activities.service.ts:33-43`). Bug: `startDate` e `endDate` juntos — o segundo sobrescreve o primeiro (`activities.service.ts:39-40`). |
| 5 | Visitas | Só como tipo de atividade | Só no formulário de tarefa | NÃO | **NÃO** | Visita = atividade `type: VISIT` (`frontend/components/crm/task-form.tsx:76`). Não tem vínculo com imóvel (`schema.prisma:521-543` sem `propertyId`), nem corretor, nem retorno do cliente, nem tela própria. Calendário existe só no backend (`activities.controller.ts:45`). |
| 6 | Propostas | NÃO | NÃO | NÃO | **NÃO** | Não existe modelo `Proposal` no `schema.prisma`. Contrato tem só `proposalDate` (`schema.prisma:697`). |
| 7 | Contrato de venda | SIM | SIM | NÃO | **PARCIAL** | Criação atômica em `contracts.service.ts:168-450`. Problemas: (1) contrato `SALE` lança a receber **o valor total da venda** como se a imobiliária recebesse o dinheiro do imóvel (`contracts.service.ts:289-302`); só o tipo `BROKERAGE` lança a comissão (`:306-322`). (2) comissão do corretor é atribuída a **quem criou o contrato**, não ao corretor vendedor/captador (`:326-345`). (3) não gera contas **a pagar** de comissão para corretores internos. (4) imóvel só vira "vendido" ao mudar status (`:814-905`), não na criação. (5) rescisão devolve o imóvel e apaga a DIMOB, mas **não** cancela/estorna lançamentos, comissões nem boletos (`:814-930`). (6) falha ao gerar parcelas aparece como **sucesso** na tela (`frontend/app/(dashboard)/contracts/new/page.tsx:143-145`). |
| 8 | Assinatura eletrônica | SIM | SIM | NÃO | **PARCIAL** | Nativa: envelope → e-mail → `/sign/:token` → OTP → assinado (`esignature.controller.ts:26-120`). Quando todos assinam, o envelope vira `COMPLETED` (`esignature.service.ts:336`) mas o **contrato não é atualizado** (sem `signedAt`/ativação). Depende de SMTP funcionando. |
| 9 | Contas a receber | SIM | SIM | SIM (`financial.service.spec.ts`) | **PARCIAL** | `financial.controller.ts:49-163`. Lançamento manual existe (PR #9). Falta: baixa parcial (`payEntry` sempre marca `PAID`, `financial.service.ts:157-172`), cancelar com motivo, estorno, juros/multa/desconto na baixa, recorrência, comprovante. Editar/excluir existem no backend (`:144,154`) sem tela. Baixa manual de um lançamento com boleto **não** cancela o boleto. |
| 10 | Boletos | SIM | SIM | SIM (`billing.service.spec.ts`) | **PARCIAL** | Emissão real só com gateway **ASAAS** ativo (`billing.service.ts:149-221`). Sem gateway → boleto **simulado com linha digitável e PIX falsos** (`:224-251`); com gateway de outro provedor (EFI, PAGARME…) → também cai no simulado, mas marcado `REGISTERED` (`:248`). Reemissão cancela só no banco local, **não no Asaas** (`:265-288`); não há endpoint de cancelamento. Não há tela de configuração de gateway (só API `POST /billing/gateways`). Baixa por webhook: ver item (e). |
| 11 | PIX cobrança | NÃO (só embutido no boleto) | NÃO | NÃO | **NÃO** | Não existe cobrança PIX avulsa (`billingType: 'PIX'`). O único PIX é o QR Code que o Asaas devolve junto do boleto (`asaas.client.ts:97,108-121`). |
| 12 | Contas a pagar | SIM | SIM | SIM (parcial) | **PARCIAL** | Mesmo modelo `FinancialEntry type=PAYABLE`; botão de pagar (PR #6). Mesmas lacunas do item 9. Não há cadastro de fornecedores/favorecidos. |
| 13 | Fluxo de caixa | SIM | SIM | NÃO | **PARCIAL** | `reports.controller.ts:60` (`reports.service.ts:212`) e previsão 30/60/90 dias (`financial.service.ts:244-274`, só a receber). Falta realizado × projetado diário, por conta bancária, saldo inicial e exportação Excel. |
| 14 | Bancário (razão / importação / conciliação) | PARCIAL | PARCIAL | NÃO | **PARCIAL** | Contas, lançamentos manuais e conciliação manual/automática existem (`banking.controller.ts:25-126`). Importação OFX existe **só no backend** — a tela não chama `POST /banking/ofx/import`. Não há importação de planilha nem "razão" bancário. Open Finance é stub (`banking.service.ts:266-274`). A branch `feat/bancario-razao-conciliacao` **não existe** no GitHub (ver item d). |
| 15 | NFS-e | SIM | SIM (aba Fiscal) | SIM (`fiscal.service.spec.ts`, só DIMOB/config) | **STUB sem token / PARCIAL com token** | `fiscal.service.ts:61-140`. Sem `FOCUS_NFE_TOKEN` a nota é gravada como **`ISSUED` (emitida) sem ir à prefeitura** (`:83-84`) — sucesso fabricado. Com token, integra direto com Focus NFe (nunca testado com credencial real, segundo o HANDOFF). Valores em `Float` (`schema.prisma:1296-1298`). Alíquota ISS cai em 5% fixo no código se não houver config (`:63`). |
| 16 | Comissões | SIM | SIM | SIM (`financial`, `split`) | **PARCIAL** | Recebimento da comissão + recibo + repasse a parceiros (`financial.service.ts:350-470`, `split.service.ts`). Não existe comissão **a pagar** ao corretor vendedor/captador interno; rateio só para "parceiros" via split. |
| 17 | DIMOB de vendas | SIM | SIM (aba DIMOB) | SIM (`dimob.calc.spec.ts`, `dimob.pgd.spec.ts`) | **PARCIAL** | Geração de registros, CSV/JSON e arquivo PGD (`fiscal.controller.ts:29-58`). Layout **nunca validado no PGD da Receita** (HANDOFF). Registros são **apagados fisicamente** na rescisão/regeração (`dimob.service.ts:47,80,131`) — viola a regra de soft delete. Valores em `Float` (`schema.prisma` DimobRecord). Registro feito fora da transação do contrato (`contracts.service.ts:431-437`). |
| 18 | Relatórios | SIM | SIM | NÃO (e2e fora do CI) | **PARCIAL** | 10 relatórios em `reports.controller.ts:12-81`. Não há VGV, tempo médio de venda, ranking de corretores, imóveis sem movimento, autorizações a vencer; sem exportação Excel/PDF. |
| 19 | Permissões por papel | PARCIAL | PARCIAL (`/settings/users`) | SIM só p/ admin de plataforma | **PARCIAL** | `RolesGuard` só é aplicado em LGPD, usuários, workspace e auditoria (`lgpd.controller.ts:45`, `users.controller.ts:68-108`). **Financeiro, contratos, gateways, CRM: qualquer membro do workspace acessa tudo**, inclusive trocar a API key do gateway (`billing.controller.ts:34-57`). Não existe visão restrita de Corretor. |
| 20 | Notificações | SIM (2 módulos) | NÃO | NÃO | **STUB** | O sino é um botão sem ação (`frontend/components/layout/header.tsx:32-35`); o hook `use-notifications.ts` não é usado em nenhuma tela. Nenhum código do backend cria notificação (`hub/notifications/notifications.service.ts:20` nunca é chamado). `POST /notifications/send` devolve "enviado" sem gravar nada (`notifications/notifications.service.ts:46-64`). |
| 21 | Inbox (Caixa de Entrada) | SIM | SIM | NÃO | **PARCIAL** | `conversations.controller.ts`; envio real por WhatsApp Cloud API/e-mail (`conversations.service.ts:157-205`). Depende de configurar WhatsApp (phoneNumberId + token) e SMTP. |
| 22 | LGPD | SIM | PARCIAL (só políticas) | NÃO | **PARCIAL** | Exportação e anonimização **não tocam no cadastro do contato** (ver item c). Tela `/settings/lgpd` só usa `GET /lgpd/policies`. `marketingConsent` é gravado mas não consultado por ninguém. |

---

## b) TODOs, stubs, "simular" e sucessos fabricados ainda presentes

**Retornam sucesso sem executar (violam a regra 5):**
1. `backend/src/modules/automation/automation.service.ts:74-76` — automação marca cada passo como `SUCCESS` sem executar nada.
2. `backend/src/modules/notifications/notifications.service.ts:46-64` — "notificação enviada" sem gravar nem enviar.
3. `backend/src/modules/marketing/meta-ads/meta-ads.service.ts:227-231` — Conversions API responde `{ sent: true }` sem chamar a Meta.
4. `backend/src/modules/marketing/meta-ads/meta-ads.service.ts:123-136` e `google-ads/google-ads.service.ts:104-114` — "sincronizar campanhas" grava campanhas **inventadas** (gasto, cliques, leads) no banco.
5. `backend/src/modules/erp/split/split.service.ts:79-90` — "KYC" aprova o recebedor só por ter os campos preenchidos (nenhuma verificação real).
6. `backend/src/modules/erp/billing/billing.service.ts:224-251` — boleto simulado com linha digitável, código de barras e PIX copia-e-cola **falsos**; com gateway não-Asaas ainda grava `REGISTERED`.
7. `backend/src/modules/erp/fiscal/fiscal.service.ts:83-84` — NFS-e sem provedor grava `ISSUED`.
8. `frontend/app/(dashboard)/contracts/new/page.tsx:143-145` — erro ao gerar parcelas é mostrado como `toast.success`.
9. `backend/src/modules/erp/contracts/contracts.service.ts:459-494` — geração automática de boletos ao criar contrato (sem gateway, gera os boletos falsos do item 6) sem avisar o usuário de falhas.
10. `backend/src/modules/erp/contracts/contracts.service.ts:560-567` — falha no e-mail do contrato é engolida sem registro visível.
11. `backend/src/modules/erp/billing/billing.service.ts:340-344` — retorno CNAB sempre marcado `PROCESSED`, mesmo com erros; parser "simplificado" (`:463`).

**Stubs declarados / "em implementação":**
12. `backend/src/modules/erp/banking/banking.service.ts:266-274` — Open Finance.
13. `backend/src/modules/crm/deals/deals.service.ts:290-294` — `TODO: Stage 4 - disparar automações de vitória`.
14. `frontend/components/crm/contact-form.tsx:47,223` — `TODO` busca de CEP.
15. `frontend/components/layout/header.tsx:32` — sino "(placeholder)".
16. `frontend/app/(dashboard)/page.tsx:77,134` — aviso "Primeiro acesso" e cartão de desenvolvimento "Estágio 1 Concluído".
17. `backend/src/modules/marketing/portals/portals.service.ts:79` — integração de portal "placeholder".
18. Feed VRSync com e-mail placeholder (anotado no HANDOFF).

---

## c) Achados GRAVES da revisão de setembro/2026 — situação hoje

| Achado | Situação | Evidência |
|---|---|---|
| LGPD — anonimização | **ABERTO** | `lgpd.service.ts:254-302` só anonimiza as tabelas de consentimento e requisição LGPD. O **contato** (nome, CPF, telefone, e-mail, endereço), negócios, mensagens e contratos ficam intactos. |
| LGPD — exportação | **ABERTO** | `lgpd.service.ts:213-247` exporta só consentimentos e requisições; não inclui o cadastro do contato, negócios, contratos, mensagens. Sem tela. |
| Bloqueio de conta por tentativas | **ABERTO** | Constantes existem (`auth.service.ts:48-50`, 20 tentativas/5 min) mas o login **nunca** incrementa nem verifica `failedLoginAttempts`/`lockedUntil` (`auth.service.ts:202-276`). Agravante: o `ThrottlerGuard` **não está registrado** (`app.module.ts:59-65` só importa o módulo; não há `APP_GUARD`), então o `@Throttle` do login (`auth.controller.ts:67`) **não tem efeito** — não há limite de tentativas algum. |
| E-mail em log | **PARCIAL** | O logger Nest passa pelo Winston com máscara (`config/logger.config.ts:11-16`, mostra 2 letras + domínio). Mas vários pontos usam `console.error` direto, sem máscara: `esignature.service.ts:151,269`, `contracts.service.ts:715`. E `auth.service.ts:767` loga o **link de redefinição de senha** (com token) em nível debug. Também `lgpd.service.ts:214,256`, `auth.service.ts:176,443,756,787` com e-mail (mascarado parcialmente). |
| `marketingConsent` ignorado | **ABERTO** | Só é lido/gravado em `contacts.service.ts:179,248`. Nenhum envio (e-mail, WhatsApp, automação) consulta o campo. |
| "Negócio Ganho" sem criar contrato | **ABERTO** | `deals.service.ts:290-294` (apenas `console.log`). Nenhuma tela leva do negócio ganho ao contrato. |
| Automações que não executam | **ABERTO** | `automation.service.ts:65-128` (sucesso fabricado; ver b.1). |
| Sino de notificações vazio | **ABERTO** | ver tabela, linha 20. |
| Webhooks de saída | **ABERTO** | Só o botão "testar" faz chamada (`integrations.service.ts:106-140`). Nenhum evento do sistema dispara os webhooks cadastrados (não há `emit`/`@OnEvent` no backend). |
| Conversions API | **ABERTO** | ver b.3. |
| KYC do split | **ABERTO** | ver b.5. |
| Cancelamento de boleto no Asaas | **ABERTO** | `asaas.client.ts` não tem método de cancelamento; `reissueBoleto` só cancela localmente (`billing.service.ts:265-271`). O boleto antigo continua pagável no banco. |
| Criptografia da API key com IV fixo | **ABERTO** | `billing.service.ts:532-537` e `asaas.client.ts:25-33`: AES-CBC com IV de zeros, chave = `HMAC_SECRET` cortado e **fallback hardcoded** `'homolog-secret-32-chars-here----'`. Já existe um `EncryptionService` correto (AES-GCM, IV aleatório) em `security/encryption.service.ts:28-60` que não é usado aqui. |
| Catch vazio no frontend | **PARCIAL** | Vazio de verdade: `components/providers/auth-initializer.tsx:35` e `lib/api.ts:176`; `hooks/use-admin.ts:17` e `hooks/use-automation.ts:66` devolvem `null` em silêncio. Outros ~18 `catch {}` mostram mensagem **genérica** ("Erro ao mover negócio") e descartam a mensagem do backend (ex.: `components/crm/kanban-board.tsx:75`, `deals/[id]/page.tsx:82`, `fiscal/page.tsx:57`). Listagens (contatos, imóveis, contratos) mostram "lista vazia" quando a API falha — não distinguem erro de rede (`contacts/page.tsx:47`, `properties/page.tsx:23`, `contracts/page.tsx:40`). |
| Falha silenciosa do `/auth/me` | **ABERTO** | `auth-initializer.tsx:16-35` engole o erro. Além disso o `AuthGuard` (`components/providers/auth-guard.tsx`) devolve `null` **ao lado** das páginas, que renderizam antes da checagem (`app/(dashboard)/layout.tsx:15-20`). No backend, `getMe` lança `Error` genérico → HTTP 500 em vez de 401/404 (`auth.service.ts:813`). |

**Outros achados graves encontrados nesta fase (não estavam na lista):**
- **Delete físico em dado de negócio**: DIMOB (`dimob.service.ts:47,80,131`), etapa do funil (`pipelines.service.ts:231`), papel (`workspace.service.ts:147`), membro do workspace (`users.service.ts:231`), etiquetas/campos personalizados, integrações de marketing.
- **Dinheiro em `Float`** ainda em: NFS-e, DIMOB, IRRF, carnê-leão, obrigações fiscais, regras de split, juros/multa do boleto, CNAB (`schema.prisma`, ver `awk` na seção Float). Converter exige **alterar colunas existentes** → precisa da sua autorização (regra 6).
- **Baixa por webhook/CNAB sem transação**: `confirmPayment` atualiza boleto e lançamento em duas operações separadas (`billing.service.ts:290-306`).

---

## d) Branches: mescladas × pendentes

Todos os 9 Pull Requests do repositório estão **fechados e mesclados** na `main`; **não há PR aberto**.

| Branch | Situação |
|---|---|
| `fix/homologacao-main` (PR #3), `fix/venda-financeiro-assinatura` (#4), `fix/bloqueantes-seguranca-financeiro` (#5), `fix/contas-a-pagar-botao-pagamento` (#6), `fix/decimal-boleto-split-banking` (#7), `feat/lancamento-manual-financeiro` (#9), `railway/fix-deploy-*` (#1, #2) | Mescladas |
| **`test/nivel-1-boleto-split-dimob-financeiro`** (testes nível 1) | **Mesclada** (PR #8, 17/09/2026). São os 43 testes que passam hoje. |
| **`feat/bancario-razao-conciliacao`** | **NÃO EXISTE** no GitHub. Nenhuma branch com esse nome ou com "razão" bancário. Se o trabalho foi feito, ficou em outra máquina e nunca foi enviado. |
| **Branch do envio de e-mail por API HTTP** | **NÃO EXISTE**. O backend envia e-mail só por SMTP (`nodemailer` em `hub/email/email.service.ts:17` e `auth/auth.service.ts:73`). |
| `claude/great-bardeen-rylpmg` / `claude/jolly-sagan-rkhkgu` | Tinham 1 commit fora da `main` ("resolve os 5 bugs críticos de homologação", 13/09), superado pelo PR #3. `jolly-sagan` foi realinhada à `main` nesta sessão; o commit antigo continua salvo em `great-bardeen`. |
| `claude/hopeful-gauss-qshmuv` | **Outro projeto** ("Sistema de Investimentos"), sem histórico em comum com este. Contém os únicos `.bat` do repositório (`atualizar.bat`, `backup.bat`, `restaurar.bat`), que usam `docker compose`, **não** `node:20-alpine`. Recomendo não mesclar. |

> Observação: o pedido cita "scripts `.bat` em container `node:20-alpine` já existentes no
> repositório". Na `main` **não há nenhum `.bat`**. Os scripts das próximas fases serão criados
> seguindo o padrão descrito (container `node:20-alpine`) e o estilo de mensagens de
> `hopeful-gauss/atualizar.bat`.

---

## e) Gateway de pagamento configurado de fato

**Pelo código, o único gateway que funciona de verdade é o Asaas.** O enum aceita
ASAAS, EFI, PAGARME, ZOOP, ITAU, BRADESCO, BB (`billing.dto.ts:9`), mas só existe cliente para o
Asaas (`asaas.client.ts`). Qual gateway está **cadastrado em produção** fica no banco
(tabela `payment_gateway_configs`), que esta sessão não acessa — precisa ser conferido por
você na API (`GET /billing/gateways`) ou pelo Railway. A própria tela de boletos avisa "modo
simulado" quando não há gateway (`financial/page.tsx:506`) e cita EFÍ, que **não está implementada**.

| Etapa | Boleto (Asaas) | PIX cobrança |
|---|---|---|
| Emissão | **SIM** — `billing.service.ts:149-221` (exige pagador com CPF/CNPJ) | **NÃO** avulso; só o QR do boleto |
| Baixa por webhook | **SIM**, com token `asaas-access-token` comparado em tempo constante (`billing.service.ts:390-431`). Só trata `PAYMENT_RECEIVED/CONFIRMED`; ignora estorno, exclusão e vencimento. Não roda em transação. Exige `webhookSecret` no gateway padrão — sem ele, o webhook é recusado (correto). | Pagamento do PIX embutido no boleto chega pelo mesmo webhook. |
| Cancelamento | **NÃO** — não existe chamada ao Asaas | **NÃO** |
| Testado com credencial real? | **Não** (HANDOFF: "nunca exercitados com credencial real") | — |

---

## f) Resumo em linguagem simples (1 página)

**O que funciona**
- Entrar no sistema, cadastrar clientes e imóveis, montar o funil de negócios e mover os cartões.
- Criar contrato de venda, gerar o documento (modelo oficial de Compromisso de Compra e Venda) e
  mandar para assinatura eletrônica com código por e-mail — **se o e-mail (SMTP) estiver configurado**.
- Lançar contas a pagar e a receber à mão e marcar como pagas.
- Emitir boleto de verdade **se** uma conta Asaas estiver cadastrada, e dar baixa automática quando
  o Asaas avisa o pagamento.
- Gerar o arquivo da DIMOB (ainda precisa ser conferido pelo contador no programa da Receita).
- Os 43 testes automáticos atuais passam e o sistema compila sem erro.

**O que funciona pela metade**
- **Contrato de venda**: lança a receber o **valor inteiro do imóvel**, como se a imobiliária fosse
  receber o dinheiro da venda — o certo é lançar só a **comissão**. A comissão vai para quem digitou
  o contrato, não para o corretor; não gera o que a imobiliária deve pagar aos corretores.
  Rescindir não cancela os lançamentos nem os boletos.
- **Assinatura**: quando todos assinam, o contrato não fica marcado como assinado.
- **Boleto**: sem Asaas, o sistema mostra um boleto **de mentira** (linha digitável inventada).
  Reemitir não cancela o boleto antigo no banco — o cliente pode pagar os dois.
- **Financeiro**: não tem pagamento parcial, juros/multa na baixa, cancelamento com motivo,
  estorno, recorrência, comprovante, fornecedores nem categorias configuráveis.
- **Bancário**: a conciliação existe, mas a importação de extrato não tem botão na tela.
- **Tarefas**: o filtro "minhas tarefas" não funciona.
- **Permissões**: qualquer usuário vê e altera tudo (financeiro, contratos, chave do gateway).
- **Telas**: quando dá erro, muitas mostram "lista vazia" ou uma mensagem genérica.

**O que não existe**
- Visitas como agenda própria; propostas; autorização de venda; controle de chaves;
  vários proprietários por imóvel; perfil de interesse e sugestão de imóveis.
- Cobrança PIX avulsa; cancelamento de boleto no Asaas.
- NFS-e real: sem provedor, a nota aparece como "emitida" **sem ter sido emitida**.
- Notificações (o sino é só um desenho), automações (fingem que rodam), webhooks de saída,
  Conversions API, KYC real.
- Bloqueio de conta por tentativas de senha — e o limite de tentativas por minuto também está desligado.
- LGPD: "apagar" e "exportar" os dados de um cliente não tocam no cadastro dele.
- As branches de "bancário razão/conciliação" e de "e-mail por API HTTP" não estão no GitHub.

---

## Pontos em que o código CONTRARIA as decisões já tomadas

1. **Regime tributário** (decisão 2: Lucro Presumido): a configuração fiscal nasce como
   **`SIMPLES`** (`schema.prisma:1261`, `TaxConfig.regime @default("SIMPLES")`). Não há
   configuração fiscal gravada por padrão para o workspace. Trocar o *default* da coluna é alterar
   coluna existente (regra 6) — proposta: manter a coluna e gravar `LUCRO_PRESUMIDO` na configuração
   deste cliente (dado, não migration), ou você autoriza a mudança do default.
2. **Perfil "venda"** (decisão 1): hoje o menu mostra tudo — Manutenção, Automações, Marketing,
   Integrações, Corretores Parceiros (split) — e não existe configuração por workspace para esconder.
   É exatamente o escopo da Fase 1; não há conflito de código, só ausência.
3. **Boleto e PIX** (decisão 3): o PIX só existe embutido no boleto do Asaas; não há "gerar cobrança
   PIX" separada. Escopo da Fase 5.
4. **NFS-e com provedor ainda não escolhido**: o código **já integra direto com a Focus NFe**
   (`fiscal.service.ts:90-140`, env `FOCUS_NFE_TOKEN`), fora do padrão adapter pedido para a Fase 6, e
   sem token finge emitir. Proposta para a Fase 1: esconder/rotular a emissão de NFS-e como
   "não disponível" até a Fase 6 (sem apagar código).
5. **Regra 4 (Decimal)**: tabelas fiscais e de split ainda usam `Float`. Corrigir exige alterar tipo de
   coluna → **preciso da sua autorização explícita** antes da Fase 5/6.
6. **Regra 2 (soft delete)**: DIMOB e etapas do funil são apagadas fisicamente. Corrigir o código não
   exige migration destrutiva (só adicionar coluna `deletedAt` onde faltar — aditivo).
