import { ethers } from 'ethers';
import type { InterfaceAbi } from 'ethers';
import factoryAbi from './abi/IUniswapV2Factory.json' with { type: 'json' };
import pairAbi from './abi/IUniswapV2Pair.json' with { type: 'json' };


type FactoryAbi = {
  getPair(tokenA: string, tokenB: string): Promise<string>;
};

type PairAbi = {
  getReserves(): Promise<[bigint, bigint]>;
  token0(): Promise<string>;
  token1(): Promise<string>;
};

export async function fetchReserves(
  provider: ethers.JsonRpcProvider,
  factoryAddress: string,
  tokenA: string,
  tokenB: string
) {
  const factory = new ethers.Contract(factoryAddress, factoryAbi as InterfaceAbi, provider) as unknown as FactoryAbi;

  const pairAddress = await factory.getPair(tokenA, tokenB);
  if (pairAddress === ethers.ZeroAddress) {
    throw new Error(`No pair found for ${tokenA} / ${tokenB}`);
  }

  const pair = new ethers.Contract(pairAddress, pairAbi as InterfaceAbi, provider) as unknown as PairAbi;
  const [reserve0, reserve1] = await pair.getReserves();
  const token0 = await pair.token0();
  const token1 = await pair.token1();

  return { pairAddress, reserve0, reserve1, token0, token1 };
}

