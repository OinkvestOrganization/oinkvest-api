-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "tradeId" BIGINT NOT NULL,
    "orderId" BIGINT NOT NULL,
    "orderListId" BIGINT NOT NULL DEFAULT -1,
    "price" DECIMAL(65,30) NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "quoteQuantity" DECIMAL(65,30) NOT NULL,
    "commission" DECIMAL(65,30) NOT NULL,
    "commissionAsset" TEXT NOT NULL,
    "isBuyer" BOOLEAN NOT NULL,
    "isMaker" BOOLEAN NOT NULL,
    "isBestMatch" BOOLEAN NOT NULL DEFAULT true,
    "executedTime" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "Trade_executedTime_idx" ON "Trade"("executedTime");

-- CreateIndex
CREATE INDEX "Trade_userId_symbol_idx" ON "Trade"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_userId_symbol_tradeId_key" ON "Trade"("userId", "symbol", "tradeId");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
