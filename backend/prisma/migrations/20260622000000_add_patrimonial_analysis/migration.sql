CREATE TABLE "PatrimonialAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSnapshot" JSONB NOT NULL,
    "agentResponse" JSONB NOT NULL,
    "modelUsed" TEXT NOT NULL DEFAULT 'claude-opus-4-6',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PatrimonialAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisConversation" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalysisConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatrimonialAnalysis_userId_generatedAt_idx" ON "PatrimonialAnalysis"("userId", "generatedAt");
CREATE INDEX "AnalysisConversation_analysisId_idx" ON "AnalysisConversation"("analysisId");

ALTER TABLE "AnalysisConversation" ADD CONSTRAINT "AnalysisConversation_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "PatrimonialAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
