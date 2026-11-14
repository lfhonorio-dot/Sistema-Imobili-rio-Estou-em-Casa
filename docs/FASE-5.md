# FASE 5 — Financeiro (baixas, boleto e PIX, fluxo de caixa, DRE, bancário)

Branch: `feat/fase-5-financeiro` · Construída **em cima da Fase 4** (`feat/fase-4-contrato-venda`).
**Ordem de merge:** #11 (Fase 1) → #12 (Decimal) → #13 (Fase 2) → #14 (Fase 3) → #15 (Fase 4) → esta fase.

## 1. O que foi feito (em linguagem simples)

### Contas a receber e a pagar
- **Baixa parcial:** dá para receber/pagar só uma parte. A conta continua em aberto, aparece a etiqueta
  **"Parcial"** e a coluna **"Em aberto"** mostra o que falta.
- **Multa, juros e desconto:** ao dar baixa numa conta atrasada, o sistema já **sugere** a multa e os juros
  (padrão 2% de multa + 1% ao mês, proporcional aos dias). Você pode mudar os valores ou dar desconto.
- **Data, forma de pagamento, conta bancária e comprovante** (PDF ou foto) em cada baixa.
- **Estornar uma baixa** (com motivo): a conta volta a ficar em aberto. Nada é apagado; a baixa estornada
  fica riscada no histórico com o motivo.
- **Cancelar uma conta** exige **motivo**. Se ela tiver boleto/PIX emitido, o sistema **cancela primeiro no
  Asaas**; se o Asaas recusar, nada é cancelado e aparece o erro. Conta com baixa não pode ser cancelada
  (estorne antes).
- **Editar** conta em aberto e sem baixa. Se já tiver boleto/PIX, valor e vencimento só mudam pela
  **reemissão** (para o pagador não ficar com um boleto errado).
- **Detalhes** de cada conta (clique no nome): histórico de baixas, comprovantes, cobranças e ações.
- Filtros por situação (em aberto, atrasadas, parciais, quitadas, canceladas), categoria, centro de custo e busca.

### Plano de categorias e centros de custo (Financeiro → Configurações)
- Cada imobiliária ganha um **plano de categorias** de receita e de despesa (Comissão de venda, Impostos,
  Pessoal e pró-labore, Aluguel do escritório, Água/luz/internet, Marketing e portais, Serviços de terceiros,
  Tarifas bancárias etc.). Você pode **criar, renomear, desativar** e remover as suas (as padrão só desativam).
- **Centros de custo** simples (ex.: Vendas, Administrativo, Marketing), escolhidos em cada lançamento.

### Recorrência mensal de verdade
- Antes, "repetir" criava várias contas de uma vez. Agora existe **Recorrência** (Configurações): ex.
  "Aluguel do escritório, dia 10, R$ 2.500". O sistema gera **um lançamento por mês**, todo dia às 6h, até o
  mês seguinte — **sem duplicar**. Dá para alterar o valor (vale para os próximos meses), pausar e encerrar.

### Boleto e PIX (os dois), pelo Asaas
- Em cada conta a receber, botão **"Cobrar"** → você escolhe **Boleto** (linha digitável + PDF) ou **PIX**
  (QR Code + copia-e-cola). Ou continua registrando o recebimento manual (transferência, dinheiro).
- **Baixa automática:** quando o pagador paga, o Asaas avisa o sistema (webhook) e a conta é baixada sozinha,
  já com juros/multa/desconto que o banco aplicou. Cada aviso é processado **uma única vez** (o Asaas às vezes
  manda repetido) e o aviso só é aceito com o **token secreto** correto.
- **Cancelar** ou **Reemitir** (nova data e/ou trocar boleto↔PIX) cancela também no Asaas.
- **Enviar ao pagador** por **e-mail** e/ou **WhatsApp**. Se o envio falhar (SMTP ou WhatsApp não configurado,
  pagador sem e-mail/celular), aparece o **erro específico** — nunca "enviado" sem ter enviado.
- Para evitar pagamento em dobro, a **baixa manual fica bloqueada** enquanto há boleto/PIX ativo na conta.
- A tela **Boletos e PIX** agora tem a configuração do Asaas: chave de API (guardada **criptografada** com
  a chave do sistema), ambiente (teste/produção), **teste de conexão**, **endereço e token do webhook** e a
  conta bancária onde o Asaas deposita (para o fluxo de caixa por conta).

### Fluxo de caixa (Financeiro → Fluxo de Caixa)
- **Realizado** (o que entrou/saiu de fato, pela data da baixa) × **Projetado** (realizado + contas em aberto
  pelo vencimento; as vencidas aparecem "hoje").
- Visão **mensal ou diária**, por **período** e por **conta bancária**, partindo do **saldo inicial** das contas.
- **Exportar para Excel** (.xlsx).

### DRE gerencial (Financeiro → DRE)
- Por **regime de caixa**: receitas e despesas efetivamente recebidas/pagas, **por mês e por categoria**,
  com o resultado. **Exportar para Excel**. (É gerencial; não substitui a contabilidade oficial.)

### Bancário (Financeiro → Bancário) — confirmado e ligado ao financeiro
- Contas com **saldo inicial e data**; o saldo mostrado é saldo inicial + extrato.
- **Importar extrato** em **OFX, CSV ou Excel**. Reimportar o mesmo arquivo não duplica.
- **Conciliar** cada movimento: o sistema sugere a conta a pagar/receber de valor compatível. Conciliar
  **registra a baixa** da conta (na conta bancária certa). Se a conta já tinha sido baixada pelo Asaas, a
  conciliação só **liga** o extrato à baixa existente. Tarifas e rendimentos podem ser conciliados sem conta,
  com observação. **Conciliação automática** (só quando há um único candidato de valor exato) e **desfazer**
  (estorna a baixa que a conciliação criou).
- **Razão bancário**: saldo anterior, cada movimento e o saldo acumulado.

### Vendas antigas (correção em lote autorizada)
- O sistema antigo lançava o **valor do imóvel** como "a receber" nas vendas. A atualização **cancela** (não
  apaga) esses lançamentos que ainda estavam **em aberto e sem boleto ativo**, com o motivo "Correção
  automática (Fase 5)…". Lançamentos já pagos ou com boleto ativo **não são tocados**.
- Em **Configurações → Vendas antigas** aparecem as vendas ativas do sistema antigo que ainda não têm a
  comissão no financeiro, com a comissão sugerida. **"Lançar comissão"** cria a conta a receber (e os repasses
  dos parceiros cadastrados), numa única operação, sem mexer no imóvel nem na DIMOB.
- **Rescisão de venda** agora também **cancela no Asaas** os boletos/PIX em aberto do contrato, e estorna o que
  já tinha sido baixado parcialmente.

### Outras correções desta fase
- "Recebido no mês", "A receber", "A pagar" e o painel de vendas passam a considerar **baixas parciais**.
- O saldo bancário do painel usa saldo inicial + extrato.
- Erro de rede com o Asaas agora vira mensagem clara ("Não foi possível falar com o Asaas agora…") em vez de
  "erro interno".
- A chave do Asaas deixou de usar uma criptografia fraca com chave escrita no código (chaves antigas
  continuam funcionando; ao salvar de novo, passam para o formato novo).
- Telas do financeiro diferenciam **erro de conexão** de **lista vazia** (regra 10).

### O que ficou de fora / atenção
- **WhatsApp fora da janela de 24h:** a Meta só entrega mensagem livre para quem falou com você nas últimas
  24h. Para cobrar qualquer pagador, crie um **modelo (template) aprovado** na Meta e informe o nome em
  `WHATSAPP_COBRANCA_TEMPLATE` (ver seção 3). Sem isso, a Meta pode aceitar e depois não entregar.
- **Devolver dinheiro ao pagador** (estorno no Asaas) continua sendo feito no painel do Asaas; quando o Asaas
  avisa o estorno, o sistema estorna a baixa automaticamente.
- **NFS-e** é a Fase 6 (aguardando você escolher o provedor). Open Finance segue escondido.
- Split no boleto: só repasses em **percentual** com carteira Asaas do parceiro (valor fixo vai pelo financeiro).

## 2. Arquivos alterados e migration

**Migration (só aditiva):** `backend/prisma/migrations/20261114200000_fase5_financeiro/migration.sql`
- Colunas novas: `financial_entries` (costCenterId, recurrenceId, competence); `boletos` (kind, entryRef,
  cancelReason, lastSentAt, lastSentChannels); `bank_accounts` (openingBalance, openingDate);
  `bank_transactions` (paymentId).
- Tabelas novas: `financial_payments`, `financial_categories`, `cost_centers`, `recurring_entries`,
  `workspace_financial_settings`, `gateway_webhook_events`.
- Dados: cria uma baixa "Histórico" para cada conta já paga (para o fluxo de caixa e o DRE enxergarem o
  passado); plano de categorias padrão e multa/juros padrão por imobiliária; correção das vendas antigas.
- Nenhuma coluna existente foi alterada ou removida.

**Backend:** `modules/erp/financial/` (payments.service, settlement-math, financial-config.service,
recurring.service, cashflow(.service), financial-ops.controller, payments.module, financial.service/dto/module),
`modules/erp/billing/` (billing.service reescrito, asaas.client, dto, controller, module),
`modules/erp/banking/` (banking.service reescrito, statement-parser, dto, controller, module),
`modules/erp/contracts/sale-lifecycle.*` (rescisão e vendas antigas), `modules/reports/reports.service.ts`.
Nova dependência: `exceljs` 4.4.0.

**Frontend:** `app/(dashboard)/financial/page.tsx`, `financial/billing/page.tsx`, `financial/banking/page.tsx`,
`components/finance/*` (novos), `components/erp/financial-entry-form.tsx`, `hooks/use-finance.ts` (novo),
`hooks/use-financial.ts`, `lib/api.ts`, `lib/navigation.ts`.

**Testes:** specs novos (settlement-math, cashflow, statement-parser, billing, financial) e roteiro de ponta a
ponta `backend/test/api/fase5-financeiro.mjs` (com Asaas simulado).

## 3. Variáveis de ambiente

**Nenhuma variável obrigatória nova.** A chave do Asaas passa a ser criptografada com a `ENCRYPTION_KEY` que já
existe no Railway. **Não troque a `ENCRYPTION_KEY`** depois de cadastrar o Asaas (se trocar, cadastre a chave
do Asaas de novo).

Opcional — `WHATSAPP_COBRANCA_TEMPLATE` (nome do modelo aprovado na Meta para cobranças, com 4 variáveis na
ordem: nome, valor, vencimento, link/código de pagamento). Para colocar no Railway:
1. Entre em railway.app → seu projeto → clique no serviço do **backend**.
2. Aba **Variables** → **New Variable**.
3. Nome: `WHATSAPP_COBRANCA_TEMPLATE` · Valor: o nome do modelo (ex.: `cobranca_imobiliaria`) → **Add**.
4. O Railway reinicia o backend sozinho.

⚠️ `ASAAS_API_URL_TEST_OVERRIDE` existe **só para os testes automáticos**. **Nunca** crie essa variável no Railway
(ela é ignorada em produção de qualquer forma).

### Configurar o Asaas (depois do merge)
1. No Asaas (comece pelo **Sandbox**, de teste): Integrações → **Chave de API** → gerar e copiar.
2. No sistema: **Financeiro → Boletos e PIX** → cole a chave, escolha o ambiente, a conta onde o Asaas deposita
   → **Cadastrar Asaas** → **Testar conexão**.
3. Clique em **Gerar token**, copie o **endereço** e o **token** mostrados.
4. No Asaas: Integrações → **Webhooks** → adicionar: cole o endereço, cole o token no campo "Token de
   autenticação", marque os eventos de **cobrança** (recebida, confirmada, vencida, removida, estornada) e salve.
5. Faça uma cobrança de teste no Sandbox e "pague" pelo próprio Asaas: a conta deve ficar **Quitada** sozinha.
6. Quando estiver tudo certo, troque para a chave de **Produção** (e refaça os passos 3–4 no Asaas de produção).

## 4. Resultado do build e dos testes

| Verificação | Resultado |
|---|---|
| Backend `npm run build` | OK |
| Backend `tsc --noEmit` | OK |
| Backend `jest` | **136/136** testes passando (21 suítes) |
| Frontend `tsc --noEmit` | OK |
| Frontend `npm run build` | OK |
| Migration em banco vazio e em banco com dados (Fase 3/4) | OK; drift só o índice antigo `dimob_records_declarant_year_idx` (já existente) |
| Correção das vendas antigas (simulada: aberta / paga / com boleto) | só a aberta sem boleto foi cancelada ✔ |
| Ponta a ponta Fase 5 (API real + Asaas simulado) | **79/79** |
| Regressão ponta a ponta Fases 2, 3 e 4 | 36/36, 28/28, 33/33 |
| Teste de tela (navegador, login real) | **24/24** |

## 5. Roteiro de teste manual (homologação)

Use uma imobiliária de teste e o **Sandbox** do Asaas.

1. **Configurações financeiras:** Financeiro → Configurações. Confira o plano de categorias; crie a categoria
   "Cartório" (despesa) e o centro de custo "Administrativo". Ajuste multa/juros se quiser.
2. **Conta a pagar com baixa parcial:** Novo Lançamento → conta a pagar, categoria "Cartório", centro
   "Administrativo", R$ 1.000, vencimento 5 dias atrás. Clique **Pagar**: veja a multa e os juros sugeridos.
   Baixe **R$ 400** (apague multa e juros) → a linha mostra **Parcial** e **R$ 600** em aberto.
3. Clique no nome da conta → **Detalhes** → **Estornar** a baixa (informe o motivo) → volta a R$ 1.000 em aberto.
   Baixe o total com comprovante (PDF) → **Quitada**; em Detalhes, abra o comprovante.
4. **Cancelar com motivo:** crie outra conta qualquer e cancele em Detalhes → aparece em "Canceladas" com o motivo.
5. **Recorrência:** Configurações → Recorrências → "Internet", despesa, R$ 129,90, dia 10, início no começo do
   mês passado → aparecem os lançamentos do mês passado, deste e do próximo (nada duplicado ao recarregar).
6. **Asaas:** siga a seção 3 ("Configurar o Asaas") no Sandbox.
7. **Cobrar com PIX:** crie uma conta a receber para um cliente **com CPF e e-mail** → **Cobrar** → PIX →
   aparece o QR Code e o copia-e-cola. Teste **E-mail** e **WhatsApp**: se não estiverem configurados, deve
   aparecer o erro específico.
8. **Baixa automática:** no painel do Sandbox do Asaas, marque a cobrança como paga → em instantes a conta fica
   **Quitada** e a baixa aparece como "Asaas (automático)".
9. **Reemitir e cancelar:** em outra conta, emita boleto → **Reemitir** com nova data (o antigo some no Asaas) →
   **Cancelar** com motivo (cancelado também no Asaas). Tente dar baixa manual com boleto ativo → deve recusar.
10. **Bancário:** cadastre a conta com saldo inicial. Importe um extrato CSV do seu banco (ou OFX) → clique
    **Conciliar** num pagamento → escolha a conta a pagar → ela fica Quitada. Veja o **Razão bancário**.
11. **Fluxo de caixa:** mensal e diário, por conta; **Exportar Excel** e abra no Excel.
12. **DRE:** confira receitas/despesas do mês; **Exportar Excel**.
13. **Vendas antigas:** Configurações → Vendas antigas → para cada venda listada, **Lançar comissão** e confira
    em A Receber.
14. **Perfil venda:** confirme que locação, vistorias, manutenção, Open Finance, automações e agentes de IA
    continuam escondidos do menu.

## 6. Script de validação

Dê dois cliques em **`validar-fase-5.bat`** (na pasta do projeto, com Git e Docker Desktop abertos). Ele baixa
esta fase e roda, dentro do Docker (node:20-alpine), build + tipos + testes do backend e tipos do frontend.
Não mexe no sistema que está no ar.
