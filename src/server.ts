import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { fetchPairsAndReserves } from "./fetcher.js";
import { calculateArbitrage } from "./arbitrage.js";
import { DEXES, PAIRS } from "../src/config/dexes.js";
import type { ArbitrageOpportunity, ReserveWithFee } from "./types/index.js";
const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

async function runFetcherJob() {
  const allReserves: ReserveWithFee[] = [];
  for (const dex of DEXES) {
    const chainId = dex.chainId;
    const pairs = PAIRS[chainId];
    if (!pairs || pairs.length === 0) {
      console.warn(`No pairs configured for chain ${chainId} (${dex.name})`);
      continue;
    }
    try {
      const reserves = await fetchPairsAndReserves(
        dex.chainId,
        dex.name,
        dex.factory,
        pairs
      );
      if (!reserves || reserves.length === 0) {
        console.warn(
          `No reserves found for ${dex.name} on chain ${dex.chainId}`
        );
        continue;
      }

      // Attach dex info so arbitrage function knows where it's from
      reserves.forEach((r) =>
        allReserves.push({
          ...r,

          fee: dex.fee,
        })
      );
      // Calculate arbitrage opportunities
      const results: ArbitrageOpportunity[] = calculateArbitrage(allReserves);
      if (results.length > 0) {
        const timestamp = Math.floor(Date.now() / 1000);
        await prisma.results.createMany({
          data: results.map((result) => ({
            ...result,
            timestamp: result.blockTimestamp ?? timestamp,
            token0: result.token0 ?? "",
            token1: result.token1 ?? "",
            reserve0: result.reserve0 ?? "",
            reserve1: result.reserve1 ?? "",
            pairAddress: result.pairAddress ?? "",
            // Add similar nullish coalescing for other fields if needed
          })),
        });
        console.log(
          `Fetched and stored reserves for ${dex.name} on ${dex.chainId}`
        );
      }
    } catch (error) {
      console.error(
        `Error fetching reserves for ${dex.name} on ${dex.chainId}:`,
        error
      );
    }
  }
}

setInterval(runFetcherJob, 30_000); // every 30 seconds

app.get("/opportunities", async (_, res) => {
  const ops = await prisma.results.findMany({
    orderBy: { timestamp: "desc" },
    take: 20,
  });
  res.json(ops);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
