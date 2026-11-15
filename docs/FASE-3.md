# FASE 3 — Funil de venda

Branch: `feat/fase-3-funil-venda` · Construída **em cima da Fase 2** (`feat/fase-2-cadastros`).
**Ordem de merge:** Fase 1 (#11) → Decimal (#12) → Fase 2 (#13) → esta fase.

## 1. O que foi feito (em linguagem simples)

### Etapas padrão do funil
Cada imobiliária ganhou o **"Funil de Venda"** com as etapas que você definiu:
**Novo lead → Atendimento → Visita agendada → Visita realizada → Proposta → Negociação →
Documentação → Ganho / Perdido.**
- Ele vira o funil padrão, ou seja, o que abre primeiro na tela Funil.
- Funis antigos e os negócios que estão neles **não foram mexidos** e continuam disponíveis nas abas da tela.
- Imobiliária nova já nasce com esse funil.

O negócio **avança sozinho** (só para frente, nunca para trás):

| Ação | Etapa do negócio |
|---|---|
| Agendar visita | vai para "Visita agendada" |
| Registrar a visita como realizada | vai para "Visita realizada" |
| Registrar proposta | vai para "Proposta" |
| Contraproposta | vai para "Negociação" |
| Aceitar proposta | vai para "Documentação"; o valor do negócio passa a ser o valor aceito (entra no VGV do Dashboard) |

### Visitas
- **Agendar visita:** pelo negócio ou pela tela Visitas, com imóvel, cliente, data e hora, duração e
  **corretor** que acompanha.
- **Conflito de horário:** o sistema não deixa marcar duas visitas do mesmo corretor no mesmo horário.
- **Agenda e tarefas:** a visita entra na agenda do corretor (Tarefas → Pendentes e calendário) como
  tarefa do tipo "Visita".
- **Retorno do cliente:** ao concluir, o corretor informa o **interesse do cliente** (alto, médio,
  baixo, nenhum), que é obrigatório, e o **retorno** em texto.
- **Cancelar:** dá para cancelar (com motivo) ou marcar "cliente não compareceu".
- **Tela Visitas:** agenda por dia, com filtros Próximas / Anteriores / Todas e **"Minhas visitas"**.

### Propostas
- **Valor e validade** da proposta.
- **Forma de pagamento:** à vista, financiamento, FGTS, permuta ou misto. O sistema confere a conta:
  - financiamento exige o valor financiado;
  - FGTS exige o valor do FGTS;
  - permuta exige a descrição do bem;
  - no misto, entrada + financiamento + FGTS têm de somar exatamente o valor;
  - as partes nunca podem passar do total.
- **Contraproposta:** responde a proposta. A anterior fica no **histórico** como "Respondida".
- **Uma proposta em aberto por vez** em cada negócio, para o histórico ficar claro.
- **Aceitar, recusar (com motivo obrigatório) ou retirar.**
- **Proposta vencida:** aparece como "Vencida" e não pode ser aceita.
- **Botão "PDF":** abre a proposta formatada (comprador, vendedores, imóvel, matrícula, valores,
  condições, linhas de assinatura) com o botão **"Imprimir / salvar em PDF"**. Para salvar o
  arquivo, escolha "Salvar como PDF" na janela de impressão.

### Motivo de perda
- Mover para **Perdido** só funciona escolhendo um motivo: preço, financiamento negado, comprou outro
  imóvel, desistiu, sem retorno, imóvel vendido para outro, documentação, localização ou outro.
- No quadro (kanban), arrastar um negócio para "Perdido" abre essa janela de motivo.
- O motivo aparece em destaque no negócio.

### "Meus negócios" e "Minhas tarefas"
- Funil: botão **Todos / Meus negócios** (negócios em que você é o responsável).
- Tarefas: caixa **"Só minhas tarefas"**. A aba virou "Pendentes" e agora mostra também as visitas.
- Corrigido o filtro de período das tarefas: antes, a data final apagava a inicial.

### Ganho → contrato de venda já preenchido
Ao mover um negócio para **Ganho**, no detalhe ou arrastando no quadro, o sistema abre direto o
**Novo Contrato** já preenchido com:
- o imóvel;
- o proprietário (vendedor);
- o comprador;
- o **valor da proposta aceita**;
- a **comissão** da autorização de venda do imóvel;
- a forma de pagamento.

Um quadro azul mostra os **avisos** antes de salvar: comprador casado sem cônjuge, imóvel com vários
donos, autorização vencida, nenhuma proposta aceita etc.

O contrato fica **ligado ao negócio**, e o sistema não deixa criar um segundo contrato para o mesmo
negócio. Se já existir, o Ganho abre o contrato existente.

Também foi retirado o `TODO`/`console.log` que existia no "Ganho" (achado da revisão de setembro).

### Corrigido de passagem
- Mudar a etapa de um negócio aceitava uma etapa de **outro funil**, o que deixava o negócio
  inconsistente. Agora só aceita etapas do mesmo funil.

### O que ficou de fora
- **Financeiro do contrato de venda (Fase 4).** O contrato "Compra e Venda" ainda lança como "a
  receber" o valor inteiro do imóvel, um problema já apontado no inventário. A Fase 4 corrige isso:
  ao ativar o contrato, o sistema vai gerar só as comissões a receber e a pagar.
- **PDF da proposta:** é gerado pelo navegador (imprimir → salvar como PDF), sem biblioteca nova no
  servidor.
- **Calendário visual de visitas:** a tela de Visitas mostra a agenda por dia; o calendário mensal da
  tela Tarefas mostra as visitas junto com as tarefas.

## 2. Arquivos alterados e migration

**Migration (somente aditiva):** `backend/prisma/migrations/20261114160000_fase3_funil_venda/migration.sql`
- Tabelas novas: `visits` e `proposals`.
- Colunas novas: `pipeline_stages.stageKey` e `contracts.dealId`.
- Marca o papel das etapas antigas pelo nome.
- Cria o "Funil de Venda" padrão em cada imobiliária e o deixa como padrão. Os outros funis de venda
  deixam de ser o padrão, mas continuam existindo.
- **Conferida em PostgreSQL 16:** do zero e em cima do banco de teste da Fase 2. No banco com dados,
  cada uma das 7 imobiliárias ganhou o funil com as 9 etapas, e o banco final bate com o schema.

**Backend (novos):**
- `modules/crm/funnel/`: `funnel.module.ts`, `funnel.controller.ts`, `funnel.dto.ts`,
  `visits.service.ts`, `proposals.service.ts`, `deal-funnel.service.ts`, `funnel-rules.ts` e
  `funnel-rules.spec.ts`.
- `modules/crm/pipelines/funnel-stages.ts`.
- `test/api/fase3-funil.mjs`.

**Backend (alterados):**
- `schema.prisma`
- `crm.module.ts`
- `pipelines.service.ts`: funil padrão e criação automática para imobiliária nova.
- `deals.{dto,service,controller}.ts`: imóveis no negócio, "meus negócios", etapa do mesmo funil,
  motivo de perda, Ganho → contrato.
- `activities.{dto,service}.ts`: "minhas tarefas" e filtro de período.
- `contracts.{dto,service}.ts`: `dealId` e bloqueio de contrato duplicado.

**Frontend (novos):**
- `lib/funnel.ts`
- `hooks/use-funnel.ts`
- `components/funnel/visit-forms.tsx`, `proposal-form.tsx` e `deal-panels.tsx`

**Frontend (alterados):**
- `app/(dashboard)/pipeline/page.tsx`
- `deals/[id]/page.tsx`
- `visits/page.tsx`
- `tasks/page.tsx`
- `contracts/new/page.tsx`
- `components/crm/kanban-board.tsx` e `deal-form.tsx`
- `hooks/use-deals.ts`, `use-activities.ts` e `use-pipelines.ts`

**Raiz:** `validar-fase-3.bat`.

## 3. Variáveis de ambiente novas

**Nenhuma.**

## 4. Resultado do build e dos testes

- **Backend:** `npm run build` e `tsc --noEmit` sem erros. **jest: 103 testes, 103 passando**
  (12 novos de regras do funil).
- **Roteiro de ponta a ponta contra a API real e PostgreSQL (`test/api/fase3-funil.mjs`): 28 de 28.**
  Cobre:
  - o funil padrão;
  - visita avançando o funil, com bloqueio de horário duplicado;
  - visita em "minhas tarefas" e o filtro de período;
  - retorno obrigatório da visita;
  - conferência do pagamento misto e uma proposta em aberto por vez;
  - contraproposta, recusa com motivo e aceite;
  - documento da proposta;
  - valor aceito no negócio;
  - perda sem motivo recusada e etapa de outro funil recusada;
  - Ganho → assistente de contrato, com o rascunho preenchido e os avisos;
  - bloqueio de contrato duplicado;
  - "meus negócios";
  - **isolamento entre imobiliárias**.
- **Roteiro da Fase 2 rodado de novo, para conferir que nada quebrou:** 36 de 36.
- **Frontend:** `tsc --noEmit` e `npm run build` sem erros.
- **Navegador, com login real contra o backend real: 14 de 14**, sem erros de JavaScript.

## 5. Roteiro de teste manual (homologação)

Faça depois de mesclar as fases anteriores e esta, quando o Railway terminar o deploy.

1. **Funil.** Abra **Funil**.
   → Aparece "Funil de venda" com as 9 colunas: Novo lead… Ganho, Perdido.
2. **Novo negócio.** "Novo Negócio" → título, cliente comprador e **Imóvel de interesse** → criar.
   → O cartão aparece em "Novo lead".
3. **Agendar visita.** Abra o negócio → quadro **Visitas** → "Agendar" → data e hora → "Agendar visita".
   → Mensagem "Negócio movido para Visita agendada". A visita aparece em **Visitas** (menu) e em
   **Tarefas → Pendentes**.
4. **Horário ocupado.** Tente agendar outra visita sua 30 minutos depois da primeira.
   → Mensagem "O corretor já tem uma visita marcada nesse horário".
5. **Visita realizada.** No negócio, clique **Realizada** → escolha o interesse (ex.: Alto) e escreva o
   retorno → "Registrar visita realizada".
   → O negócio vai para "Visita realizada" e o retorno aparece no quadro.
6. **Proposta.** Quadro **Propostas** → "Nova proposta" → valor 380.000,00, forma "Financiamento
   bancário", entrada 80.000,00 e financiado 300.000,00 → registrar.
   → O negócio vai para "Proposta". Teste também "Misto" com valores que não fecham: aparece o erro.
7. **Contraproposta.** Na proposta, "Contraproposta" → 390.000,00 → registrar.
   → A primeira fica "Respondida (contraproposta)" e a nova "Em aberto". O negócio vai para "Negociação".
8. **PDF.** Clique **PDF** na contraproposta.
   → Abre a proposta formatada. Clique "Imprimir / salvar em PDF" e escolha "Salvar como PDF".
9. **Aceitar.** Clique **Aceitar** e confirme.
   → O negócio vai para "Documentação" e o **Valor** passa a R$ 390.000,00.
10. **Ganho.** "Mover Etapa" → **Ganho** → "Mover".
    → Abre o **Novo Contrato** já preenchido (imóvel, vendedor, comprador, R$ 390.000,00, comissão da
    autorização), com o quadro azul de avisos. Confira e salve.
    → Mover o mesmo negócio para Ganho de novo abre o contrato existente, e não um novo.
11. **Perdido.** Em outro negócio, arraste o cartão para **Perdido** no quadro.
    → Abre a janela pedindo o motivo, e o botão só libera depois de escolher. Escolha "Financiamento
    negado": no negócio aparece "Perdido — motivo: Financiamento negado".
12. **Meus negócios.** No Funil, clique "Meus negócios".
    → Só aparecem os negócios em que você é o responsável.
13. **Minhas tarefas.** Em Tarefas → Pendentes, marque "Só minhas tarefas".
    → Só aparecem as suas tarefas e visitas.

## 6. Script para validar

`validar-fase-3.bat`, na raiz do projeto:
1. Abra o **Docker Desktop** e espere a baleia ficar verde.
2. Dê dois cliques em `validar-fase-3.bat`.
3. No fim deve aparecer **"FASE 3 VALIDADA"**. Se aparecer "ERRO", copie as linhas vermelhas e me envie.

O script não altera o sistema que está no ar.
