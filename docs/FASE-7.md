# FASE 7 — Permissões, relatórios e notificações

Branch: `feat/fase-7-permissoes` (base: `feat/fase-6-nfse`). Pull Request separado; **quem mescla é o dono**, depois de testar.

## Decisões do dono que continuam valendo

- Perfil "venda": locação e módulos avançados seguem **escondidos** do menu (nada foi apagado).
- Regime **Lucro Presumido**; **boleto e PIX** continuam.
- NFS-e direto na SIL (Franca) — Fase 6, sem mudança.

## 1. O que foi feito (em linguagem simples)

### Quatro papéis, valendo no servidor
Cada pessoa da imobiliária tem um papel:

| Papel | O que pode |
|---|---|
| **Dono/Admin** | Tudo, inclusive configurações, usuários e autorizar notas reais. O dono da conta é sempre Admin. |
| **Financeiro** | Financeiro, cobranças (boleto/PIX), bancário, notas fiscais e configurações financeiras. |
| **Gerente** | CRM completo, contratos, financeiro e relatórios; sem configurações da imobiliária nem usuários. |
| **Corretor** | **Só os próprios** leads, negócios, visitas, propostas, tarefas, conversas e comissões. Não vê o financeiro geral nem as configurações. |

A regra é aplicada **no servidor**, não só escondendo botão: se o corretor digitar o endereço de uma tela proibida,
a tela mostra "Sem acesso a esta área" e o servidor recusa os dados (erro 403). Lead ou negócio de outro corretor
aparece como "não encontrado". Um teste automático confere que **toda** rota do sistema tem a regra de acesso declarada.

### Convidar usuários
Em **Configurações → Usuários e papéis**: digite o e-mail, escolha o papel e clique **Gerar convite**. Aparece um link
para copiar e mandar por WhatsApp ou e-mail. O convidado abre o link, cria a senha e já entra com o papel escolhido.
O convite vale 7 dias, só pode ser usado uma vez e pode ser cancelado. Na mesma tela você troca o papel ou remove alguém.

### Oito relatórios com Excel e PDF (menu **Relatórios**)
VGV vendido por período · conversão por etapa do funil · tempo médio de venda · origem dos leads · ranking de
corretores · comissões a receber e a pagar · imóveis sem movimento · autorizações de venda a vencer.
Cada um tem filtro (período ou número de dias) e botões **Excel** e **PDF**.
O painel inicial do corretor mostra só os números dele ("Minhas comissões a receber"), sem o saldo da imobiliária.

### Notificações reais (sino e e-mail)
O sino no topo mostra os avisos e o número de não lidos. A cada 5 minutos o sistema verifica e avisa:

| Aviso | Quem recebe |
|---|---|
| Lead novo | corretor do negócio (ou gerência, se ninguém foi atribuído) |
| Visita no dia | corretor da visita |
| Tarefa vencendo (24h) ou vencida | responsável pela tarefa |
| Proposta sem resposta há 3+ dias | corretor do negócio |
| Parcela vencida | Financeiro e Dono |
| Autorização de venda expirando (15 dias) | captador e gerência |
| Nota fiscal rejeitada | Financeiro e Dono |

O mesmo aviso não se repete. Em **Configurações → Notificações** cada pessoa liga/desliga o e-mail (geral e por tipo).
Se o e-mail falhar, o aviso fica marcado "e-mail falhou" com o motivo — **nunca** como enviado sem confirmação.
A rota antiga que "fingia" enviar notificações foi **removida**.

### Minhas comissões
Tela nova para o corretor: comissões a receber, recebidas e o total.

### DIMOB de vendas conferida
- Os tipos de registro foram corrigidos para o leiaute oficial: **R02 = locação** e **R04 = intermediação de venda**.
- Novo botão **Validar** (Fiscal → DIMOB, ao lado de "Arquivo PGD"): confere vendedor e comprador (nome e CPF/CNPJ
  válidos), valores, datas, comissão e a estrutura do arquivo (cabeçalho, declarante, registros e T9). Lista
  **erros** (impedem a entrega) e **avisos**.
- Fontes consultadas para o leiaute: documentação Senior (documentacao.senior.com.br), TaxOne/Invent
  (docs.inventsoftware.info) e Globaltec (ajuda.globaltec.com.br). **Atenção:** as posições exatas de cada campo
  não puderam ser baixadas do site da Receita deste ambiente. **Antes da primeira entrega, importe o arquivo no
  programa oficial (PGD DIMOB) junto com o contador** — o PGD faz a conferência final.

### LGPD e segurança (pendências do inventário fechadas)
- **Exportar dados do titular** e **Anonimizar** no cadastro do cliente (só Dono/Admin). Se o cliente tem contrato,
  lançamento, nota fiscal ou DIMOB, nome, CPF/CNPJ e endereço ficam guardados por obrigação legal (5 anos) e o resto
  (telefone, e-mail, conversas, anotações) é apagado. Sem obrigação legal, tudo é apagado e o cadastro desativado.
  Tudo fica registrado na auditoria, com o motivo.
- **Bloqueio de login:** 10 senhas erradas seguidas bloqueiam a conta por 15 minutos.
- **Limite de requisições por IP** ligado (antes estava configurado mas não funcionava).
- Logs sem e-mail, link de redefinição de senha ou outros dados pessoais.
- **Parceiros (split):** o antigo "Habilitar (KYC aprovado)" era uma aprovação falsa. Agora é **"Marcar dados como
  conferidos"**: o sistema exige documento válido e chave PIX ou conta bancária, e registra quem conferiu. Não há
  verificação automática de identidade — é uma conferência manual sua.

### O que ficou de fora / atenção
- Webhooks de saída, Conversions API e automações continuam **escondidos** no perfil venda (não implementados).
- "Remover membro" apaga o vínculo da pessoa com a imobiliária (comportamento que já existia); os registros dela
  (negócios, visitas etc.) **continuam**. Se quiser que isso também vire "desativação", me avise.
- Documentos e assinatura eletrônica ainda não são filtrados por corretor (o corretor não chega neles pelo menu,
  mas o filtro no servidor fica para a próxima fase).
- O consentimento de marketing do cliente ainda não é consultado antes de envios.
- O cliente ainda não tem um campo de "corretor responsável" na tela (no servidor ele já existe e é preenchido).

## 2. Arquivos alterados e migration

**Migration (só aditiva):** `backend/prisma/migrations/20261114240000_fase7_permissoes/migration.sql`
- novas colunas: `roles.systemKey`, `contacts.assigneeId`, `workspace_users.emailNotifications`,
  `notifications.link/dedupeKey/emailStatus/emailError` (+ índice único para não repetir aviso);
- dados: marca os papéis existentes (Administrador = ADMIN, demais = Corretor), cria os papéis Financeiro e Gerente
  em cada imobiliária e preenche o corretor responsável dos clientes pelo último negócio.

**Backend (principais):**
- `src/common/access/` — papéis, regra de acesso por rota (`@Access`) e filtro "só os meus" do corretor;
- `src/common/guards/workspace.guard.ts`, `src/main.ts`, `src/app.module.ts` — aplicação da regra, limite por IP;
- todos os controllers ganharam `@Access(...)`; serviços de contatos, negócios, visitas, propostas, atividades,
  conversas, funil e contratos filtram pelo corretor;
- `src/modules/auth/*` — 4 papéis no cadastro, convite com aceite, bloqueio de login;
- `src/modules/users/*`, `src/modules/workspace/*` — convites, papéis;
- `src/modules/reports/sales/*` — 8 relatórios + Excel/PDF;
- `src/modules/hub/notifications/notification-rules.service.ts` — regras de aviso;
- `src/modules/notifications/*` — preferências e chave geral de e-mail;
- `src/modules/erp/fiscal/dimob.*` — tipos R02/R04 e validação;
- `src/modules/lgpd/lgpd-contact.service.ts` — exportar/anonimizar cliente;
- `src/modules/erp/split/split.service.ts` — conferência manual de parceiro;
- testes: `access.spec.ts`, `sales-reports.spec.ts`, `notification-rules.spec.ts`, `dimob.validate.spec.ts`,
  `test/api/fase7-permissoes.mjs`.

**Frontend:** `lib/navigation.ts` (menu por papel), `components/providers/profile-gate.tsx` ("Sem acesso"),
`components/layout/{sidebar,header,notification-bell}.tsx`, `hooks/{use-role,use-team}.ts`,
`app/(auth)/invite/[token]`, `app/(auth)/login` (e-mail já preenchido após convite),
`app/(dashboard)/{settings/users,settings/notifications,my-commissions,reports,fiscal,contacts/[id],partners,page}`.

## 3. Variáveis de ambiente

**Nenhuma obrigatória nova.** Confira só estas, que já existem:
- `FRONTEND_URL` (serviço do **backend**) — é usada para montar o link do convite. Deve ser o endereço do site
  (ex.: `https://seu-sistema.up.railway.app`).
- SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) — sem elas os avisos aparecem só no sino e
  o e-mail fica marcado como "não enviado".

**Opcional:** `RATE_LIMIT_PER_MINUTE` (padrão 600 requisições por minuto por IP). Só mude se alguém reclamar de
"muitas requisições". Para criar: Railway → serviço do **backend** → aba **Variables** → **New Variable** →
nome `RATE_LIMIT_PER_MINUTE`, valor (ex.: `900`) → **Add** → o Railway reinicia sozinho.

## 4. Resultado do build e dos testes

| Verificação | Resultado |
|---|---|
| Backend `npm run build` / `tsc --noEmit` | OK |
| Backend `jest` | **177/177** (inclui testes de papéis em todas as rotas, relatórios, notificações, DIMOB) |
| Frontend `tsc --noEmit` / `npm run build` | OK |
| Migration aplicada em banco com as fases anteriores | OK |
| Ponta a ponta Fase 7 (API real: papéis, convites, relatórios, avisos, DIMOB, LGPD, bloqueio) | **59/59** |
| Teste de tela (navegador, login real de Dono e Corretor) | **14/14** |

## 5. Roteiro de teste manual (homologação)

1. **Convite:** entre como dono → Configurações → Usuários e papéis → convide um e-mail seu como **Corretor** →
   copie o link e abra numa janela anônima → crie a senha → o login já vem com o e-mail → entre.
2. **Corretor:** o topo mostra "Corretor"; o menu **não** tem Financeiro, Notas, Configurações gerais; tem
   "Minhas comissões". Digite `/financial` no endereço: aparece "Sem acesso a esta área".
3. Como corretor, crie um lead e um negócio. Como dono, crie outro lead. Volte ao corretor: ele vê **só o dele**.
4. Como dono, convide também um **Financeiro** e um **Gerente** e confira: Financeiro vê o financeiro e notas,
   não vê Usuários; Gerente vê CRM, contratos e relatórios, não vê Usuários nem configurações da imobiliária.
5. **Sino:** em até 5 minutos o corretor recebe "Lead novo" do negócio atribuído a ele. Clique no aviso: abre o negócio.
6. **E-mail:** em Configurações → Notificações, ligue o e-mail. Com SMTP configurado o aviso chega por e-mail; sem
   SMTP o aviso mostra que o e-mail não foi enviado.
7. **Relatórios:** abra cada um dos 8, mude o período e baixe **Excel** e **PDF**.
8. **DIMOB:** Fiscal → DIMOB → escolha o ano → **Validar**. Corrija o que aparecer como erro (ex.: CPF do comprador
   faltando) e valide de novo. Baixe o arquivo e **importe no PGD DIMOB** com o contador.
9. **LGPD:** num cliente de teste sem contrato → **Exportar dados (LGPD)** (baixa um arquivo) → **Anonimizar** →
   informe o motivo → os dados somem. Num cliente com contrato, a mensagem avisa que nome/CPF ficam guardados.
10. **Bloqueio:** erre a senha de um usuário de teste 10 vezes → mesmo com a senha certa, fica bloqueado por 15 minutos.
11. **Parceiros:** em Parceiros, "Marcar dados como conferidos" só funciona com documento válido e PIX/conta.

## 6. Script de validação

Dê dois cliques em **`validar-fase-7.bat`** (com Git e Docker Desktop abertos). Ele baixa esta fase e roda, no
Docker (node:20-alpine), build + tipos + testes do backend e tipos do frontend. Não mexe no sistema que está no ar.
