type Token = {
  [chain: string]: string; // Chain name to token address mapping
};

type Dex = {
  [chain: string]: {
    factory: string; // Factory contract address
    fee: number; // Trading fee as a decimal (e.g., 0.003 for 0.3%)
  };
};

type Pair = {
  token0: string; // Token0 symbol
  token1: string; // Token1 symbol
  dexes: string[]; // List of DEX names to check for arbitrage
};

type Tokens = {
  [symbol: string]: Token; // Mapping of token symbols to their addresses by chain
};

type Dexes = {
  [name: string]: Dex; // Mapping of DEX names to their chain-specific details
};

type Pairs = Pair[]; // Array of pairs to check for arbitrage opportunities

export type { Tokens, Dexes, Pairs };


