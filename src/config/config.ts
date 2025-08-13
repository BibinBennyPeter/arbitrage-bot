import type { Tokens, Dexes, Pairs } from './types.js';

const tokens: Tokens = {
  WETH: {
    ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
     polygon: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
     bsc:     "0x2170Ed0880ac9A755fd29B2688956BD959F933F8"
  },
  DAI: {
    ethereum: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
     polygon: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
     bsc:     "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3"
  },
  USDC: {
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
     polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
     bsc:     "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
  },
  USDT: {
    ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
     polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
     bsc:     "0x55d398326f99059fF775485246999027B3197955"
  },
  WBTC: {
    ethereum: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
     polygon: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
     bsc:     "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c"
  }
};


const dexes: Dexes = {
  "UniswapV2": {
    "ethereum": {
      factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
      fee: 0.003
    },
    "polygon": {
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      fee: 0.003
    },
    "bsc": {
      factory: "0xBCfCcbde45cE874adCB698cC183deBcF17952812",
      fee: 0.0025
    },
  },
  SushiSwap: {
    "ethereum": {
      factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
      fee: 0.003
    },
    "polygon": {
      factory: "0xC35DADB65012eC5796536bD9864eD8773aBc74C4",
      fee: 0.003
    },
    "bsc": {
      factory:  "0xC0f9F5b2c6d8e3A1B4a7E6bD2cF3d8e4f5B6a7C8",
      fee: 0.0025
    }
  }
};

const pairs: Pairs = [
  { token0: "WETH", token1: "DAI",  dexes: ["UniswapV2", "SushiSwap"] },
  { token0: "WETH", token1: "USDC", dexes: ["UniswapV2", "SushiSwap"] },
  { token0: "DAI",  token1: "USDC", dexes: ["UniswapV2", "SushiSwap"] },
  { token0: "USDC", token1: "USDT", dexes: ["UniswapV2", "SushiSwap"] },
  { token0: "WETH", token1: "WBTC", dexes: ["UniswapV2", "SushiSwap"] }
];

export { tokens, dexes, pairs };

