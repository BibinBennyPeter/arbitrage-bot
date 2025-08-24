import { getAddress } from "ethers";

// ---- Tiny caches (per-process) ----
export const decimalsCache = new Map<string, number>(); // key: `${chainId}:${token}`
export const pairAddrCache = new Map<string, string | null>(); // key: `${factory}:${tokenA}:${tokenB}` lowercased

// Normalize a cache key (addresses are case-insensitive; lowercasing avoids duplicates)
export function keyFactory(factory: string, tokenA: string, tokenB: string) {
  return `${factory.toLowerCase()}:${tokenA.toLowerCase()}:${tokenB.toLowerCase()}`;
}

export function sortTokens(tokenA: string, tokenB: string): [string, string] {
  return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}

// helper: normalize & validate an address string; returns checksummed address or null
export function safeAddr(maybeAddr: unknown): string | null {
    if (typeof maybeAddr !== "string") return null;
    try {
      // getAddress accepts lower/upper and computes checksum; throws on invalid hex/length
      return getAddress(maybeAddr);
    } catch (err) {
      try{
        if (maybeAddr.length===42){
          return getAddress(maybeAddr.toLowerCase());
        }
      }
        catch{}
      console.warn(`safeAddr Error : `, err);
      return null;
    }
  }


