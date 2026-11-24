# Inventário — dados da empresa emitente (Fase 0)

Branch `feat/dados-emitente-historico`, levantamento feito sobre a `main` em 24/11/2026 (após o PR #22).
Somente leitura: nenhum código foi alterado nesta fase.

"Ao vivo" = o documento lê o cadastro atual toda vez que é gerado/reimpresso.
"Cópia" = o dado foi gravado no momento da emissão e não muda depois.

## a) Onde ficam hoje os dados da empresa

Os dados estão **em dois lugares**, com campos duplicados e sem sincronização entre eles.

| Dado | Onde está (Prisma) | Tela que edita |
|---|---|---|
| Nome da imobiliária (funciona como nome fantasia) | `Workspace.name` | Configurações → Workspace (`frontend/app/(dashboard)/settings/workspace/page.tsx`) |
| CNPJ | `Workspace.cnpj` **e** `TaxConfig.cnpj` | Configurações → Workspace **e** Notas Fiscais → Configuração fiscal (`frontend/components/nfse/nfse-panel.tsx:244`) |
| Razão social | `TaxConfig.razaoSocial` (só aqui) | Notas Fiscais → Configuração fiscal |
| Nome fantasia | **não existe campo próprio**; o sistema usa `Workspace.name` | — |
| Inscrição municipal | `TaxConfig.inscricaoMunicipal` | Notas Fiscais → Configuração fiscal |
| Inscrição estadual | `TaxConfig.inscricaoEstadual` | (não exposta na tela atual) |
| Endereço | `Workspace.address` (um texto livre, sem CEP/cidade/UF separados) | Configurações → Workspace |
| Município (prestador NFS-e) | `TaxConfig.municipio` + `TaxConfig.codigoMunicipioIbge` (padrão 3516200, Franca) | Notas Fiscais → Configuração fiscal |
| Regime tributário | `TaxConfig.regime` (o banco tem padrão `SIMPLES`; a tela/serviço nasce em Lucro Presumido) | Notas Fiscais → Configuração fiscal |
| Telefone, logo, DPO | `Workspace.phone`, `Workspace.logo`, `Workspace.dpoName`, `Workspace.dpoEmail` | Configurações → Workspace |

Consequência: hoje é possível ter um CNPJ em Configurações → Workspace e outro na Configuração fiscal. O contrato usa
`workspace.cnpj ?? taxConfig.cnpj`; a NFS-e usa só `taxConfig.cnpj`; recibo, proposta e DIMOB usam só `workspace.cnpj`.

## b) Pontos que usam os dados da empresa para gerar algo

| Documento / ponto | arquivo:linha | Ao vivo ou cópia? | O que acontece hoje se o CNPJ for trocado |
|---|---|---|---|
| Contrato de venda/locação (HTML do modelo, "Ver contrato", impressão) | `backend/src/modules/erp/contracts/contract-template.service.ts:104` (carrega), `:315`, `:535`, `:745`, `:1049` (monta a qualificação da imobiliária) | **Ao vivo** — o contrato nunca é guardado; é remontado a cada abertura | Contratos antigos passam a mostrar o **CNPJ e o nome novos**, inclusive os já assinados |
| E-mail de assinatura com o contrato anexado | `backend/src/modules/erp/contracts/contracts.service.ts:551` | Ao vivo | Reenvio de contrato antigo sai com os dados novos |
| Envelope de assinatura — "lacre" (hash SHA-256) do documento | `contracts.service.ts:664` e `backend/src/modules/erp/esignature/esignature.service.ts:57` / `:403` | Hash é **cópia** (gravado em `SignatureEnvelope.documentHash`), mas o documento que ele lacra **não é guardado** | Ao trocar o CNPJ, o contrato remontado deixa de bater com o hash gravado: **não dá mais para provar qual texto foi assinado**. `SignatureEnvelope.signedUrl/signedHash` existem no banco mas nunca são preenchidos (não há PDF final assinado nem "certificado" gerado — a trilha de auditoria é só a tabela de eventos) |
| NFS-e — XML assinado e PDF | `backend/src/modules/erp/nfse/nfse.service.ts:322-342` (gera e guarda em `NfseRecord.xmlFileId`/`pdfFileId`), `NfseRecord.issuerCnpj` | **Cópia** — XML e PDF são gravados como arquivo na autorização; download e reenvio por e-mail (`:452`) leem o arquivo guardado | Notas já autorizadas continuam corretas. Só o **assunto/assinatura do e-mail** de reenvio usa o nome atual (`:460`) |
| NFS-e — cancelamento e consulta na prefeitura | `nfse.service.ts:225-238` (`context()`), `backend/src/modules/erp/nfse/sil-abrasf24.provider.ts:66`, `:76` | Ao vivo (CNPJ, inscrição municipal e certificado da Configuração fiscal atual) | **Cancelar ou consultar nota antiga falha**: o pedido vai com o CNPJ/certificado novos para uma nota emitida pelo antigo |
| NFS-e — reenvio de nota rejeitada/na fila | `nfse.service.ts:275-290` (`rpsInput`) | Ao vivo | Nota que estava na fila sai com o CNPJ novo, mas o registro continua com `issuerCnpj` antigo (inconsistência). A numeração de RPS (`TaxConfig.rpsSerie/rpsNextNumber`) é uma só e não recomeça para o CNPJ novo |
| NFS-e — registro automático de falha | `nfse.service.ts:411` | Cópia do CNPJ atual em `issuerCnpj` | — |
| Recibo de comissão (HTML para imprimir) | `backend/src/modules/erp/financial/commission-receipt.service.ts:72` (carrega), `:153`, `:165`; rota `financial.controller.ts:122` | **Ao vivo** — não é guardado | Reimpressão de recibo antigo sai com nome/CNPJ novos |
| Proposta (documento para imprimir/PDF) | `backend/src/modules/crm/funnel/proposals.service.ts:200`, `:227` | Ao vivo | Proposta antiga reimpressa sai com nome/CNPJ novos |
| Boleto e PIX — beneficiário | Não é enviado pelo sistema: o beneficiário é o **titular da conta Asaas** (dados ficam no Asaas). A cobrança guarda qual conta emitiu: `Boleto.gatewayId` (`schema.prisma`, model `Boleto`) | Cópia (vínculo com a conta Asaas) | Boletos antigos continuam pagáveis; cancelar/reemitir usa a conta Asaas da própria cobrança (`backend/src/modules/erp/billing/billing.service.ts:357-364`) — funciona enquanto a configuração antiga não for apagada |
| Boleto e PIX — aviso automático de pagamento (webhook) | `billing.service.ts:647-660` | Ao vivo | O token é conferido **só contra a conta Asaas padrão**. Se a conta do CNPJ novo virar padrão, os avisos de pagamento dos boletos da conta antiga são **recusados** e a baixa deixa de ser automática |
| Boleto e PIX — e-mail/WhatsApp de envio da cobrança | `billing.service.ts:494`, `:533` | Ao vivo (só o nome) | Reenvio sai com o nome novo |
| DIMOB — eventos de venda | `backend/src/modules/erp/fiscal/dimob.service.ts:32`, `:83`, `:104-105` (grava `declarantDoc`/`declarantName` em `DimobRecord`); chamado na ativação da venda (`sale-lifecycle.service.ts:191`) e no botão de reprocessar (`fiscal.controller.ts:36`) | **Cópia** no momento da ativação | Vendas antigas continuam no CNPJ antigo. **Mas** reprocessar uma venda antiga (botão "registrar" / regularização) apaga e recria os registros com o **CNPJ atual** |
| DIMOB — eventos de aluguel | `dimob.service.ts:126`, `:134` | Cópia | Igual às vendas |
| DIMOB — geração antiga de aluguel ("Gerar DIMOB ano anterior") | `backend/src/modules/erp/fiscal/fiscal.service.ts:92` | Não grava declarante (fica "SEM_DECLARANTE") | Já é um problema hoje, independente da troca (só afeta locação, que está escondida no perfil Venda) |
| DIMOB — arquivo PGD e validação | `dimob.service.ts:224-237` (usa `declarantDoc` dos registros), `:293` | Cópia | Já gera **um arquivo por CNPJ declarante**; a tela já lista os declarantes do ano e permite validar/baixar cada um. Falta: vigência de cada CNPJ dentro do ano e escolha explícita do declarante |
| Relatórios de venda em PDF | `backend/src/modules/reports/sales/sales-reports.service.ts:61`, `report-table.ts:79` | Ao vivo (só o nome, no cabeçalho) | Relatório gerado depois da troca mostra o nome novo (esperado: relatório é "do momento") |
| Fluxo de caixa / DRE / relatório do contador (Excel) | `financial` e `nfse` (exportações) | Não usam CNPJ nem razão social | Sem efeito |
| E-mail de boas-vindas e tela de convite | `backend/src/modules/auth/auth.service.ts:761`, `:879` | Ao vivo (só o nome) | Mostra o nome novo (esperado) |
| Feed de portais imobiliários (VRSync) | `backend/src/modules/marketing/portals/portals-feed.service.ts:88`, `:148-150` | Ao vivo (só o nome) | Anúncios passam a mostrar o nome novo (esperado) |
| Portal do proprietário | `backend/src/modules/erp/contracts/contracts.service.ts:1034-1063` | Não mostra CNPJ nem razão social | Sem efeito |
| WhatsApp (mensagens) | `billing.service.ts:533` (envio de cobrança) | Ao vivo (só o nome) | Nome novo |

## c) Credenciais e configurações presas ao CNPJ

| Item | Onde fica | Preso ao CNPJ? | Observação |
|---|---|---|---|
| Conta Asaas (boleto/PIX/split) | `PaymentGatewayConfig` (chave criptografada em `apiKey`, token do webhook em `webhookSecret`) | **Sim** — a conta Asaas é aberta em nome de um CNPJ; CNPJ novo = conta nova | Já aceita várias contas por imobiliária e cada cobrança guarda a sua (`Boleto.gatewayId`). Falta: webhook aceitar o token de qualquer conta (hoje só a padrão) e impedir que a conta antiga seja apagada enquanto houver cobrança aberta nela |
| Certificado digital A1 | `TaxConfig.certPfxEnc` / `certPasswordEnc` (criptografados) | **Sim** — o certificado é emitido para o CNPJ | Há só **um** certificado por imobiliária. Trocar apaga o antigo e impede cancelar notas antigas |
| Provedor NFS-e (SIL Franca) | `TaxConfig` (`inscricaoMunicipal`, `nfseWsUrl*`, `rpsSerie`, `rpsNextNumber`, autorização de produção) | **Sim** — inscrição municipal e numeração de RPS são do CNPJ | Só um conjunto por imobiliária |
| Contas bancárias | `BankAccount` | **Sim** na prática (titular da conta), mas o sistema não guarda o titular | Várias contas permitidas; não há vínculo com CNPJ |
| WhatsApp Business (Meta) | `WhatsAppConfig` (uma por imobiliária) | **Sim** — o número e a conta Meta Business são verificados para uma empresa | Só uma configuração; trocar sobrescreve |
| Split / recebedores parceiros | `SplitRecipient` | Não (são os parceiros) | Ligados a uma conta Asaas (`gatewayConfigId`) |
| Modelos de contrato | Texto fixo em `contract-template.service.ts` | Não guardam CNPJ (leem ao vivo) | — |

## Pontos em que o código atual difere do que foi descrito no pedido

1. O `CLAUDE.md` não tem seções numeradas (não existem "seções 6, 7 e 8"). Sigo as seções que existem: Arquitetura essencial, Comandos, Invariantes de segurança e Armadilhas.
2. **"Migrations sempre com DATABASE_URL_DIRECT"**: o `schema.prisma` só declara `url = env("DATABASE_URL")`, e o `backend/start.sh` roda `migrate deploy` com essa variável (a conexão compartilhada do Neon). A `DATABASE_URL_DIRECT` existe no Railway, mas o código não a usa. Usá-la exige acrescentar `directUrl = env("DATABASE_URL_DIRECT")` ao `datasource` — mudança de configuração que preciso que você autorize.
3. Não existe "Configurações > Empresa": os dados estão divididos entre Configurações → Workspace e Notas Fiscais → Configuração fiscal.
4. Não existe "nome fantasia" separado: o nome da imobiliária (`Workspace.name`) é usado como tal. Razão social só existe na Configuração fiscal.
5. O endereço é um campo de texto único, não estruturado.
6. O beneficiário do boleto/PIX não é enviado pelo sistema — é o titular da conta Asaas.
7. A assinatura eletrônica não gera PDF final nem certificado; o hash lacra um documento que não é guardado (ver tabela b).
8. A DIMOB já grava o CNPJ declarante em cada registro e já gera um arquivo por CNPJ; o trabalho da Fase 2 nela é menor do que o descrito (vigência + escolha explícita + não reatribuir ao reprocessar).
9. **`npm run lint` hoje não roda em nenhuma das duas partes**: no backend o script existe e o ESLint está instalado, mas não há arquivo de configuração (`.eslintrc`), então ele para com "No ESLint configuration found"; no frontend o `next lint` pergunta como configurar (também sem configuração). Para cumprir "npm run lint passando" é preciso **criar a configuração de lint** nas duas partes — e a primeira execução quase certamente vai apontar problemas no código existente. Preciso que você decida se isso entra nesta branch.
