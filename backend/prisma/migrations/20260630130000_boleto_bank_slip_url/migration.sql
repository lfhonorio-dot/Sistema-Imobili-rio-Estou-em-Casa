-- URL do PDF do boleto emitido no gateway (ex.: bankSlipUrl do Asaas)
ALTER TABLE "boletos" ADD COLUMN "bankSlipUrl" TEXT;
