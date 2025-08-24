import type { Contract } from "ethers";

export interface DexConfig {
  name: string;
  factory: string;
  fee: number;
  chainId: number;
}

export type Token = {
    symbol?: string;
    address: string;
    decimals?: number;
};

type Dex = {
  [chain: string]: {
    factory: string; // Factory contract address
    fee: number; // Trading fee as a decimal (e.g., 0.003 for 0.3%)
  };
};

type Pair = {
  pairKey?: string; // Unique identifier for the pair (optional)
  token0: string; // Token0 symbol
  token1: string; // Token1 symbol
};
export type TokenPair = {
  pairKey?: string; // Unique identifier for the pair (optional)
  token0: Token;
  token1: Token;
};
type Tokens = {
  [symbol: string]: Token; // Mapping of token symbols to their addresses by chain
};

type Dexes = {
  [name: string]: Dex; // Mapping of DEX names to their chain-specific details
};

type Pairs = TokenPair[]; // Array of pairs to check for arbitrage opportunities

export type { Tokens, Dexes, Pairs };


export interface Reserve {
  chain: number;
  dex: string;
  pairKey: string;
  pairAddress: string | null;
  token0: string | null;
  token1: string | null;
  reserve0: string | null;
  reserve1: string | null;
  decimals0: number | null;
  decimals1: number | null;
  blockNumber: number | null;
  blockTimestamp: number | null;
  pairTimestampLast?: number;
}
export type ReserveWithFee = Reserve & {
  fee: number;
};

export type ArbitrageOpportunity = ReserveWithFee & {
  buyFrom: string; // DEX where the buy occurs
  sellTo: string; // DEX where the sell occurs
  priceBuy: number; // Price at which token1 is bought
  priceSell: number; // Price at which token0 is sold
  profit: number; // Profit from the arbitrage opportunity
  profitPercent: number; // Profit percentage
};


type TryAggregate = (
  requireSuccess: boolean,
  calls: { target: string; callData: string }[]
) => Promise<[boolean, string][]>;

export type Multicall2Contract = Contract & {
  tryAggregate: TryAggregate & {
    staticCall: TryAggregate;
  }
};
