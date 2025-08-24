import type { ArbitrageOpportunity, ReserveWithFee } from "./types/index.js";

function getAmountOut(amountIn: number, reserveIn: number, reserveOut: number, fee: number) {
  const amountInWithFee = amountIn * (1 - fee);
  return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
}

// Helper to normalize token pair (always put lower address first)
function normalizePair(token0: string, token1: string): [string, string] {
  return token0.toLowerCase() < token1.toLowerCase() 
    ? [token0.toLowerCase(), token1.toLowerCase()] 
    : [token1.toLowerCase(), token0.toLowerCase()];
}

// Helper to check if two reserves represent the same trading pair
function isSamePair(dexA: ReserveWithFee, dexB: ReserveWithFee): boolean {
  const [a0, a1] = normalizePair(dexA.token0 || '', dexA.token1 || '');
  const [b0, b1] = normalizePair(dexB.token0 || '', dexB.token1 || '');
  return a0 === b0 && a1 === b1;
}

// Helper to get reserves in normalized order (token0 < token1)
function getNormalizedReserves(reserve: ReserveWithFee) {
  const token0Lower = (reserve.token0 || '').toLowerCase();
  const token1Lower = (reserve.token1 || '').toLowerCase();
  
  if (token0Lower < token1Lower) {
    return {
      tokenA: reserve.token0,
      tokenB: reserve.token1,
      reserveA: Number(reserve.reserve0) / (10 ** (reserve.decimals0 || 18)),
      reserveB: Number(reserve.reserve1) / (10 ** (reserve.decimals1 || 18)),
    };
  } else {
    return {
      tokenA: reserve.token1,
      tokenB: reserve.token0,
      reserveA: Number(reserve.reserve1) / (10 ** (reserve.decimals1 || 18)),
      reserveB: Number(reserve.reserve0) / (10 ** (reserve.decimals0 || 18)),
    };
  }
}

export function calculateArbitrage(reserves: ReserveWithFee[]): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const tradeSize = 1000; // Use larger trade size to see meaningful differences
  
  console.log(`\n=== ARBITRAGE ANALYSIS ===`);
  console.log(`Analyzing ${reserves.length} reserves with trade size: ${tradeSize}`);

  for (let i = 0; i < reserves.length; i++) {
    for (let j = i + 1; j < reserves.length; j++) { // j = i + 1 to avoid duplicate comparisons
      const dexA = reserves[i];
      const dexB = reserves[j];

      if (!dexA || !dexB || !dexA.token0 || !dexA.token1 || !dexB.token0 || !dexB.token1) {
        continue;
      }

      // Check if it's the same trading pair
      if (!isSamePair(dexA, dexB)) {
        continue;
      }

      console.log(`\n--- Analyzing same pair on different DEXes ---`);
      console.log(`DEX A (${dexA.dex}): ${dexA.token0}/${dexA.token1}`);
      console.log(`DEX B (${dexB.dex}): ${dexB.token0}/${dexB.token1}`);

      // Get normalized reserves for consistent comparison
      const normA = getNormalizedReserves(dexA);
      const normB = getNormalizedReserves(dexB);

      console.log(`Normalized reserves A: ${normA.reserveA.toFixed(2)} ${normA.tokenA} / ${normA.reserveB.toFixed(2)} ${normB.tokenB}`);
      console.log(`Normalized reserves B: ${normB.reserveA.toFixed(2)} ${normB.tokenA} / ${normB.reserveB.toFixed(2)} ${normB.tokenB}`);

      // Calculate prices (how much tokenB per tokenA)
      const priceA = normA.reserveB / normA.reserveA; // tokenB per tokenA on DEX A
      const priceB = normB.reserveB / normB.reserveA; // tokenB per tokenB on DEX B
      
      console.log(`Price on DEX A: 1 ${normA.tokenA} = ${priceA.toFixed(6)} ${normA.tokenB}`);
      console.log(`Price on DEX B: 1 ${normB.tokenA} = ${priceB.toFixed(6)} ${normB.tokenB}`);
      
      const priceDiff = Math.abs(priceA - priceB) / Math.min(priceA, priceB);
      console.log(`Price difference: ${(priceDiff * 100).toFixed(4)}%`);

      // Arbitrage opportunity 1: Buy tokenA on cheaper DEX, sell on expensive DEX
      if (priceA < priceB) {
        // Buy tokenA on DEX A (cheaper), sell tokenA on DEX B (expensive)
        const tokenBOut = getAmountOut(tradeSize, normA.reserveA, normA.reserveB, dexA.fee);
        const tokenABack = getAmountOut(tokenBOut, normB.reserveB, normB.reserveA, dexB.fee);
        
        console.log(`Arbitrage 1: Buy on ${dexA.dex}, sell on ${dexB.dex}`);
        console.log(`${tradeSize} ${normA.tokenA} → ${tokenBOut.toFixed(6)} ${normA.tokenB} → ${tokenABack.toFixed(6)} ${normA.tokenA}`);
        
        const profit = tokenABack - tradeSize;
        const profitPercent = (profit / tradeSize) * 100;
        
        console.log(`Profit: ${profit.toFixed(6)} ${normA.tokenA} (${profitPercent.toFixed(4)}%)`);

        if (profit > 0) {
          opportunities.push({
            ...dexA,
            buyFrom: dexA.dex,
            sellTo: dexB.dex,
            priceBuy: priceA,
            priceSell: priceB,
            profit: profit,
            token0: normA.tokenA,
            token1: normA.tokenB,
            profitPercent: profitPercent,
          });
        }
      }

      // Arbitrage opportunity 2: Buy tokenA on DEX B, sell on DEX A
      if (priceB < priceA) {
        const tokenBOut = getAmountOut(tradeSize, normB.reserveA, normB.reserveB, dexB.fee);
        const tokenABack = getAmountOut(tokenBOut, normA.reserveB, normA.reserveA, dexA.fee);
        
        console.log(`Arbitrage 2: Buy on ${dexB.dex}, sell on ${dexA.dex}`);
        console.log(`${tradeSize} ${normB.tokenA} → ${tokenBOut.toFixed(6)} ${normB.tokenB} → ${tokenABack.toFixed(6)} ${normB.tokenA}`);
        
        const profit = tokenABack - tradeSize;
        const profitPercent = (profit / tradeSize) * 100;
        
        console.log(`Profit: ${profit.toFixed(6)} ${normB.tokenA} (${profitPercent.toFixed(4)}%)`);

        if (profit > 0) {
          opportunities.push({
            ...dexB,
            buyFrom: dexB.dex,
            sellTo: dexA.dex,
            priceBuy: priceB,
            priceSell: priceA,
            profit: profit,
            token0: normB.tokenA,
            token1: normB.tokenB,
            profitPercent: profitPercent,
          });
        }
      }
    }
  }

  console.log(`Found ${opportunities.length} arbitrage opportunities`);
  
  if (opportunities.length > 0) {
    opportunities.forEach((opp, idx) => {
      console.log(`${idx + 1}. Buy ${opp.token0}/${opp.token1} on ${opp.buyFrom}, sell on ${opp.sellTo}`);
      console.log(`   Profit: ${opp.profit?.toFixed(6)} (${opp.profitPercent?.toFixed(4)}%)`);
    });
  } else {
    console.log("No profitable arbitrage opportunities found.");
  }

  return opportunities;
}
