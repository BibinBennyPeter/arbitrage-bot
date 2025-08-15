import assert from "assert";

export const RPC_URL = process.env.RPC_URL ?? "";
export const PAIR_CHUNK_SIZE = Number(process.env.PAIR_CHUNK_SIZE ?? 30);

export const MULTICALL_ADDRESS_BY_CHAIN: Record<string, string> = {
  ethereum: process.env.MULTICALL_ETHEREUM ?? "",
  polygon: process.env.MULTICALL_POLYGON ?? "",
  bsc: process.env.MULTICALL_BSC ?? "",
};

//basic validation at startup
function validate() {
  assert(RPC_URL, "RPC_URL is required in .env");

  const configuredChains = Object.entries(MULTICALL_ADDRESS_BY_CHAIN).filter(([, v]) => !!v).map(([k]) => k);
  if (configuredChains.length === 0) {
    console.warn("Warning: no MULTICALL_* addresses configured. Add MULTICALL_ETHEREUM or MULTICALL_POLYGON in .env");
  }
}

validate();

export default {
  RPC_URL,
  PAIR_CHUNK_SIZE,
  MULTICALL_ADDRESS_BY_CHAIN,
};

