-- CreateTable
CREATE TABLE "Opportunity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pair" TEXT NOT NULL,
    "token0" TEXT NOT NULL,
    "token1" TEXT NOT NULL,
    "dexBuy" TEXT NOT NULL,
    "dexSell" TEXT NOT NULL,
    "priceBuy" REAL NOT NULL,
    "priceSell" REAL NOT NULL,
    "amountIn" REAL NOT NULL,
    "grossProfit" REAL NOT NULL,
    "netProfit" REAL NOT NULL,
    "gasCost" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservesSnapshot" JSONB NOT NULL,
    "simulationDetails" JSONB NOT NULL,
    "safetyMarginPct" REAL NOT NULL
);
