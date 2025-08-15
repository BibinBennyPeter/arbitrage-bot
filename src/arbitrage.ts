import type { ArbitrageOpportunity, ReserveWithFee } from "./types/index.js";
function getAmountOut(amountIn: number, reserveIn: number, reserveOut: number, fee: number) {
  const amountInWithFee = amountIn * (1 - fee);
  return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
}

export function calculateArbitrage(reserves: ReserveWithFee[]): ArbitrageOpportunity[] {
  const opportunities :ArbitrageOpportunity[] = [];
  const tradeSize = 1; // start with 1 token0

  for (let i = 0; i < reserves.length; i++) {
    for (let j = 0; j < reserves.length; j++) {
      if (i === j) continue;

      const dexA = reserves[i];
      const dexB = reserves[j];     

      if (dexA === undefined || dexB === undefined) continue;

      if (dexA.token0 !== dexB.token0 || dexA.token1 !== dexB.token1 || dexA.token0 !== null || dexA.token1 !== null) continue;

      const r0A = Number(dexA.reserve0) / (10 ** (dexA.decimals0 || 18));
      const r1A = Number(dexA.reserve1) / (10 ** (dexA.decimals1 || 18));

      const r0B = Number(dexB.reserve0) / (10 ** (dexB.decimals0 || 18));
      const r1B = Number(dexB.reserve1) / (10 ** (dexB.decimals1 || 18));

      // 1) Swap on A, then swap back on B
      const token1Out = getAmountOut(tradeSize, r0A, r1A, dexA.fee);
      const token0Back = getAmountOut(token1Out, r1B, r0B, dexB.fee);

      if (token0Back > tradeSize) {
        opportunities.push({
          ...dexA,
          buyFrom: dexA.dex,
          sellTo: dexB.dex,
          priceBuy: token1Out,
          priceSell: token0Back,
          profit: token0Back - tradeSize,
          token0: dexA.token0,
          token1: dexA.token1
        });
      }

      // 2) Swap on B, then swap back on A
      const token1OutB = getAmountOut(tradeSize, r0B, r1B, dexB.fee);
      const token0BackA = getAmountOut(token1OutB, r1A, r0A, dexA.fee);

      if (token0BackA > tradeSize) {
        opportunities.push({
          ...dexB,
          buyFrom: dexB.dex,
          sellTo: dexA.dex,
          priceBuy: token1OutB,
          priceSell: token0BackA,
          profit: token0BackA - tradeSize,
          token0: dexA.token0,
          token1: dexA.token1
        });
      }
    }
  }

  return opportunities;
}
