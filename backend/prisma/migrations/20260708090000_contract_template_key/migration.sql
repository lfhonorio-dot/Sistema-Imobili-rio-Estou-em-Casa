-- Modelo de contrato escolhido para geração do documento
-- (RENTAL_WAREHOUSE = barracão/não residencial; RENTAL_COMMERCIAL_ROOM = sala comercial com fiadores)
ALTER TABLE "contracts" ADD COLUMN "templateKey" TEXT;
