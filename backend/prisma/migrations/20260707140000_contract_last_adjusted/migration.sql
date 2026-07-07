-- Data do último reajuste de aluguel (idempotência anual do job de reajuste)
ALTER TABLE "contracts" ADD COLUMN "lastAdjustedAt" TIMESTAMP(3);
