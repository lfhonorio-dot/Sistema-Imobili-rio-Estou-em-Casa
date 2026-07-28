-- Garantia locatícia (art. 37 da Lei 8.245/91)
-- FIADOR, CAUCAO, SEGURO_FIANCA, TITULO_CAPITALIZACAO, NONE
ALTER TABLE "contracts" ADD COLUMN "guaranteeType" TEXT;
-- Valor da caução/título (quando aplicável)
ALTER TABLE "contracts" ADD COLUMN "guaranteeValue" DECIMAL(15,2);
-- Seguradora/apólice ou observações da garantia
ALTER TABLE "contracts" ADD COLUMN "guaranteeDetails" TEXT;
