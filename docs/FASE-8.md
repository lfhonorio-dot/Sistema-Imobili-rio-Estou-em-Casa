# FASE 8 — Testes e homologação

Branch: `feat/fase-8-e2e` (base: `feat/fase-7-permissoes`). Pull Request separado; **quem mescla é o dono**, depois de testar.

## ⚠️ Achado importante desta fase: falha de segurança corrigida

O teste novo de isolamento encontrou uma falha **que já existe no sistema que está no ar hoje** (ela é anterior a este trabalho):

- **O que era:** o sistema identifica a imobiliária por um "cabeçalho" que o navegador envia em cada pedido. Se alguém
  **logado** enviasse um pedido **sem** esse cabeçalho, o servidor devolvia — e deixava **alterar** — dados de
  **todas** as imobiliárias (clientes, imóveis, negócios, contratos, financeiro).
- **Quem conseguiria explorar:** qualquer pessoa com um login válido, usando uma ferramenta técnica (não acontece pelo
  uso normal das telas). Como o cadastro de novas imobiliárias é aberto, um estranho poderia criar uma conta e fazer isso.
- **Correção:** uma linha no "porteiro" do servidor (`workspace.guard.ts`), que agora sempre fixa a imobiliária do
  próprio usuário. Confirmado com teste **antes** (vazava e alterava) e **depois** (não vaza, não altera).
- **Recomendação:** esta correção só chega à produção quando os PRs forem mesclados. Se a fila de PRs for demorar,
  posso abrir um **PR pequeno só com esta correção direto para a `main`** — é só pedir.

## 1. O que foi feito (em linguagem simples)

### Teste automático do fluxo de ouro inteiro
Um "robô" liga o sistema de verdade com um **banco de dados de teste vazio** e faz a venda do começo ao fim:

captação do imóvel → lead → visita → proposta → negócio ganho → contrato de venda → **assinatura eletrônica**
(com e-mail e código de verdade, num servidor de e-mail simulado) → comissão a receber com **boleto** (parcela 1) e
**PIX** (parcela 2), baixadas pelo aviso do banco → **NFS-e** (prefeitura simulada que confere a assinatura digital)
→ comissão paga ao corretor → fluxo de caixa → **DIMOB** validada.

São **27 verificações** com os valores conferidos centavo a centavo (ex.: venda de R$ 390.000 a 6% = comissão de
R$ 23.400; corretor R$ 9.360; caixa: entrou 23.400, saiu 9.360). Asaas, prefeitura e e-mail são **simulados dentro do
teste**: nada sai para a internet e nenhum dado real é tocado.

### Testes de integração pedidos
Todos rodam contra o sistema ligado de verdade (não são testes "de mentira"):

| Pedido | Onde está | Verificações |
|---|---|---|
| Geração automática de contas na venda | `fase4-contrato-venda.mjs` e `fluxo-de-ouro.mjs` | 33 + 27 |
| Rescisão | `fase4-contrato-venda.mjs` | (dentro das 33) |
| Baixa parcial | `fase5-financeiro.mjs` | (dentro das 79) |
| Baixa por webhook de boleto e de PIX | `fase5-financeiro.mjs` e `fluxo-de-ouro.mjs` | 79 + 27 |
| Emissão de NFS-e (provedor simulado) | `fase6-nfse.mjs` e `fluxo-de-ouro.mjs` | 38 + 27 |
| Permissões do papel Corretor | `fase7-permissoes.mjs` e `fluxo-de-ouro.mjs` | 59 + 27 |
| Isolamento entre workspaces | **`isolamento-workspaces.mjs`** (novo) | 10 |

O teste de isolamento novo cria dados na imobiliária A e faz a imobiliária B percorrer 22 listagens e relatórios,
tentar ler, alterar, apagar, dar baixa, rescindir e anonimizar registros de A — com o cabeçalho certo, trocado e ausente.

### Rodando no GitHub e bloqueando merge
- Novo fluxo `.github/workflows/fluxo-de-ouro.yml`: em **todo Pull Request** (e em todo envio para a `main`) o GitHub
  cria o banco de teste, liga o backend e roda os 8 roteiros (**310 verificações**). Também compila o frontend.
- O fluxo antigo de testes unitários passou a rodar em **qualquer** Pull Request (antes só nos que iam direto para a
  `main`) e ganhou a checagem de tipos.
- **O bloqueio do merge precisa de um clique seu no GitHub** — eu não tenho permissão para mudar essa configuração.
  Passo a passo na seção 3.

### Checklist de homologação
`docs/CHECKLIST-HOMOLOGACAO.md`: roteiro manual, tela por tela, com o resultado esperado em cada passo, na ordem de
uma venda real, mais as exceções (baixa parcial, rescisão, nota rejeitada, permissões, segurança, LGPD) e a lista do
que conferir antes de usar com clientes reais.

### Outros ajustes pequenos
- O link de assinatura eletrônica enviado por e-mail usava a variável `APP_URL`; se ela não existisse no Railway, o
  link apontava para "localhost" (não abria). Agora, na falta dela, usa a `FRONTEND_URL`.
- Corrigido o título do `validar-fase-7.bat` (dizia "nota fiscal").

### O que ficou de fora / atenção
- **O `.bat` não pôde ser executado aqui** (este ambiente não tem Docker ligado). O script que ele chama dentro do
  Docker (`rodar-no-docker.sh`) **foi** executado e passou. Se o `.bat` der erro na sua máquina, me envie a mensagem.
- O teste automático usa a **API** (o "motor" do sistema). As telas foram testadas no navegador em cada fase, mas esse
  teste de tela não roda sozinho no GitHub; o checklist manual cobre as telas.
- A conferência final da **DIMOB no programa da Receita (PGD)** e a **primeira nota fiscal real** continuam sendo
  passos manuais com o contador.
- O sistema hoje permite **ativar a venda sem a assinatura eletrônica concluída** (a assinatura é opcional). Se quiser
  que seja obrigatória, é uma decisão sua — me avise.
- Se a venda for ativada **antes** de preencher o CNPJ da imobiliária, o registro da DIMOB fica sem declarante (a
  validação acusa o erro). Por isso o checklist manda preencher o CNPJ primeiro.
- Pendências já listadas na Fase 7 continuam: documentos/assinaturas sem filtro por corretor, consentimento de
  marketing não consultado, "remover membro" apaga o vínculo.
- O repositório no GitHub está **público** (qualquer pessoa lê o código). Não há senhas no código, mas avalie torná-lo
  privado: GitHub → Settings → General → Danger Zone → Change visibility. (Em repositório privado no plano gratuito,
  a regra de bloqueio de merge da seção 3 pode não estar disponível.)

## 2. Arquivos alterados e migrations

**Nenhuma migration nesta fase.**

- `backend/src/common/guards/workspace.guard.ts` — correção de segurança (+ 2 testes em `workspace.guard.spec.ts`)
- `backend/src/modules/erp/contracts/contracts.service.ts`, `backend/src/modules/erp/esignature/esignature.service.ts` — link de assinatura
- `backend/test/api/fluxo-de-ouro.mjs` — **novo**: fluxo de ouro completo
- `backend/test/api/isolamento-workspaces.mjs` — **novo**: isolamento entre imobiliárias
- `backend/test/api/_simuladores.mjs` — **novo**: Asaas, prefeitura e e-mail simulados
- `backend/test/api/rodar-tudo.mjs` — **novo**: roda os 8 roteiros e resume
- `backend/test/api/rodar-no-docker.sh` — **novo**: usado pelo `.bat`
- `backend/test/api/fase7-permissoes.mjs` — uma verificação ajustada (aceita "falhou" além de "não enviado")
- `.github/workflows/fluxo-de-ouro.yml` — **novo**; `.github/workflows/backend-tests.yml` — roda em todo PR + tipos
- `docs/CHECKLIST-HOMOLOGACAO.md`, `docs/FASE-8.md`, `validar-fase-8.bat`, `validar-fase-7.bat`, `.gitattributes`

## 3. Variáveis de ambiente e configuração

**Railway: nenhuma variável nova.** Confira apenas, no serviço do **backend** (Railway → projeto → serviço do backend →
aba **Variables**):
- `FRONTEND_URL` = endereço do site (ex.: `https://seu-sistema.up.railway.app`). É usada nos links de convite e, agora,
  também nos links de assinatura quando `APP_URL` não existir.

**GitHub: ligar o bloqueio de merge (uma vez só).** Faça **depois** que o PR da Fase 8 for aberto e os testes tiverem
rodado pelo menos uma vez (senão os nomes não aparecem na busca):

1. Abra o repositório no GitHub → aba **Settings** (engrenagem, no alto à direita).
2. No menu da esquerda, **Branches**.
3. Clique em **Add branch protection rule** (ou "Add classic branch protection rule").
4. Em **Branch name pattern**, digite: `main`
5. Marque **Require a pull request before merging**.
6. Marque **Require status checks to pass before merging**.
7. Na caixa de busca que aparece, procure e selecione, um por vez:
   - `Fluxo de ouro (ponta a ponta)`
   - `Frontend (tipos e build)`
   - `backend-tests`
8. (Recomendado) marque **Do not allow bypassing the above settings**.
9. Clique em **Create** / **Save changes**.

A partir daí, o botão de merge fica **cinza** enquanto algum teste estiver vermelho.

## 4. Resultado do build e dos testes

| Verificação | Resultado |
|---|---|
| Backend `npm run build` / `tsc --noEmit` | OK |
| Backend `jest` | **179/179** |
| Frontend `tsc --noEmit` / `npm run build` | OK |
| Banco **vazio** + todas as migrations (como o GitHub fará) | OK |
| Fluxo de ouro completo | **27/27** |
| Isolamento entre imobiliárias | **10/10** (antes da correção: 8/10 — vazava e alterava) |
| Fases 2 a 7 (regressão) | 36/36, 28/28, 33/33, 79/79, 38/38, 59/59 |
| **Total ponta a ponta** | **310/310** |
| Execução no GitHub Actions | roda quando o PR for aberto — acompanhe o resultado no próprio PR |

## 5. Roteiro de teste manual

Use o **`docs/CHECKLIST-HOMOLOGACAO.md`** (é a entrega desta fase). Além dele, confira no GitHub:

1. Abra o Pull Request da Fase 8 → role até o fim → quadro de verificações.
   → "Fluxo de ouro (ponta a ponta)", "Frontend (tipos e build)" e "backend-tests" com ✓ verde.
2. Clique em **Details** de "Fluxo de ouro" → passo "Rodar o fluxo de ouro e os testes de integração".
   → Um **RESUMO** com 8 linhas "PASSOU" e "Todos os roteiros passaram."
3. Depois de ligar o bloqueio (seção 3), abra qualquer PR com teste vermelho.
   → O botão **Merge** fica bloqueado.

## 6. Script de validação

Dê dois cliques em **`validar-fase-8.bat`** (com Git e Docker Desktop abertos). Ele baixa esta fase, cria um banco de
teste descartável no Docker, compila, roda os testes do backend, **o fluxo de ouro e os testes de integração**, e
confere os tipos do frontend. No fim, apaga o banco de teste. Não mexe no sistema que está no ar.

## Ordem para colocar tudo no ar

Nada das Fases 1 a 8 está em produção ainda. Mesclar nesta ordem, esperando o Railway publicar e conferindo o sistema
entre um e outro: **#10 → #11 → #12 → #13 → #14 → #15 → #16 → #17 → #18 → PR da Fase 8**.
Depois de cada merge, o PR seguinte precisa ter a base trocada para `main` (eu faço isso quando você avisar).
