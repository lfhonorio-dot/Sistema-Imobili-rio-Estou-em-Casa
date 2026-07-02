# Módulo Split de Pagamento + Registro DIMOB

Implementa a divisão de comissão entre a imobiliária e corretores parceiros e o
registro de eventos para a DIMOB, com rateio proporcional por declarante.

## Split de pagamento

- **Regras/percentuais** ficam em `SplitRule` (por contrato) e os beneficiários em
  `SplitRecipient` (dados bancários/PIX + KYC). Ver módulo `erp/split`.
- No recebimento da comissão (`financial.receiveCommission`) são geradas as
  `SplitTransaction` (uma por parceiro), com valor = % da comissão recebida.
- **Provedor plugável:** `PaymentSplitProvider` (`erp/split/payment-split.provider.ts`)
  abstrai a instituição de pagamento (Bacen-regulada). O `ManualSplitProvider`
  é o padrão (registro interno, sem mover dinheiro). Toda instrução carrega
  `idempotencyKey` por operação para evitar duplicidade em reenvio.
  Para plugar um provedor real (EFÍ/ASAAS/Iugu), implemente a interface e injete
  no lugar do `ManualSplitProvider`.

## Registro DIMOB (`DimobService`)

Regras (IN RFB 1.115/2010 + COSIT 237/2019), na função pura `computeDimobDeclarants`:

- **Venda:** evento registrado na **data de contratação** (assinatura/início),
  não na data de recebimento — `registerSaleEvents` roda ao criar o contrato.
- **Locação:** eventos **mensais** por pagamento de aluguel — `registerRentalMonthEvent`.
- **Parceiro PJ (CNPJ):** tem seu **próprio registro** DIMOB, proporcional à participação.
- **Parceiro PF autônomo (CPF, sem CNPJ):** **não é declarante**; sua parcela é
  atribuída ao registro da imobiliária.
- Idempotência: os registros do contrato (ou contrato+mês) são recriados a cada
  chamada, sem duplicar.

## Endpoints

- `POST /fiscal/dimob/contracts/:contractId/register` — (re)registra eventos do contrato.
- `GET  /fiscal/dimob/export?year=2026[&declarantDoc=CNPJ]` — agrega por declarante e
  ano-calendário, retornando JSON estruturado **e** CSV por campo (pronto para
  preenchimento do PGD DIMOB; a geração do binário do Receitanet fica fora de escopo).

## Testes

`dimob.calc.spec.ts` cobre: sem parceiros, PJ próprio registro, PF autônomo somado
à imobiliária, e mix PJ+PF.
