# FASE 1 — Perfil "Venda" e limpeza da interface

Branch: `feat/fase-1-perfil-venda` · Base: `main` (2b509e8)

## 1. O que foi feito (em linguagem simples)

**Perfil de operação.** Cada imobiliária (workspace) agora tem um "perfil":
- **Venda** (padrão): mostra só o que serve à venda.
- **Venda e Locação**: mostra tudo.

No perfil Venda ficam **ocultos**, sem apagar nada: Manutenção, Corretores Parceiros (split),
Automações, Marketing e Integrações, além de contratos de locação, reajuste de aluguel, vistorias,
Open Finance e Carnê-Leão. Quem digitar o endereço de uma dessas telas vê o aviso
"Módulo não disponível neste perfil". O servidor também recusa essas funções com uma mensagem
clara, então não dá para usá-las "por fora" da tela. O perfil é trocado em **Configurações → Workspace**.

**Menu novo, em grupos.**
- **Comercial:** Dashboard, Funil, Clientes, Imóveis, Visitas, Tarefas, Caixa de Entrada.
- **Contratos:** Contratos, Assinaturas.
- **Financeiro:** A Receber, A Pagar, Boletos e PIX, Fluxo de Caixa, Bancário, Comissões, Notas Fiscais.
- **Gestão:** Relatórios, Fiscal — DIMOB.
- **Configurações:** Workspace, Usuários, Funis de venda, Modelos de e-mail, LGPD, Auditoria.

"A Receber", "A Pagar", "Fluxo de Caixa", "Notas Fiscais" e "DIMOB" abrem direto na aba certa.

**Dashboard de venda.** O cartão de desenvolvimento "Estágio 1 Concluído" e o aviso "Primeiro acesso"
foram retirados. A saudação agora sai como "Bom dia/Boa tarde/Boa noite, Nome!" e não fica mais
"Bem-vindo, !" quando falta o nome. São 8 indicadores:

| Indicador | Regra |
|---|---|
| Leads novos | negócios criados nos últimos 7 dias |
| Visitas da semana | atividades do tipo "Visita" de segunda a domingo (e quantas já foram realizadas) |
| Propostas em aberto | **"Não disponível"**: o cadastro de propostas chega na Fase 3 |
| VGV em negociação | soma do valor dos negócios abertos (nem ganhos nem perdidos), fora de funis de locação |
| Vendas do mês | contratos de Compra e Venda/Intermediação ativos criados no mês |
| Comissões a receber | comissões pendentes de contratos |
| Comissões a pagar | contas a pagar de comissão em aberto + repasses a parceiros pendentes |
| Saldo projetado (30 dias) | saldo das contas bancárias + a receber até 30 dias − a pagar até 30 dias |

**Login mais seguro.**
- Nenhuma tela aparece antes de o sistema confirmar a sessão. Antes, a página aparecia e só depois ia para o login.
- Se a confirmação falhar por internet ou por problema no servidor, aparece um aviso com o motivo e os botões **"Tentar de novo"** e **"Sair"**. Antes, a falha era silenciosa.
- Depois de recarregar a página, o nome da imobiliária e o seu papel voltam a aparecer. Antes, sumiam.

**Nada de "sucesso de mentira".**
- **Boleto:** sem o Asaas configurado, o sistema não inventa mais um boleto com linha digitável falsa; ele avisa que a emissão não está disponível. Boletos simulados antigos aparecem marcados como "simulado — sem validade bancária".
- **Nota fiscal:** sem provedor configurado, a NFS-e não é mais gravada como "emitida". Notas antigas criadas assim aparecem como "Registro interno — não emitida", com um aviso na aba.
- **Parcelas do contrato:** quando falham, o sistema avisa em vermelho. Antes, mostrava "Contrato criado!" como se tudo tivesse dado certo.
- **Sino de notificações:** foi retirado até existir notificação de verdade (Fase 7).

**Mensagens de erro de verdade.**
- Funil, negócio, tarefas, comissões, financeiro, contrato, funis e formulários agora mostram a mensagem exata que o servidor devolve.
- Clientes, Imóveis, Contratos, Boletos e Visitas diferenciam "erro de conexão" (com botão "Tentar de novo") de "lista vazia".

**Visitas.** Nova tela que lista as visitas agendadas e as realizadas, com botão "Agendar visita" e
"Realizada". Por enquanto, visita é uma atividade do tipo Visita, ligada a cliente/negócio. A agenda
completa (imóvel, corretor, retorno do cliente, calendário) é Fase 3.

**Regime tributário.** Toda configuração fiscal nova nasce como **Lucro Presumido**. A migration grava
Lucro Presumido para os workspaces que ainda não tinham configuração fiscal.

### O que ficou de fora
- **Conversão de Float para Decimal** (que você autorizou): o sistema de segurança deste ambiente
  **bloqueou** a alteração de tipo de colunas existentes. Não tentei contornar o bloqueio. Para liberar,
  é preciso permitir explicitamente essa ação no ambiente; depois eu faço em um commit separado.
- **Configuração fiscal já gravada como "Simples":** a migration não alterou o regime de quem já
  tinha configuração gravada (só criou para quem não tinha). Isso será conferido e corrigido na tela
  de configuração fiscal da Fase 6.
- A lista completa de "erro de rede × lista vazia" foi aplicada nas telas do fluxo de venda. As
  telas ocultas (manutenção, automações, marketing) continuam como estavam.

## 2. Arquivos alterados e migration

Migration (somente aditiva): `backend/prisma/migrations/20261114120000_workspace_operation_profile/migration.sql`
- `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "operationProfile" TEXT NOT NULL DEFAULT 'VENDA'`
- `INSERT` de configuração fiscal `LUCRO_PRESUMIDO` para workspaces sem configuração.

Backend:
- `prisma/schema.prisma`
- `common/decorators/operation-profile.decorator.ts` (novo)
- `common/guards/workspace.guard.ts`
- controllers de inspections, maintenance, automation, split, banking (Open Finance), contracts (reajuste)
- `contracts.service.ts`
- `billing.service.ts`
- `fiscal.service.ts`
- `reports.service.ts` + `reports.controller.ts` (`GET /reports/sales-dashboard`)
- `auth.service.ts`
- `workspace.dto.ts`
- testes novos: `workspace.guard.spec.ts`, `reports.sales-dashboard.spec.ts`,
  `fiscal.nfse-sem-provedor.spec.ts`, `contracts.perfil-venda.spec.ts`, `billing.sem-gateway.spec.ts`

Frontend:
- `lib/navigation.ts` (novo), `lib/api-error.ts` (novo)
- `components/common/error-state.tsx` (novo)
- `components/providers/auth-guard.tsx` (agora `AuthGate`), `profile-gate.tsx` (novo); `auth-initializer.tsx` foi removido (substituído pelo AuthGate)
- `components/settings/operation-profile-card.tsx` (novo)
- `components/layout/sidebar.tsx`, `header.tsx`
- `hooks/use-operation-profile.ts` (novo), `hooks/use-reports.ts`
- `stores/auth.store.ts`, `types/index.ts`
- páginas: dashboard, visits (nova), financial, financial/billing, fiscal, contracts, contracts/new, contacts, properties, settings/workspace
- troca de mensagens genéricas: tasks, deals/[id], commissions, contracts/[id], settings/pipelines, kanban-board, deal-form, task-form, activity-feed

Raiz: `validar-fase-1.bat`, `.gitattributes` (mantém o `.bat` com quebra de linha do Windows).

## 3. Variáveis de ambiente novas

**Nenhuma.** Não é preciso mexer no Railway. A migration roda sozinha quando o backend reinicia
(pelo `start.sh`), logo depois do merge na `main`.

## 4. Resultado do build e dos testes

- Backend: `npm run build` OK · `tsc --noEmit` OK · `jest`: **12 suítes, 63 testes, 63 passando**
  (eram 43; 20 novos).
- Frontend: `tsc --noEmit` OK · `npm run build` OK (44 rotas, incluindo `/visits`).
- Teste no navegador (respostas do servidor simuladas): menu do perfil Venda sem os módulos
  ocultos; grupos corretos; dashboard sem "Estágio 1"/"Primeiro acesso"; saudação com nome;
  `/maintenance` bloqueado; aba "Contas a Pagar" aberta pelo menu; perfil completo mostra Manutenção;
  falha do `/auth/me` mostra aviso e "Tentar de novo" sem renderizar o painel; sem login → `/login`.

## 5. Roteiro de teste manual (homologação)

Faça depois de o PR ser mesclado e o Railway terminar o deploy (uns 3 a 5 minutos).

1. **Entrar.** Abra o sistema e faça login.
   → Aparece rapidamente "Verificando sua sessão…" e depois o Dashboard. Nenhuma tela pisca antes.
2. **Saudação.** No Dashboard, olhe o título.
   → "Bom dia/Boa tarde/Boa noite, *seu nome*!" e o nome da imobiliária embaixo. Não aparece
   "Estágio 1 Concluído" nem "Primeiro acesso".
3. **Indicadores.** Confira os 8 cartões.
   → "Propostas em aberto" diz "Não disponível". Os outros mostram números. Clique em "Comissões a
   receber": abre a tela de Comissões.
4. **Menu.** Olhe a barra da esquerda.
   → Grupos Comercial, Contratos, Financeiro, Gestão, Configurações. Embaixo do nome da imobiliária,
   "Perfil: Venda". **Não** aparecem Manutenção, Automações, Marketing, Integrações nem Corretores
   Parceiros.
5. **Atalhos do Financeiro.** Clique em "A Pagar".
   → Abre Financeiro já na aba "Contas a Pagar". Clique em "Fluxo de Caixa": abre a aba Fluxo de Caixa.
6. **Rota oculta.** Digite na barra de endereço: `.../maintenance`.
   → Aparece "Módulo não disponível neste perfil", com botões para o Dashboard e Configurações.
7. **Contrato.** Vá em Contratos → Novo contrato e abra o campo "Tipo".
   → Só aparecem "Compra e Venda" e "Intermediação". Não aparece a seção "Corretores Parceiros".
8. **Visitas.** Clique em Visitas → "Agendar visita", preencha título e data e salve.
   → A visita aparece em "A realizar". Clique em "Realizada": ela passa para "Realizadas recentemente".
   No Dashboard, "Visitas da semana" conta essa visita se a data for desta semana.
9. **Boletos.** Abra Financeiro → Boletos e PIX.
   → Se o Asaas **não** estiver configurado: aviso amarelo "Emissão de boleto e PIX não disponível".
   Boletos antigos sem gateway aparecem com "simulado — sem validade bancária". Em Financeiro → A
   Receber, "Gerar boleto" mostra a mensagem de que não há gateway (não gera boleto falso).
10. **Notas Fiscais.** Abra Notas Fiscais.
    → Aviso "Emissão de NFS-e ainda não disponível". Notas antigas sem número aparecem como
    "Registro interno — não emitida". Não existe aba Carnê-Leão no perfil Venda.
11. **Trocar o perfil.** Vá em Configurações → Workspace → "Perfil de operação", escolha
    "Venda e Locação" e clique em "Salvar perfil".
    → Mensagem de sucesso. O menu ganha o grupo "Locação e avançados" e `.../maintenance` abre
    normalmente. **Volte para "Venda"** e salve de novo.
12. **Erro de conexão.** Com o sistema aberto, desligue o Wi-Fi e clique em Clientes.
    → Aparece "Erro de conexão" com o botão "Tentar de novo", e não "Nenhum contato encontrado".
    Religue o Wi-Fi e clique em "Tentar de novo": a lista volta.
13. **Regime fiscal.** Ainda não existe tela de configuração fiscal (ela chega na Fase 6, com todas
    as alíquotas editáveis). Nesta fase, a conferência é técnica: o teste automático garante que
    toda configuração nova nasce como Lucro Presumido.

## 6. Script para validar

`validar-fase-1.bat` (na raiz do projeto):
1. Abra o **Docker Desktop** e espere a baleia ficar verde.
2. Dê dois cliques em `validar-fase-1.bat`, na pasta do projeto.
3. Espere. Na primeira vez demora alguns minutos.
4. No final deve aparecer **"FASE 1 VALIDADA"**. Se aparecer "ERRO", copie as linhas vermelhas e me envie.

O script não altera o sistema no ar: ele só baixa esta versão e roda a compilação e os testes dentro
do Docker (container `node:20-alpine`).
