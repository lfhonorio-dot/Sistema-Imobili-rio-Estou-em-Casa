CREATE TABLE "AdvisorKnowledgeBase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorKnowledgeBase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdvisorKnowledgeBase_userId_idx" ON "AdvisorKnowledgeBase"("userId");
