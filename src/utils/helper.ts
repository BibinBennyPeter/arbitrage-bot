// ---- Tiny caches (per-process) ----
export const decimalsCache = new Map<string, number>(); // key: `${chainId}:${token}`
export const pairAddrCache = new Map<string, string | null>(); // key: `${factory}:${tokenA}:${tokenB}` lowercased

// Normalize a cache key (addresses are case-insensitive; lowercasing avoids duplicates)
export function keyFactory(factory: string, tokenA: string, tokenB: string) {
  return `${factory.toLowerCase()}:${tokenA.toLowerCase()}:${tokenB.toLowerCase()}`;
}
