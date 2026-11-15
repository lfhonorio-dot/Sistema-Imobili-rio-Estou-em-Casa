# FASE 4 — Contrato de venda e pós-venda

Branch: `feat/fase-4-contrato-venda` · Construída **em cima da Fase 3** (`feat/fase-3-funil-venda`).
**Ordem de merge:** #11 (Fase 1) → #12 (Decimal) → #13 (Fase 2) → #14 (Fase 3) → esta fase.

## 1. O que foi feito (em linguagem simples)

### O problema que existia
O contrato "Compra e Venda" lançava como **conta a receber o valor inteiro do imóvel** (ex.: R$ 390 mil),
como se a imobiliária fosse receber o dinheiro da venda. A comissão ficava no nome de quem digitou o
contrato, e nada era lançado como "a pagar" para os corretores. Isso acabou.

### Contrato de venda nasce como rascunho
- Criar o contrato (inclusive pelo "Ganho" no funil) **não lança nada no financeiro** e não marca o imóvel
  como vendido.
- Aparece um aviso azul: "Venda em rascunho… Ativar venda".

### Ativar venda (tudo de uma vez: ou grava tudo, ou nada)
Ao clicar em **Ativar venda**, você informa:
- a **comissão total** da imobiliária (vem preenchida: valor da venda × taxa; pode ajustar se negociou);
- **quem paga a comissão** (normalmente o vendedor);
- em **quantas parcelas** a comissão será recebida e o 1º vencimento (mensais);
- o **corretor vendedor** e o % da comissão dele;
- o **corretor captador**, que vem sugerido pela autorização de venda do imóvel, e o % dele;
- a **forma de pagamento da compra** (à vista, financiamento, FGTS, permuta, misto);
- se há **pagamento em espécie**, e de quanto.

Os **corretores parceiros** cadastrados no contrato entram sozinhos, com o percentual deles.

Antes de confirmar, aparece a **prévia**: as parcelas a receber, quanto cada corretor recebe e quanto
fica para a imobiliária. A conta é feita em centavos exatos, sem sobras nem faltas.

Ao confirmar, numa única operação:
1. o contrato fica **Ativo** e o imóvel vira **Vendido**;
2. são criadas as **contas a receber** da comissão (uma por parcela, no nome de quem paga);
3. são criadas as **contas a pagar** de comissão do corretor vendedor, do captador e dos parceiros,
   **divididas na mesma proporção das parcelas** e com o mesmo vencimento de cada uma. A nota de cada
   conta diz "pagar depois do recebimento da parcela correspondente";
4. a venda é **registrada na DIMOB**, agora dentro da mesma operação (antes, um erro ali ficava só no log);
5. é criado o **checklist de pós-venda**.

**Exemplo:** venda de R$ 390.000 a 6% gera R$ 23.400 de comissão, em 2 parcelas de R$ 11.700. Com
vendedor 30%, captador 10% e parceiro 20%:
- **a receber:** 2 × R$ 11.700;
- **a pagar:** vendedor R$ 7.020 (2 × R$ 3.510), captador R$ 2.340 e parceiro R$ 4.680;
- **fica para a imobiliária:** R$ 9.360.

### Pagamento em espécie
- Se houve dinheiro vivo, a venda fica marcada como **"Pagamento em espécie aguardando análise do
  responsável"**.
- A partir de **R$ 100 mil**, o aviso lembra de **avaliar a comunicação ao COAF**.
- O responsável clica em **"Registrar análise"** e escreve a conclusão. Fica gravado quem analisou, quando e o quê.

### Checklist de pós-venda (aba "Pós-venda" do contrato)
Os 7 itens nascem com responsável e prazo:
- documentos das partes;
- aprovação de crédito;
- avaliação do banco;
- ITBI;
- escritura;
- registro;
- entrega das chaves.

Detalhes:
- **Itens de financiamento:** "Aprovação de crédito" e "Avaliação do banco" já nascem como "Não se aplica"
  quando a compra é à vista ou permuta.
- **Ações em cada item:** concluir (o sistema anota quem concluiu e quando), marcar "não se aplica",
  reabrir, trocar o responsável e o prazo.
- **Atrasos:** item atrasado fica em vermelho.
- **Itens extras:** dá para acrescentar (ex.: "quitar condomínio atrasado").

### Rescindir venda
Botão **Rescindir venda**, com motivo obrigatório. Numa única operação, e **sem apagar nada**:
- contas a receber e a pagar ainda **em aberto** ficam **Canceladas**, com o motivo visível;
- o que **já foi pago** ganha um lançamento de **estorno** (o oposto: uma parcela recebida vira "a pagar"
  de devolução), pendente. Se não houver devolução, você cancela esse estorno informando o motivo;
- o imóvel volta a ficar **Disponível**;
- a venda **sai da DIMOB**. O registro não é apagado, fica marcado como removido;
- o checklist pendente é encerrado, e os itens já concluídos ficam no histórico;
- se houver **boletos emitidos**, o sistema avisa para cancelá-los no Asaas. O cancelamento automático
  no banco é da Fase 5.

### Tela Comissões
Ganhou a seção **"Comissões das vendas"**: parcelas a receber da imobiliária e repasses a pagar aos
corretores e parceiros, com o total em aberto e botões "Recebida" e "Paga". A lista antiga continua
embaixo, para os contratos criados antes desta fase.

### Outras correções desta fase
- **DIMOB:** deixou de apagar registros fisicamente (regra 2). Passou a marcar como removidos.
- **Dashboard:**
  - "Propostas em aberto" mostra o número real (antes dizia "não disponível");
  - "Comissões a receber" soma as parcelas;
  - "Vendas do mês" conta pela data de ativação.
- **Quadro "Cálculo da comissão":** usa a comissão combinada na ativação.
- **Alterar Status:** o botão genérico não ativa nem rescinde mais venda. Ele indica "Ativar venda" ou
  "Rescindir venda".

### O que ficou de fora / atenção
- **Contratos de venda criados antes desta versão** continuam com os lançamentos antigos (inclusive o
  valor do imóvel a receber, se for "Compra e Venda"). Não mexi neles automaticamente. Se quiser, dá para
  rescindir e refazer pelo fluxo novo. Me diga se prefere uma correção em lote.
- **Cancelamento e reemissão de boleto no Asaas:** Fase 5.
- **Baixa parcial, juros e multa:** Fase 5.
- **Bloqueio de quem pode ativar, rescindir e analisar espécie (papéis Dono, Financeiro, Gerente,
  Corretor):** Fase 7. Hoje qualquer usuário da imobiliária pode, e tudo fica registrado na auditoria.

## 2. Arquivos alterados e migration

**Migration (somente aditiva):** `backend/prisma/migrations/20261114180000_fase4_contrato_venda/migration.sql`
- `contracts`, colunas novas: `activatedAt`, `commissionAmount`, `commissionPayerId`, `cashInvolved`,
  `cashAmount`, `cashReviewStatus`, `cashReviewNote`, `cashReviewedById`, `cashReviewedAt`, `rescindedAt`,
  `rescissionReason`.
- `financial_entries`, colunas novas: `beneficiaryUserId`, `sourceEntryId`, `cancelledAt`, `cancelReason`.
- `dimob_records`, coluna nova: `deletedAt`.
- Tabela nova: `contract_checklist_items`.
- Testada do zero e em cima do banco de teste com dados. O banco final bate com o schema.

**Backend (novos):**
- `contracts/sale-settlement.ts` (conta das parcelas e repasses) e `sale-settlement.spec.ts`
- `contracts/sale-lifecycle.{service,controller,dto}.ts`
- `test/api/fase4-contrato-venda.mjs`

**Backend (alterados):**
- `schema.prisma`
- `contracts.service.ts` (venda nasce sem lançamentos; status genérico encaminha)
- `contracts.module.ts`
- `commission-breakdown.ts` (+ teste)
- `fiscal/dimob.service.ts` (sem apagar; dentro da transação)
- `fiscal/fiscal.service.ts`
- `financial.{dto,service}.ts` (filtro por categoria)
- `reports.service.ts` (+ teste)

**Frontend (novos):**
- `hooks/use-sale.ts`
- `components/contracts/sale-panels.tsx` (Ativar, Rescindir, avisos, Pós-venda)
- `components/contracts/sale-commissions-section.tsx`

**Frontend (alterados):**
- `contracts/[id]/page.tsx`
- `commissions/page.tsx`
- `components/erp/financial-entry-row.tsx` (motivo do cancelamento)
- `hooks/use-financial.ts`

**Raiz:** `validar-fase-4.bat`.

## 3. Variáveis de ambiente novas

**Nenhuma.**

## 4. Resultado do build e dos testes

- **Backend:** `npm run build` e `tsc --noEmit` sem erros. **jest: 112 testes, 112 passando** (9 novos).
- **Roteiro de ponta a ponta contra a API real e PostgreSQL (`test/api/fase4-contrato-venda.mjs`):
  33 de 33.** Cobre:
  - rascunho sem lançamento e sem DIMOB;
  - status genérico recusado;
  - prévia exata;
  - parcelas que não fecham e repasses acima de 100% recusados;
  - espécie sem valor recusada;
  - ativação com 2 a receber e 6 a pagar, imóvel vendido e DIMOB;
  - ativação dupla recusada;
  - checklist;
  - análise de espécie;
  - rescisão com 6 cancelados e 2 estornos, nada apagado, imóvel disponível e saída da DIMOB;
  - **isolamento entre imobiliárias**.
- No banco, confirmei que o registro da DIMOB removido **continua lá, marcado** (não foi apagado).
- **Roteiros anteriores repetidos:** Fase 2 com 36 de 36 e Fase 3 com 28 de 28.
- **Frontend:** `tsc --noEmit` e `npm run build` sem erros.
- **Navegador, com login real contra o backend real: 14 de 14**, sem erros de JavaScript.

## 5. Roteiro de teste manual (homologação)

1. **Preparação.** Tenha um imóvel com autorização de venda (6%, captador escolhido) e um negócio ganho,
   ou crie um contrato "Compra e Venda" em Contratos → Novo.
   → O contrato abre com **"Venda em rascunho"** e a aba Financeiro vazia. O imóvel continua "Disponível".
2. **Prévia.** Clique **Ativar venda**.
   → A comissão vem preenchida e o captador vem da autorização. Escolha 2 parcelas, corretor vendedor 30%
   e captador 10%, depois "Atualizar prévia": aparecem as 2 parcelas, o valor de cada corretor e o que fica
   para a imobiliária.
3. **Erro de soma.** Coloque vendedor 80% e captador 30%, depois "Atualizar prévia".
   → Mensagem "A soma dos repasses… passa de 100%". Volte para 30% e 10%.
4. **Espécie.** Marque "Há pagamento em espécie" e digite 50.000,00.
   → Aparece o aviso de análise.
5. **Ativar.** Clique "Ativar venda" e confirme.
   → Mensagem de sucesso. O imóvel fica **Vendido**. A aba **Financeiro** mostra "Comissão de venda —
   C-… (parcela 1/2 e 2/2)" e as comissões dos corretores. **Não** aparece o valor do imóvel.
6. **Análise da espécie.** Clique **Registrar análise** e escreva a conclusão.
   → O aviso amarelo some e aparece "analisado em dd/mm: …".
7. **Pós-venda.** Abra a aba **Pós-venda**.
   → 7 itens com prazo e responsável. Conclua "Documentos das partes" e acrescente um item extra.
8. **Comissões.** Abra o menu **Comissões**.
   → Em "Comissões das vendas" aparecem as parcelas a receber e os repasses a pagar.
9. **Receber e pagar.** Marque a parcela 1 como "Recebida" e o repasse do vendedor da parcela 1 como "Pago".
10. **Rescindir.** Volte ao contrato → **Rescindir venda** → motivo "Financiamento negado" → confirmar.
    → O contrato fica **Rescindido** e o imóvel volta a **Disponível**. Na aba Financeiro, os lançamentos em
    aberto aparecem "Cancelado: Rescisão da venda… Financiamento negado", e há 2 **estornos** pendentes
    (a devolução da parcela recebida e o retorno do repasse pago).
11. **DIMOB.** Em Fiscal — DIMOB, exporte o ano.
    → A venda rescindida **não** aparece.

## 6. Script para validar

`validar-fase-4.bat`, na raiz do projeto:
1. Abra o **Docker Desktop** e espere a baleia ficar verde.
2. Dê dois cliques em `validar-fase-4.bat`.
3. No fim deve aparecer **"FASE 4 VALIDADA"**. Se aparecer "ERRO", copie as linhas vermelhas e me envie.

O script não altera o sistema que está no ar.
