import { Contract, JsonRpcProvider } from "ethers";
import MulticallAbi from "../abi/MultiCall2.json" with { type: "json" };
import { MULTICALL_ADDRESS_BY_CHAIN } from "../config/config.js";

// Ethereum (1) and Polygon (137).
const RPC_BY_CHAIN: Record<number, string> = {
  1: process.env.RPC_ETHEREUM || process.env.RPC_URL || "",
  137: process.env.RPC_POLYGON || "",
};

// Map chainId -> Multicall address.
const MULTICALL_BY_CHAIN_ID: Record<number, string> = {
  1: MULTICALL_ADDRESS_BY_CHAIN.ethereum!,
  137: MULTICALL_ADDRESS_BY_CHAIN.polygon!,
};

export function getMulticall(
  chainId: number,
  provider: JsonRpcProvider
): Contract {
  const address = MULTICALL_ADDRESS_BY_CHAIN[chainId];
  if (!address) {
    throw new Error(
      `No Multicall address configured for chainId=${chainId}. Set MULTICALL_ETHEREUM / MULTICALL_POLYGON in .env`
    );
  }
  return new Contract(address, MulticallAbi, provider);
}

// Basic guard to make sure config exists at runtime.
export function getProvider(chainId: number): JsonRpcProvider {
  const url = RPC_BY_CHAIN[chainId];
  if (!url) throw new Error(`No RPC URL configured for chainId=${chainId}. Set RPC_ETHEREUM / RPC_POLYGON in .env`);
  return new JsonRpcProvider(url);
}

export function getMulticallAddress(chainId: number): string {
  const addr = MULTICALL_BY_CHAIN_ID[chainId];
  if (!addr) throw new Error(`No Multicall address configured for chainId=${chainId}. Set MULTICALL_ETHEREUM / MULTICALL_POLYGON in .env`);
  return addr;
}
