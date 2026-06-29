-- Recebimento de comissões: valor recebido e forma de pagamento
ALTER TABLE "commissions" ADD COLUMN "receivedValue" DECIMAL(15,2);
ALTER TABLE "commissions" ADD COLUMN "paymentMethod" TEXT;
