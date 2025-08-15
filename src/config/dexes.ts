import type { Record } from "@prisma/client/runtime/library";
import type { DexConfig, TokenPair } from "../types/index.js";

export const DEXES: DexConfig[] = [
  // --- Polygon ---
  {
    name: "QuickSwap",
    factory: "0x5757371414417b8c6caad45baef941abc7d3ab32",
    fee: 0.003,
    chainId: 137
  },
  {
    name: "SushiSwap (Polygon)",
    factory: "0xc35dadb65012ec5796536bd9864ed8773abc74c4",
    fee: 0.003,
    chainId: 137
  },

  // --- Ethereum Mainnet ---
  {
    name: "UniswapV2",
    factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    fee: 0.003,
    chainId: 1
  },
  {
    name: "SushiSwap (Ethereum)",
    factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
    fee: 0.003,
    chainId: 1
  }
];

export const PAIRS:Record <number, TokenPair[]> = {
  1: [
    {
      token0: {
        symbol: "WETH",
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        decimals: 18,
      },
      token1: {
        symbol: "USDC",
        address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
      },
    },
    {
      token0: {
        symbol: "DAI",
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        decimals: 18,
      },
      token1: {
        symbol: "USDC",
        address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
      },
    },
  ],

  137: [
    {
      token0: {
        symbol: "WMATIC",
        address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        decimals: 18,
      },
      token1: {
        symbol: "USDC",
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        decimals: 6,
      },
    },
    {
      token0: {
        symbol: "DAI",
        address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
        decimals: 18,
      },
      token1: {
        symbol: "USDC",
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        decimals: 6,
      },
    },
  ],
};
