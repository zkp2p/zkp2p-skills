# Peerlytics Analytics API Reference

Base URL: `https://peerlytics.xyz`

SDK class: `Peerlytics` from `@peerlytics/sdk`

## Authentication

| Header | Method | Value |
|--------|--------|-------|
| `X-API-Key` | API Key | Your API key string |
| `X-Payment-Proof` | x402 | Transaction hash of USDC payment on Base |

## Analytics Endpoints

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| GET | `/api/v1/analytics/summary` | `getSummary()` | Protocol summary: periods, liquidity, spreads, changes, top currencies |
| GET | `/api/v1/analytics/period` | `getPeriod(range)` | Period analytics for a specific time range |
| GET | `/api/v1/analytics/chunk` | `getChunk(range, chunk)` | Granular time-series data |
| GET | `/api/v1/analytics/leaderboard` | `getLeaderboard(params)` | Maker and taker leaderboards |
| GET | `/api/v1/analytics/attribution` | `getAttribution()` | Attribution analytics |
| GET | `/api/v1/analytics/deposit-attribution` | `getDepositAttribution()` | Deposit attribution data |

## Market & Metadata Endpoints

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| GET | `/api/v1/market/summary` | `getMarketSummary(opts)` | Market spreads per platform/currency |
| GET | `/api/v1/meta/currencies` | `getCurrencies()` | Available currencies with hashes |
| GET | `/api/v1/meta/platforms` | `getPlatforms()` | Available platforms with method hashes |

## Response Types

### GET /api/v1/analytics/summary

No query params required.

```typescript
interface AnalyticsSummary {
  timestamp: string;
  periods: Record<'mtd' | '3mtd' | 'ytd', AnalyticsSummaryPeriod>;
  liquidity: {
    available: number;
    activeDeposits: number;
  };
  spreads: {
    current_spread_bps: number;
    min_spread_bps: number;
    max_spread_bps: number;
  } | null;
  changes: {
    volume: {
      mtd_vs_prior_month: number | null;
      qtd_vs_prior_quarter: number | null;
      ytd_vs_prior_year: number | null;
    };
    users: {
      mtd_vs_prior_month: number | null;
      qtd_vs_prior_quarter: number | null;
      ytd_vs_prior_year: number | null;
    };
  };
  topCurrencies: Array<{
    currency: string;
    display?: string;
    volume: number;
    trades: number;
    avg_rate: string | null;
  }>;
  meta: CachedMeta;
}

interface AnalyticsSummaryPeriod {
  range: { start: string; end: string; days: number };
  metrics: {
    volume: number;
    trades: number;
    intents: number;
    fulfilled: number;
    successRate: number;
    uniqueUsers: number;
    totalEvents: number;
  };
  avgHourlyVolume?: number;
  avgDailyVolume?: number;
}

interface CachedMeta {
  cached_at: string;
  cache_duration_seconds: number;
  source: string;
  range?: string;
  message?: string;
}
```

### GET /api/v1/analytics/period

Query params: `range` (`mtd` | `3mtd` | `ytd` | `all`)

```typescript
type TimeRange = 'mtd' | '3mtd' | 'ytd' | 'all';

interface PeriodData {
  [key: string]: unknown;
  meta: CachedMeta & { range: string };
}
```

### GET /api/v1/analytics/chunk

Query params: `range` (`mtd` | `3mtd` | `ytd` | `all`), `chunk` (`daily` | `hourly` | `flows` | `deposits`)

```typescript
type ChunkType = 'daily' | 'hourly' | 'flows' | 'deposits';

interface ChunkResponse {
  data: unknown;
  cachedAt?: string;
  isStale: boolean;
  range: TimeRange;
  chunk: ChunkType;
  source: string;
}
```

### GET /api/v1/analytics/leaderboard

Query params: `limit`, `offset`

```typescript
interface LeaderboardData {
  makers: {
    byVolume: MakerLeaderboardEntry[];
    byAPR: MakerLeaderboardEntry[];
    byProfit: MakerLeaderboardEntry[];
  };
  takers: {
    byVolume: TakerLeaderboardEntry[];
    byLockScore: TakerLeaderboardEntry[];
    byActivity: TakerLeaderboardEntry[];
  };
  meta: CachedMeta & { source: string };
}

interface MakerLeaderboardEntry {
  rank: number;
  address: string;
  addressShort: string;
  volumeUsd: number;
  grossDepositedUsd: number;
  activeDeposits: number;
  fulfilledIntents: number;
  successRatePct: number;
  realizedProfitUsd: number;
  realizedPnlPct: number | null;
  aprPct: number | null;
  updatedAt: string;
}

interface TakerLeaderboardEntry {
  rank: number;
  address: string;
  addressShort: string;
  volumeUsd: number;
  signalCount: number;
  fulfillCount: number;
  pruneCount: number;
  successRatePct: number;
  trustScore: number;
  tier: string;
  tierCap: number;
  firstSeenAt: string | null;
  updatedAt: string;
}
```

### GET /api/v1/market/summary

Query params: `platform` (comma-separated), `currency` (comma-separated), `includeRates` (boolean), `limit`, `offset`

```typescript
interface MarketSummaryData {
  updatedAt: string;
  computedBy: string;
  version: number;
  markets: MarketEntry[];
  count: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  filters: Record<string, unknown>;
}

interface MarketEntry {
  platform: string;
  currency: string;
  sampleSize: number;
  totalLiquidity: number;
  p25: number | null;        // 25th percentile rate
  median: number | null;     // Median rate
  p75: number | null;        // 75th percentile rate
  p90: number | null;        // 90th percentile rate
  suggestedRate: number | null;
  rateEntries?: Array<{ rate: number; liquidity: number }>;
}
```

### GET /api/v1/meta/currencies

No query params.

```typescript
interface CurrencyInfo {
  code: string;
  label: string;
  flag: string;
  hashes: string[];
}
// Response: { currencies: CurrencyInfo[] }
```

### GET /api/v1/meta/platforms

No query params.

```typescript
interface PlatformInfo {
  id: string;
  label: string;
  methodHashes: string[];
}
// Response: { platforms: PlatformInfo[] }
```

## x402 Payment Flow

1. Agent makes API request without authentication
2. Server responds with HTTP 402 + payment requirements (USDC amount, Base recipient address)
3. Agent sends USDC microtransaction on Base
4. Agent retries request with `X-Payment-Proof` header containing the tx hash
5. Server validates the on-chain payment and returns data

Typical cost: $0.001-0.01 per request depending on data complexity.

## Related Endpoints (Other Skills)

The following endpoints are part of the Peerlytics SDK but documented in other skills:

| Endpoint | SDK Method | Skill |
|----------|-----------|-------|
| `/api/v1/explorer/deposit/{id}` | `getDeposit(id)` | peer-explorer |
| `/api/v1/explorer/intent/{hash}` | `getIntent(hash)` | peer-explorer |
| `/api/v1/explorer/address/{address}` | `getAddress(address)` | peer-explorer |
| `/api/v1/explorer/maker/{address}` | `getMaker(address)` | peer-explorer |
| `/api/v1/explorer/verifier/{address}` | `getVerifier(address)` | peer-explorer |
| `/api/v1/explorer/search` | `search(query, opts)` | peer-explorer |
| `/api/v1/makers/{address}/history` | `getMakerHistory(address)` | peer-explorer |
| `/api/v1/takers/{address}/history` | `getTakerHistory(address)` | peer-explorer |
| `/api/v1/orderbook` | `getOrderbook(opts)` | peer-market |
| `/api/v1/deposits` | `getDeposits(filters)` | peer-market |
| `/api/v1/intents` | `getIntents(filters)` | peer-market |
| `/api/v1/activity` | `getActivity(filters)` | peer-market |
