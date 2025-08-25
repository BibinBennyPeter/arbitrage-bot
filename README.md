# Arbitrage Bot

A cross-DEX arbitrage simulation and opportunity detection engine for UniswapV2-like AMMs.  
**Find, simulate, and expose profitable arbitrage routes—no real trades executed.**

---

## Table of Contents

- [Project Overview](#project-overview)
- [Motivation & Purpose](#motivation--purpose)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Architecture & Flow](#architecture--flow)
- [File-by-File Explanation](#file-by-file-explanation)
- [Math & Arbitrage Logic](#math--logic)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Examples & Sample Output](#examples--sample-output)
- [Error Cases & Known Limitations](#error-cases--known-limitations)
- [Security & Safety Notes](#security--safety-notes)
- [How to Extend](#how-to-extend)
- [Developer Notes](#developer-notes)
- [Troubleshooting](#troubleshooting)
- [Testing & Validation Suggestions](#testing--validation-suggestions)
- [Changelog / Recent Changes](#changelog--recent-changes)
- [License & Contribution](#license--contribution)

---

## Project Overview

**arbitrage-bot** detects and simulates arbitrage opportunities between DEXes on Ethereum and Polygon.  
- **Fetches** pool reserves via multicall for configured token pairs across DEXes.
- **Simulates** round-trip arbitrage trades for each pair across chains.
- **Calculates** optimal trade size (fixed in code) and profit, accounting for DEX fees.
- **Persists** results in a database via Prisma.
- **Exposes** an Express API endpoint (`GET /opportunities`) for real-time results.

> **Simulation only**: This project _does not_ execute real trades or interact with on-chain contracts for order routing.

---

## Motivation & Purpose

DeFi liquidity pools create cross-DEX price gaps. This bot helps:
- **Detect** arbitrage opportunities (price gaps across UniswapV2, SushiSwap, QuickSwap, etc.)
- **Simulate** round-trip trades to estimate realistic profits (fees, slippage ignored)
- **Monitor** on-chain state for researchers, traders, and MEV evaluators

Intended as an **educational research tool**—not a production trading bot.

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/BibinBennyPeter/arbitrage-bot.git
cd arbitrage-bot
npm install
```

### 2. Configure Environment

Copy and edit `.env.example`:

```bash
cp .env.example .env
# Fill in all RPC_*, MULTICALL_* addresses, and DB settings as needed.
```

See [Environment Variables](#environment-variables) below.

### 3. Run Prisma Migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Development Mode (Hot Reload)

```bash
npm run dev
# Uses tsx to watch src/server.ts
```

### 5. Production Build

```bash
npm run build
npm run start
# Runs dist/server.js with node
```

## Environment Variables

Copy or reference `.env.example`.  
**Required**:

```
RPC_ETHEREUM=https://mainnet.infura.io/v3/<YOUR_KEY>
RPC_POLYGON=https://polygon-rpc.com
RPC_BSC=
MULTICALL_ETHEREUM=0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696
MULTICALL_POLYGON=0x275617327c958bD06b5D6b871E7f491D76113dd8F
MULTICALL_BSC=
PAIR_CHUNK_SIZE=30
PORT=3000
DATABASE_URL="file:./dev.db"
```

- **RPC_ETHEREUM, RPC_POLYGON**: Required. Your node providers.
- **MULTICALL_*:** Required for each chain you use.
- **PAIR_CHUNK_SIZE**: Optional; default is 30 if not set.
- **PORT**: API server port (default 3000).
- **DATABASE_URL**: SQLite connection for Prisma (`dev.db` by default).

---

## Architecture & Flow

### Runtime Flow

```
            +----------------------+
            |   Express API        |
            |  (server.ts)         |
            +----------+-----------+
                       |
          GET /opportunities
                       |
              [SQLite/Prisma]
                       ^
                       |
     +-----------------+------------------+
     |       runFetcherJob() scheduler    |
     |         (every 30 seconds)         |
     +-----------------+------------------+
                       |
           +---[fetcher.ts]---+
           |                 |
  Multicall -> On-chain RPC  |
           |                 |
           v                 v
  Reserves & Pairs    Arbitrage Calculation
   (normalized)          (arbitrage.ts)
           |                 |
           +---------[DB]----+
```

### Sequence Example

1. `runFetcherJob()` (server.ts) runs every 30 seconds:
   - For each configured DEX (config/dexes.ts), fetches reserves for all pairs (fetcher.ts).
   - Uses multicall contracts for batch efficiency.
2. Normalizes results (decimals, addresses).
3. Passes all reserves to `calculateArbitrage()` (arbitrage.ts).
4. Arbitrage simulation determines profit for each DEX/pair combination.
5. Results are saved to Prisma DB (`results` table).
6. API endpoint `/opportunities` serves latest results.

---

## File-by-File Explanation

#### src/fetcher.ts

- **Purpose**: Off-chain batch fetching of pair addresses, pool reserves, token decimals.
- **Exports**:
  - `fetchPairsAndReserves(chainId, dexName, factoryAddress, pairs)`: Main entry, returns array of reserves.
  - `resolvePairAddresses(...)`: Gets pair contract addresses for token pairs using multicall.
  - `fetchReserves(...)`: Reads on-chain reserves for addresses.
  - `fetchPairTokens(...)`: Reads token0/token1 addresses for pairs.
  - `fetchTokenDecimals(...)`: Reads decimals for all involved tokens, caches results.
  - `assembleResults(params)`: Glues all fetched data into typed Reserve objects.
- **Key Constants**:
  - Uses multicall `tryAggregate.staticCall` for all read ops.
- **Caching**:
  - `pairAddrCache`, `decimalsCache` (in `utils/helper.js`) minimize repeated calls.
- **Error Handling**:
  - Defensive checks for missing data, invalid addresses, decode errors, with warnings.

#### src/arbitrage.ts

- **Purpose**: Simulate arbitrage trades between DEXes for all matching pairs.
- **Exports**:
  - `calculateArbitrage(reserves: ReserveWithFee[]) => ArbitrageOpportunity[]`
- **Logic**:
  - For each pair of reserves across DEXes:
    - Normalize token order (`token0 < token1` for stable comparison).
    - Calculate AMM price on each DEX.
    - If prices differ, simulate round-trip trade (buy→sell).
    - Compute profit, only push if `profit > 0`.
  - Trade size fixed at 1000 units.
- **Key Constants**:
  - `tradeSize = 1000` (hardcoded).
  - Fee taken from DEX config (0.003 = 0.3%).
- **Math**:
  - Uses `getAmountOut` (see [Math & Logic](#math--logic)).
- **Console Output**:
  - Logs all opportunities, price gaps, and computed profits.

#### src/server.ts

- **Purpose**: Express API server & job scheduler.
- **Main Flow**:
  - On boot, runs `runFetcherJob()` and schedules it every 30s.
  - For each DEX, fetches reserves, calculates arbitrage, saves to DB.
  - API: `GET /opportunities` returns most recent 20 results.
- **Error Handling**:
  - Catches/resumes on fetch failures per DEX.

#### src/config/config.ts

- **Purpose**: Loads environment, validates required RPCs and multicall addresses.
- **Exports**:
  - `RPC`, `PAIR_CHUNK_SIZE`, `MULTICALL_ADDRESS_BY_CHAIN`
- **Validation**:
  - Throws if no RPC set. Warns if no multicall address present.

#### src/config/dexes.ts

- **Purpose**: Lists all DEXes and token pairs to scan.
- **Exports**:
  - `DEXES: DexConfig[]` (name, factory, fee, chainId)
  - `PAIRS: Record<number, TokenPair[]>` (all pairs per chain)
- **Defaults**:
  - DEX fee hardcoded (0.003).

#### src/types/index.ts

- **Purpose**: TypeScript types for all major objects.
- **Types**:
  - `DexConfig`: DEX metadata.
  - `TokenPair`: Pair config (token0/token1: {symbol, address, decimals})
  - `Reserve`, `ReserveWithFee`: Pool state (plus DEX fee).
  - `ArbitrageOpportunity`: Result object (buy/sell DEX, priceBuy, priceSell, profit, percent, etc.)

#### src/utils/helper.js

- **Helpers**:
  - `keyFactory`: Generates unique cache keys for address lookup.
  - `safeAddr`: Substitutes invalid addresses with ZERO.
  - `pairAddrCache`, `decimalsCache`: In-memory caches for repeated calls.
  - `sortTokens`: Deterministically order tokens.
- **Purpose**: Avoids repeated multicall and on-chain lookups.

#### src/utils/multicall.js

- **Helpers**:
  - `getMulticall(chainId, provider)`: Gets multicall contract for chain.
  - `getProvider(chainId)`: Resolves JsonRpcProvider from env.

#### prisma/schema.prisma

- **Model**:
  ```prisma
  model Results {
    id        Int     @id @default(autoincrement())
    dex       String
    chain     Int
    pairKey   String
    token0    String
    token1    String
    priceBuy  Float
    priceSell Float
    profit    Float
    profitPercent Float
    reserve0  String
    reserve1  String
    fee       Float
    timestamp Int
  }
  ```
- **Purpose**: Stores all detected arbitrage opportunities.

#### package.json

- **Scripts**:
  - `"generate": "prisma generate"`
  - `"dev": "npm run generate && tsx watch src/server.ts"`
  - `"build": "tsc"`
  - `"start": "node dist/server.js"`
- **Dependencies**:
  - `express`, `ethers`, `prisma`, `dotenv`, `tsx`, etc.

#### tsconfig.json

- **CompilerOptions**:
  - `"module": "nodenext"`
  - `"target": "esnext"`
  - `"strict": true`
  - `"resolveJsonModule": true`
  - `"esModuleInterop": true`

---

## Math & Logic

### getAmountOut (Constant Product AMM)

```typescript
function getAmountOut(amountIn, reserveIn, reserveOut, fee) {
  const amountInWithFee = amountIn * (1 - fee);
  return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
}
```

**Explanation**:
- Simulates swap: input token amount, pool reserves, and swap fee.
- Fee is subtracted before swap math.
- AMM preserves `x * y = k`; slippage not modeled for large trades.

### Price Calculation

- **Price on DEX**: `priceA = reserveB / reserveA` (tokenB per tokenA)
- **Normalization**: Always order tokens `token0 < token1` for consistent price direction.

### Arbitrage Simulation

- For each matching pair on two DEXes:
  1. Check if priceA ≠ priceB.
  2. If priceA < priceB: simulate buying tokenA on DEX A, selling tokenA on DEX B.
  3. Compute round-trip profit: `(amountBack - tradeSize)`
  4. Only report if profit > 0.

### Decimals Normalization

- Reserves scaled by their decimals: `Number(reserve) / (10 ** decimals)`.

---

## Database Schema

### Results Table (Prisma)

- **Fields**:
  - `dex`, `chain`, `pairKey`, `token0`, `token1`, `priceBuy`, `priceSell`, `profit`, `profitPercent`, `reserve0`, `reserve1`, `fee`, `timestamp`
- **Example Record**:
  ```json
  {
    "id": 1,
    "dex": "QuickSwap",
    "chain": 137,
    "pairKey": "WMATIC-USDC",
    "token0": "WMATIC",
    "token1": "USDC",
    "priceBuy": 0.978,
    "priceSell": 0.981,
    "profit": 0.23,
    "profitPercent": 0.023,
    "reserve0": "1000000000000000000000",
    "reserve1": "1000000000",
    "fee": 0.003,
    "timestamp": 1724569140
  }
  ```
- **Mapping**: Results are persisted in `server.ts` via `prisma.results.createMany`. Timestamp is block timestamp or current time.

---

## API Documentation

### GET /opportunities

Returns latest 20 arbitrage opportunities.

#### Example Response

```json
[
  {
    "id": 1,
    "dex": "QuickSwap",
    "chain": 137,
    "pairKey": "WMATIC-USDC",
    "token0": "WMATIC",
    "token1": "USDC",
    "priceBuy": 0.978,
    "priceSell": 0.981,
    "profit": 0.23,
    "profitPercent": 0.023,
    "reserve0": "1000000000000000000000",
    "reserve1": "1000000000",
    "fee": 0.003,
    "timestamp": 1724569140
  }
]
```

#### Example curl

```bash
curl http://localhost:3000/opportunities
```

#### Example JS fetch

```js
const resp = await fetch('http://localhost:3000/opportunities');
const data = await resp.json();
console.log(data);
```

---

## Examples & Sample Output

### Console Output (calculateArbitrage)

```
=== ARBITRAGE ANALYSIS ===
Analyzing 4 reserves with trade size: 1000

--- Analyzing same pair on different DEXes ---
DEX A (QuickSwap): WMATIC/USDC
DEX B (SushiSwap (Polygon)): WMATIC/USDC
Normalized reserves A: 1000.00 WMATIC / 1000.00 USDC
Normalized reserves B: 950.00 WMATIC / 1050.00 USDC
Price on DEX A: 1 WMATIC = 1.000000 USDC
Price on DEX B: 1 WMATIC = 1.105263 USDC
Price difference: 10.5263%
Arbitrage 1: Buy on QuickSwap, sell on SushiSwap (Polygon)
1000 WMATIC → 1000.000000 USDC → 950.387597 WMATIC
Profit: -49.612403 WMATIC (-4.9612%)
No profitable arbitrage opportunities found.
```

### /opportunities Output

See [API Documentation](#api-documentation) above.

---

## Error Cases & Known Limitations

**Known Error Cases**:
- Pair address resolution returns `null` (missing pool).
- Reserves missing or decode errors in multicall.
- Token decimals unavailable (cache fallback to NaN).
- Defensive: Catches errors, logs warnings, skips affected pools.

**Limitations**:
- **No slippage, front-running, or gas cost modeled**.
- Trade size is fixed (`1000`)—no optimization or sizing.
- **No real order execution**—simulation only.
- **No flash loans or MEV integration**.
- Relies on off-chain multicall RPC snapshots (can be stale).
- Only direct pairwise arbitrage (no triangular or multi-hop).
- **SafeAddr**: Invalid addresses replaced with ZERO.

---

## Security & Safety Notes

- Do **not** include private keys in `.env`.
- Protect RPC endpoints—do not share paid node URLs.
- **No contract signing or funds required**—project is simulation only.
- **Real execution** would require:
  - Private key management
  - Transaction signing and gas estimation
  - MEV/Flashbots integration
  - Security audit

---

## How to Extend

### Add Another DEX or Chain

- Edit `src/config/dexes.ts`:
  - Add to `DEXES` array (name, factory, fee, chainId).
  - Add pairs to `PAIRS`.

### Implement Triangular Arbitrage

- Extend `arbitrage.ts` to handle three-pool/token cycles.
- Add logic for multi-hop price simulation.

### Replace Simulation with Real Execution

- Requires:
  - On-chain contract interaction (swap, approve, flashloan).
  - Private key and wallet.
  - Careful error and gas handling.
  - Flashbots or MEV protection.
- **Warning**: This is a major security risk. Do not attempt on mainnet without audit.

### Improve Profit/Gas Model

- Add gas estimation per swap.
- Subtract estimated gas cost from profit calculation.

---

## Developer Notes

- **Build**: `npm run build`
- **Lint/Format**: (Not present, suggest adding eslint/prettier)
- **TypeScript Types**:
  - `Reserve`, `ReserveWithFee`, `TokenPair`, `DexConfig`, `ArbitrageOpportunity`—all in `src/types/index.ts`.
- **Providers**:
  - `getProvider(chainId)` looks up correct RPC from env.
  - `getMulticall(chainId, provider)` for multicall contract.

---

## Troubleshooting

- **Missing RPC or Multicall**: Check `.env`, ensure all endpoints and addresses filled.
- **Prisma Errors**: Try `npx prisma generate` and `npx prisma migrate dev`.
- **Rate Limiting**: Use private RPC endpoints; avoid public free nodes.
- **Debugging**: Add `console.log` in fetcher/arbitrage for more verbose output.
- **Startup**: If pools or reserves missing, check network, addresses, and contracts.

---

## Testing & Validation Suggestions

- **Unit Test**: Validate `getAmountOut` math for various reserves and fees.
- **Integration**: Run fetcher against a known testnet pair, compare reserves with block explorer.
- **Suggested Test Script**:

```typescript
// test/arbitrage.test.ts
import { getAmountOut } from '../src/arbitrage';
console.log(getAmountOut(1000, 10000, 10000, 0.003)); // Should match AMM math
```

---

## Changelog / Recent Changes

- **Multicall**: Uses `tryAggregate.staticCall` for robust, read-only multicall.
- **SafeAddr**: Defensive address normalization to avoid bad multicall calls.
- **Fee Handling**: Fee parameterized per DEX, not hardcoded.
- **Error Handling**: All multicall decode errors logged, not fatal.

---

## License & Contribution

- **License**: ISC (see package.json)
- **Contributing**:
  - Open PRs or issues via GitHub.
  - Fork, edit, submit PR with details.
  - Please follow TypeScript style and document changes.
