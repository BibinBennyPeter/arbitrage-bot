import { pairs, tokens, dexes } from "./config/config.js";
import { fetchReserves } from "./fetcher.js";
import { getAmountOutRaw, simulateRoundTripRaw } from "./simulator.js";
import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";

const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const GAS_COST = 0.0005; // ETH estimate
const SAFETY_MARGIN = 0.05; // 5%
const amountIn = ethers.parseUnits("1", 18n); // 1 token0

const chains = ["ethereum", "polygon", "bsc"];

export async function runDetectionLoop() {
  for (const pair of pairs) {
    const token0 = tokens[pair.token0];
    const token1 = tokens[pair.token1];
    if (!token0 || !token1) continue; // Skip if token config missing
    for (const chain of chains) {
      const token0Addr = token0[chain];
      const token1Addr = token1[chain];
      if (!token0Addr || !token1Addr) continue; // Skip if address missing
      const dexData = [];
      let maxOut = 0;
      for (const dexName of pair.dexes) {
          if (!dexes[dexName]![chain]) continue; // Skip if dex config missing for this chain
            const dex = dexes[dexName]![chain]!;
            if (!dex) continue; // Skip if dex config missing

            const reserves = await fetchReserves( provider, dex.factory, token0Addr, token1Addr);
            if ( !reserves || !reserves.token0 || reserves.reserve0 === undefined || reserves.reserve1 === undefined) continue; // Skip if reserves missing

            const reserveIn = reserves.token0.toLowerCase() === token0Addr.toLowerCase() ? BigInt(reserves.reserve0) : BigInt(reserves.reserve1);
            const reserveOut = reserves.token0.toLowerCase() === token0Addr.toLowerCase() ? BigInt(reserves.reserve1) : BigInt(reserves.reserve0);

            let effectiveOut = getAmountOutRaw(amountIn, reserveIn, reserveOut, BigInt(Math.floor((1 - dex.fee) * 1000)), 1000n);
            
          if (effectiveOut > maxOut) {
            maxOut = effectiveOut;
            

            dexData.push({ name: dexName, reserveIn, reserveOut, fee: dex.fee });
          }
    }
  }

    if (dexData.length < 2) continue; // Need at least two DEXes to compare

    const finalOut = simulateRoundTripRaw(
      amountIn,
      dexData[0]!,
      dexData[1]!,
    );
    const profit = finalOut - amountIn;
    const gasCost = ethers.parseUnits(GAS_COST.toString(), 18n);
    const safetyMargin = amountIn * BigInt(Math.floor(SAFETY_MARGIN * 100)) / 100n; // 5% of amountIn
    const netProfit = profit - gasCost - safetyMargin;

    const dexBuy = dexData[0];
    const dexSell = dexData[1];

    const dexDataJson = dexData.map(d => ({
      ...d,
      reserveIn: d.reserveIn.toString(),
      reserveOut: d.reserveOut.toString(),
    }));

    if (dexBuy && dexSell && netProfit > 0) {
      await prisma.opportunity.create({
        data: {
          pair: `${pair.token0}/${pair.token1}`,
          token0: token0Addr,
          token1: token1Addr,
          dexBuy: dexBuy.name,
          dexSell: dexSell.name,
          priceBuy: Number(ethers.formatUnits(dexBuy.reserveOut * 1_000_000n /dexBuy.reserveIn, 6)),
          priceSell: Number(ethers.formatUnits(dexSell.reserveOut * 1_000_000n / dexSell.reserveIn, 6)),
          amountIn: Number(ethers.formatUnits(amountIn, 18)),
          grossProfit: Number(ethers.formatUnits(profit, 18)),
          netProfit: Number(ethers.formatUnits(netProfit,18)),
          gasCost: GAS_COST,
          reservesSnapshot: dexDataJson,
          simulationDetails: { amountIn: Number(amountIn), finalOut: Number(finalOut) },
          safetyMarginPct: SAFETY_MARGIN,
        },
      });
    }
  }
}
