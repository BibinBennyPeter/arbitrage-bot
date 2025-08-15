-- CreateTable
CREATE TABLE "Results" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dex" TEXT NOT NULL,
    "chain" INTEGER NOT NULL,
    "pairKey" TEXT NOT NULL,
    "token0" TEXT NOT NULL,
    "token1" TEXT NOT NULL,
    "priceBuy" REAL NOT NULL,
    "priceSell" REAL NOT NULL,
    "profit" REAL NOT NULL,
    "reserve0" TEXT NOT NULL,
    "reserve1" TEXT NOT NULL,
    "fee" REAL NOT NULL,
    "timestamp" INTEGER NOT NULL
);
