import { Contract, getAddress, Interface, JsonRpcProvider } from "ethers";

import FactoryAbi from "./abi/IUniswapV2Factory.json" with { type: "json" };
import PairAbi from "./abi/IUniswapV2Pair.json" with { type: "json" };
import ERC20Abi from "./abi/IERC20.json" with { type: "json" };

import type { TokenPair, Reserve, Multicall2Contract } from "./types/index.js";
import { getMulticall, getProvider } from "./utils/multicall.js";
import { keyFactory, pairAddrCache, decimalsCache } from "./utils/helper.js";



export async function fetchPairsAndReserves(
  chainId: number,
  dexName: string,
  factoryAddress: string,
  pairs: TokenPair[]
): Promise<Reserve[]> {
  // Create provider and multicall for the chain.
  const provider = getProvider(chainId);
  const multicall = getMulticall(chainId, provider) as Multicall2Contract;

  // Prepare ABI interfaces.
  const factoryIface = new Interface(FactoryAbi as any);
  const pairIface = new Interface(PairAbi as any);
  const erc20Iface = new Interface(ERC20Abi as any);

  //  Resolve pair addresses via Multicall (returns array aligned with `pairs`).
  const pairAddrs = await resolvePairAddresses(factoryAddress, pairs, factoryIface, multicall);

  //  Fetch reserves for all existing pairs (returns array aligned to pairAddrs).
  const reserves = await fetchReserves(pairAddrs, pairIface, multicall, provider);

  //  Fetch token0/token1 for each pair (aligned arrays).
  const pairTokens = await fetchPairTokens(pairAddrs, pairIface, multicall);

  //  Gather unique tokens and fetch decimals (uses cache inside helper).
  const decimalsMap = await fetchTokenDecimals(pairTokens, erc20Iface, multicall, chainId);

  //  Assemble final Reserves[] (normalize types, attach block metadata, etc).
  const results = assembleResults({
    chainId,
    dexName,
    factoryAddress,
    pairs,
    pairAddrs,
    reserves,
    pairTokens,
    decimalsMap,
    provider,
  });

  return results;
}

  // helper: normalize & validate an address string; returns checksummed address or null
  function safeAddr(maybeAddr: unknown): string | null {
    if (typeof maybeAddr !== "string") return null;
    try {
      // getAddress accepts lower/upper and computes checksum; throws on invalid hex/length
      return getAddress(maybeAddr);
    } catch (err) {
      return null;
    }
  }

/**
 * Safe resolvePairAddresses: normalizes addresses, handles missing/invalid addresses,
 * and calls multicall via a runtime-safe path (tryAggregate -> callStatic.tryAggregate).
 */
export async function resolvePairAddresses(
  factoryAddress: string,
  pairs: TokenPair[],
  factoryIface: Interface,
  multicall: Multicall2Contract
): Promise<(string | null)[]> {

  // Build multicall payload (addresses must be plain strings). If address invalid, substitute ZERO.
  const ZERO = "0x0000000000000000000000000000000000000000";
  const calls = pairs.map((p) => {
    const a0 = safeAddr(p?.token0?.address) ?? ZERO;
    const a1 = safeAddr(p?.token1?.address) ?? ZERO;
    return {
      target: factoryAddress,
      callData: factoryIface.encodeFunctionData("getPair", [a0, a1]),
    };
  });

  // Execute multicall: prefer multicall.tryAggregate (attached helper), otherwise callStatic.tryAggregate
  let results: [boolean, string][] = [];
  if (typeof (multicall as any).tryAggregate === "function") {
    results = await (multicall as any).tryAggregate(false, calls);
  } else if (multicall.callStatic && typeof multicall.callStatic.tryAggregate === "function") {
    results = await multicall.callStatic.tryAggregate(false, calls);
  } else {
    throw new Error("Multicall contract does not expose tryAggregate or callStatic.tryAggregate");
  }

  // Decode results aligned with pairs
  const out: (string | null)[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const r = results[i];
    let addr: string | null = null;

    if (r) {
      const [ok, data] = r;
      if (ok && data !== "0x") {
        try {
          const [decoded] = factoryIface.decodeFunctionResult("getPair", data);
          if (decoded && decoded !== ZERO) {
            try {
              // normalize returned pair address to checksummed form
              addr = getAddress(decoded);
            } catch (err) {
              // decoded address invalid — keep addr = null
              console.warn(`resolvePairAddresses: decoded pair not valid checksum at index ${i}`, err);
            }
          }
        } catch (err) {
          console.warn(`resolvePairAddresses: decode error for index ${i}`, err);
        }
      }
    } else {
      console.warn(`resolvePairAddresses: missing multicall result for index ${i}`);
    }

    // cache result using addresses (lowercased) — don't use symbols
    const tok0Addr = safeAddr(pairs[i]?.token0?.address) ?? ZERO;
    const tok1Addr = safeAddr(pairs[i]?.token1?.address) ?? ZERO;
    const cacheKey = keyFactory(factoryAddress, tok0Addr.toLowerCase(), tok1Addr.toLowerCase());
    pairAddrCache.set(cacheKey, addr);

    out.push(addr);
  }

  return out;
}

/**
 * Fetch reserves for the provided pair addresses (aligned array).
 * Returns an array aligned to pairAddrs where each element is either:
 *   { reserve0, reserve1, blockNumber, blockTimestamp, pairTimestampLast } or null (if no pair)
 */
export async function fetchReserves(
  pairAddrs: (string | null)[],
  pairIface: Interface,
  multicall: Multicall2Contract,
  provider: JsonRpcProvider
): Promise<
  (
    | {
        reserve0: string;
        reserve1: string;
        blockNumber: number;
        blockTimestamp: number;
        pairTimestampLast: number | null;
      }
    | null
  )[]
> {
  // Build mapping of existing pairs with original indices
  const existing = pairAddrs
    .map((addr, idx) => ({ addr, idx }))
    .filter((x) => x.addr !== null) as { addr: string; idx: number }[];

  if (existing.length === 0) {
    // fast return: no pairs to query
    return pairAddrs.map(() => null);
  }

  // Build multicall payload
  const calls = existing.map((e) => ({
    target: e.addr,
    callData: pairIface.encodeFunctionData("getReserves", []),
  }));

  // Snapshot block for metadata
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  if (!block) {
    throw new Error(`fetchReserves: failed to fetch block ${blockNumber}`);
  }

  // Execute multicall
  const results = await multicall.tryAggregate(false, calls);

  // Prepare an output array aligned with pairAddrs
  const out = pairAddrs.map(() => null as null | {
    reserve0: string;
    reserve1: string;
    blockNumber: number;
    blockTimestamp: number;
    pairTimestampLast: number | null;
  });

  // Decode results and place them back into original indices
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const mapping = existing[i];
    if (!mapping) {
      continue; // defensive
    }
    const { idx } = mapping;

    if (!res) {
      (out[idx] as any) = null;
      continue;
    }

    const [ok, data] = res;
    if (!ok || data === "0x") {
      out[idx] = null;
      (out[idx] as any) = null;
      continue;
    }

    try {
      const [r0, r1, blockTimestampLast] = pairIface.decodeFunctionResult("getReserves", data);
      out[idx] = {
        reserve0: r0.toString(),
        reserve1: r1.toString(),
        blockNumber,
        blockTimestamp: block.timestamp,
        pairTimestampLast: blockTimestampLast ? Number(blockTimestampLast) : null,
      };
    } catch (err) {
      console.warn(`fetchReserves: decode error for pair index ${idx}`, err);
      out[idx] = null;
    }
  }

  return out;
}

/**
 * Fetch token0 and token1 for each pair address.
 * Returns an array aligned with pairAddrs where each entry is {token0, token1} or null.
 */
export async function fetchPairTokens(
  pairAddrs: (string | null)[],
  pairIface: Interface,
  multicall: Multicall2Contract
): Promise<({ token0: string; token1: string } | null)[]> {
  const existing = pairAddrs
    .map((addr, idx) => ({ addr, idx }))
    .filter((x) => x.addr !== null) as { addr: string; idx: number }[];

  if (existing.length === 0) {
    return pairAddrs.map(() => null);
  }

  // token0 calls
  const token0Calls = existing.map((e) => ({
    target: e.addr,
    callData: pairIface.encodeFunctionData("token0", []),
  }));
  // token1 calls
  const token1Calls = existing.map((e) => ({
    target: e.addr,
    callData: pairIface.encodeFunctionData("token1", []),
  }));

  const [t0Results, t1Results] = await Promise.all([
    multicall.tryAggregate(false, token0Calls),
    multicall.tryAggregate(false, token1Calls),
  ]);

  const out = pairAddrs.map(() => null as null | { token0: string; token1: string });

  for (let i = 0; i < existing.length; i++) {
    const map = existing[i];
    if (!map) {
      console.warn(`fetchPairTokens: missing mapping for existing[${i}]`);
      continue;
    }
    const { idx } = map;

    const t0 = t0Results[i];
    const t1 = t1Results[i];
    let token0: string | null = null;
    let token1: string | null = null;

    if (t0 && t0[0] && t0[1] !== "0x") {
      try {
        const [decoded0] = pairIface.decodeFunctionResult("token0", t0[1]);
        token0 = decoded0;
      } catch (err) {
        console.warn(`fetchPairTokens: token0 decode error for index ${idx}`, err);
      }
    }

    if (t1 && t1[0] && t1[1] !== "0x") {
      try {
        const [decoded1] = pairIface.decodeFunctionResult("token1", t1[1]);
        token1 = decoded1;
      } catch (err) {
        console.warn(`fetchPairTokens: token1 decode error for index ${idx}`, err);
      }
    }

    if (token0 && token1) {
      out[idx] = { token0, token1 };
    } else {
      out[idx] = null;
    }
  }

  return out;
}

/**
 * Fetch decimals for a set of tokens (derived from pair token lists).
 * Uses in-process cache (decimalsCache) to avoid repeated on-chain calls.
 * Returns a map: tokenLower -> number | null
 */
export async function fetchTokenDecimals(
  pairTokens: ({ token0: string; token1: string } | null)[],
  erc20Iface: Interface,
  multicall: Multicall2Contract,
  chainId: number
): Promise<Record<string, number | null>> {
  // collect unique token addresses (lowercased)
  const tokenSet = new Set<string>();
  for (const t of pairTokens) {
    if (!t) continue;
    if (t.token0) tokenSet.add(t.token0.toLowerCase());
    if (t.token1) tokenSet.add(t.token1.toLowerCase());
  }
  const tokens = Array.from(tokenSet);

  // prepare calls for tokens not in cache
  const calls: { target: string; callData: string }[] = [];
  const callIndexToToken: string[] = []; // parallel array of tokenLower for each call
  for (const tokenLower of tokens) {
    const cacheKey = `${chainId}:${tokenLower}`;
    if (decimalsCache.has(cacheKey)) continue;
    calls.push({
      target: tokenLower,
      callData: erc20Iface.encodeFunctionData("decimals", []),
    });
    callIndexToToken.push(tokenLower);
  }

  // execute multicall for decimals
  let results: [boolean, string][] = [];
  if (calls.length > 0) {
    results = await multicall.tryAggregate(false, calls);
  }

  // populate cache for queried tokens
  for (let i = 0; i < callIndexToToken.length; i++) {
    const tokenLower = callIndexToToken[i];
    const cacheKey = `${chainId}:${tokenLower}`;
    const r = results[i];
    if (!r) {
      decimalsCache.set(cacheKey, NaN);
      continue;
    }
    const [ok, data] = r;
    if (!ok || data === "0x") {
      decimalsCache.set(cacheKey, NaN);
      continue;
    }
    try {
      const [dec] = erc20Iface.decodeFunctionResult("decimals", data);
      const decNum = Number(dec);
      decimalsCache.set(cacheKey, Number.isFinite(decNum) ? decNum : NaN);
    } catch (err) {
      decimalsCache.set(cacheKey, NaN);
    }
  }

  // build result map from all tokens (use cached values or null)
  const out: Record<string, number | null> = {};
  for (const tokenLower of tokens) {
    const cacheKey = `${chainId}:${tokenLower}`;
    const val = decimalsCache.get(cacheKey);
    out[tokenLower] = Number.isFinite(val) ? (val as number) : null;
  }

  return out;
}

/**
 * Assemble final Reserves[] using pieces: pairs, pairAddrs, reserves, tokens, decimalsMap.
 * Returns an array aligned with the original `pairs`.
 */
export function assembleResults(params: {
  chainId: number;
  dexName: string;
  factoryAddress: string;
  pairs: TokenPair[];
  pairAddrs: (string | null)[];
  reserves: (null | { reserve0: string; reserve1: string; blockNumber: number; blockTimestamp: number; pairTimestampLast: number | null })[];
  pairTokens: ({ token0: string; token1: string } | null)[];
  decimalsMap: Record<string, number | null>;
  provider?: JsonRpcProvider; // optional, available if needed
}): Reserve[] {
  const {
    chainId,
    dexName,
    pairs,
    pairAddrs,
    reserves,
    pairTokens,
    decimalsMap,
  } = params;


  const results: Reserve[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    if (!p) {
      console.warn(`assembleResults: missing pair at index ${i}`);
      continue;
    }
    const addr = pairAddrs[i];
    const r = reserves[i];
    const t = pairTokens[i];

    const token0 = t?.token0 ?? null;
    const token1 = t?.token1 ?? null;
    const decimals0 = token0 ? decimalsMap[token0.toLowerCase()] ?? null : null;
    const decimals1 = token1 ? decimalsMap[token1.toLowerCase()] ?? null : null;

    const row: Reserve = {
      chain: chainId,
      dex: dexName,
      pairKey: p.pairKey || `${p.token0.symbol}-${p.token1.symbol}`,
      pairAddress: addr!,
      token0,
      token1,
      reserve0: r ? r.reserve0 : null,
      reserve1: r ? r.reserve1 : null,
      decimals0,
      decimals1,
      blockNumber: r ? r.blockNumber : null,
      blockTimestamp: r ? r.blockTimestamp : null,
      ...(r && r.pairTimestampLast != null ? { pairTimestampLast: r.pairTimestampLast } : {}),
    };

    results.push(row);
  }

  return results;
}
