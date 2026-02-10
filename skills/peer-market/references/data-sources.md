# ZKP2P Market Data Sources Reference

## Peerlytics API Endpoints

Base URL: `https://peerlytics.xyz`

SDK class: `Peerlytics` from `@peerlytics/sdk`

### Endpoints

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| GET | `/api/v1/analytics/summary` | `getSummary()` | Aggregate protocol metrics (volume, trades, liquidity, spreads) |
| GET | `/api/v1/analytics/period?range=mtd\|3mtd\|ytd\|all` | `getPeriod(range)` | Volume and metrics for a time range |
| GET | `/api/v1/analytics/chunk?range=...&chunk=daily\|hourly\|flows\|deposits` | `getChunk(range, chunk)` | Granular time-series data |
| GET | `/api/v1/analytics/leaderboard` | `getLeaderboard(params)` | Maker and taker leaderboards (by volume, APR, profit, lock score) |
| GET | `/api/v1/analytics/attribution` | `getAttribution()` | Attribution analytics |
| GET | `/api/v1/market/summary` | `getMarketSummary(opts)` | Market spread data by platform/currency (MarketEntry[]) |
| GET | `/api/v1/orderbook` | `getOrderbook(opts)` | Rate-level aggregated orderbook with stats and activity |
| GET | `/api/v1/deposits` | `getDeposits(filters)` | Filtered deposit list with enriched data |
| GET | `/api/v1/intents` | `getIntents(filters)` | Filtered intent list with enriched data |
| GET | `/api/v1/activity` | `getActivity(filters)` | Live contract event stream (LiveEvent[]) |
| GET | `/api/v1/explorer/deposit/{id}` | `getDeposit(id)` | Deposit detail with linked payment details |
| GET | `/api/v1/explorer/intent/{hash}` | `getIntent(hash)` | Intent detail with linked data |
| GET | `/api/v1/explorer/address/{address}` | `getAddress(address)` | Address lookup: deposits, intents, stats |
| GET | `/api/v1/explorer/maker/{address}` | `getMaker(address)` | Maker portfolio: summary, deposits, allocations |
| GET | `/api/v1/explorer/verifier/{address}` | `getVerifier(address)` | Verifier stats and breakdown |
| GET | `/api/v1/explorer/search` | `search(query, opts)` | Universal search (address, hash, deposit ID) |
| GET | `/api/v1/meta/currencies` | `getCurrencies()` | Supported currencies with hashes |
| GET | `/api/v1/meta/platforms` | `getPlatforms()` | Supported platforms with method hashes |
| GET | `/api/v1/makers/{address}/history` | `getMakerHistory(address)` | Maker deposit and intent history |
| GET | `/api/v1/takers/{address}/history` | `getTakerHistory(address)` | Taker intent history and lock score |

### Authentication Headers

| Header | Method | Value |
|--------|--------|-------|
| `X-API-Key` | API Key | Your API key string |
| `X-Payment-Proof` | x402 | Transaction hash of USDC payment on Base |

---

### Response Schemas

#### GET /api/v1/market/summary

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

#### GET /api/v1/analytics/period

Query params: `range` (`mtd`|`3mtd`|`ytd`|`all`)

```typescript
interface PeriodData {
  [key: string]: unknown;
  meta: CachedMeta & { range: string };
}

interface CachedMeta {
  cached_at: string;
  cache_duration_seconds: number;
  source: string;
  range?: string;
  message?: string;
}
```

#### GET /api/v1/analytics/summary

No query params required.

```typescript
interface AnalyticsSummary {
  timestamp: string;
  periods: Record<'mtd' | '3mtd' | 'ytd', {
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
  }>;
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
```

#### GET /api/v1/analytics/leaderboard

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

#### GET /api/v1/orderbook

Query params: `currency`, `platform`, `minSize`

```typescript
// Orderbook is rate-level aggregated, NOT individual deposits
interface OrderbookData {
  stats: OrderbookStats;
  orderbooks: OrderbookCurrency[];
  activity: Array<{
    id: string;
    type: 'signal' | 'fulfill' | 'prune';
    amountUsd: number;
    currency: string;
    platform: string;
    timestamp: number;
  }>;
  filters: {
    applied: { currency: string | null; platform: string | null; minSize: number | null };
    available: { currencies: string[]; platforms: string[] };
  };
}

interface OrderbookStats {
  totalLiquidityUsd: number;
  activeMakers: number;
  volume24hUsd: number;
  activeIntents: number;
}

interface OrderbookCurrency {
  currency: string;
  levels: OrderbookLevel[];
  totalLiquidityUsd: number;
  bestRate: number;
  fxMidRate: number | null;
}

interface OrderbookLevel {
  rate: number;
  totalLiquidityUsd: number;
  depositCount: number;
  platforms: string[];
  topDeposit: { depositor: string; depositId: string };
}

interface OrderbookMeta {
  escrow: string;
  chainId: number;
  activityWindow: string;
  maxLevels: number;
  timestamp: string;
}
```

#### GET /api/v1/activity

Query params: `type` (comma-separated), `intentHash`, `depositId`, `address`, `owner`, `depositor`, `recipient`, `since`, `limit`, `offset`

```typescript
type EventType =
  | 'intent_signaled' | 'intent_fulfilled' | 'intent_pruned'
  | 'deposit_created' | 'deposit_topup' | 'deposit_withdrawn'
  | 'deposit_closed' | 'deposit_rate_updated';

interface LiveEvent {
  id: string;
  type: EventType;
  chainId: number;
  blockNumber: number;
  logIndex: number;
  timestamp: string;
  intentHash?: string;
  depositId?: string;
  owner?: string;
  toAddress?: string;
  depositor?: string;
  amount?: string;
  amountUsd?: number;
  platform?: string | null;
  currency?: string;
  conversionRate?: string;
  exchangeRate?: number;
}
```

#### GET /api/v1/explorer/address/{address}

```typescript
// Returns intents, deposits, linked activity, and aggregate stats
interface AddressResponse {
  intents: IntentEntity[];
  deposits: DepositEntity[];
  linked: { activity: AddressActivity };
  stats: AddressStats;
}

interface AddressStats {
  intents_total: number;
  intents_fulfilled: number;
  intents_pruned: number;
  deposits_total: number;
  volume_total_usd: number;
  volume_as_taker_usd: number;
  volume_as_recipient_usd: number;
  volume_as_maker_usd: number;
}
```

---

## GraphQL Indexer Entity Schemas

### Endpoint

- **Staging:** `https://indexer.hyperindex.xyz/00be13d/v1/graphql`

### Core Entities

#### Deposit

```graphql
type Deposit {
  id: String!                    # Format: chainId_escrowAddress_depositId
  chainId: Int!
  escrow: String!                # Escrow contract address
  depositId: String!             # Numeric deposit ID on-chain
  depositor: String!             # Owner wallet address
  token: String!                 # ERC20 token address (USDC)
  depositAmount: BigInt!         # Total deposited (cumulative)
  availableBalance: BigInt!      # Currently available for intents
  acceptingIntents: Boolean!     # Whether deposit is active
  retainOnEmpty: Boolean!        # Keep config when balance hits 0
  intentAmountMin: BigInt!       # Min intent size
  intentAmountMax: BigInt!       # Max intent size
  delegate: String               # Delegated manager address
  intentGuardian: String         # Guardian that can release funds
  rateManagerId: String          # Vault ID if delegated (nullable)
  rateManagerRegistry: String    # Registry address if delegated (nullable)
  createdAt: BigInt!
  updatedAt: BigInt!
  methodCurrencies: [MethodCurrency!]!
}
```

#### MethodCurrency

```graphql
type MethodCurrency {
  id: String!                    # chainId_depositId_paymentMethodHash_currencyHash
  depositId: String!
  paymentMethod: String!         # bytes32 hash (e.g., keccak256("venmo"))
  paymentMethodName: String      # Human-readable name
  currencyCode: String!          # bytes32 hash (e.g., keccak256("USD"))
  currencyName: String           # Human-readable code
  minConversionRate: BigInt!     # Depositor's floor rate (18 decimals)
  managerRate: BigInt            # Vault manager's rate override (nullable)
  conversionRate: BigInt!        # Effective gross rate: max(floor, managerRate) or 0
  isActive: Boolean!
  rateManagerId: String          # Vault providing the rate (nullable)
}
```

#### Intent

```graphql
type Intent {
  id: String!                    # chainId_intentHash
  chainId: Int!
  intentHash: String!
  deposit: Deposit!
  amount: BigInt!                # USDC amount locked
  to: String!                    # Recipient address
  paymentMethod: String!         # bytes32 hash
  fiatCurrency: String!          # bytes32 hash
  conversionRate: BigInt!        # Rate at signal time
  status: String!                # 'signaled' | 'fulfilled' | 'cancelled' | 'released'
  createdAt: BigInt!             # Signal timestamp
  fulfilledAt: BigInt            # Fulfillment timestamp (nullable)
  cancelledAt: BigInt            # Cancellation timestamp (nullable)
  expiresAt: BigInt!             # Expiration timestamp
  rateManagerId: String          # Vault that managed the rate (nullable)
  manager: String                # Manager address at snapshot time (nullable)
  managerFee: BigInt             # Fee % snapshotted at signal (nullable, 1e18 precision)
  managerFeeRecipient: String    # Where fee was routed (nullable)
  managerFeeAmount: BigInt       # Actual fee in USDC (nullable)
}
```

#### RateManager (Vault)

```graphql
type RateManager {
  id: String!                    # chainId_rateManagerId
  chainId: Int!
  registry: String!              # Registry contract address
  rateManagerId: String!         # bytes32 hex vault ID
  manager: String!               # Manager wallet address
  feeRecipient: String!          # Where fees are sent
  maxFee: BigInt!                # Immutable fee ceiling (1e18 precision, max 5e16 = 5%)
  fee: BigInt!                   # Current fee
  depositHook: String!           # Hook contract (0x0 if none)
  name: String!                  # Display name
  uri: String!                   # Metadata URI
  createdAt: BigInt!
  updatedAt: BigInt!
}
```

#### RateManagerRate

```graphql
type RateManagerRate {
  id: String!                    # chainId_rateManagerId_paymentMethodHash_currencyCode
  rateManagerId: String!
  paymentMethodHash: String!     # bytes32
  currencyCode: String!          # Human-readable currency code
  managerRate: BigInt!           # 0 = pair disabled
  updatedAt: BigInt!
}
```

#### RateManagerDelegation

```graphql
type RateManagerDelegation {
  id: String!                    # chainId_depositId
  rateManagerId: String!
  registry: String!
  depositId: String!             # escrowAddress_depositId
  createdAt: BigInt!
  updatedAt: BigInt!
}
```

#### ManagerAggregateStats

```graphql
type ManagerAggregateStats {
  id: String!
  rateManagerId: String!
  manager: String!
  totalFilledVolume: BigInt!      # Sum USDC across fulfilled intents
  totalFeeAmount: BigInt!         # Sum manager fees collected (USDC)
  totalPnlUsdCents: BigInt!       # Sum PnL in USD cents
  fulfilledIntents: Int!          # Count of fulfilled intents
  currentDelegatedBalance: BigInt! # Current liquidity delegated
  currentDelegatedDeposits: Int!   # Current deposit count
  firstSeenAt: BigInt!
  updatedAt: BigInt!
}
```

#### ManagerStats (Per-Intent)

```graphql
type ManagerStats {
  id: String!                    # intentId
  rateManagerId: String!
  manager: String!
  intentId: String!
  depositId: String!
  amount: BigInt!                # USDC released
  quoteConversionRate: BigInt!   # Rate used for the intent
  marketRate: BigInt!            # Oracle fiat price at time
  spreadBps: Int!                # Basis points spread
  pnlUsdCents: BigInt!           # PnL for this intent in USD cents
  managerFee: BigInt!            # Fee % (1e18 precision)
  managerFeeAmount: BigInt!      # Actual fee collected (USDC)
  createdAt: BigInt!
}
```

#### QuoteCandidate

```graphql
type QuoteCandidate {
  id: String!
  depositId: String!
  paymentMethod: String!
  currencyCode: String!
  availableBalance: BigInt!
  minConversionRate: BigInt!     # Depositor floor
  managerRate: BigInt            # Vault manager rate (nullable)
  rateManagerId: String          # Vault ID (nullable)
  managerFee: BigInt!            # Vault fee %
  effectiveConversionRate: BigInt! # Fee-adjusted rate for taker-facing quotes
  intentAmountMin: BigInt!
  intentAmountMax: BigInt!
  depositor: String!
  isActive: Boolean!
}
```

---

## Example Queries for Common Analytics

### Protocol Overview Dashboard

```graphql
query ProtocolOverview {
  Deposit_aggregate(where: { acceptingIntents: { _eq: true } }) {
    aggregate {
      count
      sum { availableBalance }
    }
  }
  Intent_aggregate(where: { status: { _eq: "fulfilled" } }) {
    aggregate {
      count
      sum { amount }
    }
  }
  RateManager_aggregate {
    aggregate { count }
  }
}
```

### Best Rates for a Platform/Currency Pair

```graphql
query BestRates($platform: String!, $currency: String!) {
  QuoteCandidate(
    where: {
      paymentMethod: { _eq: $platform },
      currencyCode: { _eq: $currency },
      isActive: { _eq: true },
      availableBalance_gt: "0"
    }
    order_by: { effectiveConversionRate: asc }
    limit: 10
  ) {
    depositId
    depositor
    availableBalance
    effectiveConversionRate
    minConversionRate
    managerRate
    rateManagerId
    managerFee
    intentAmountMin
    intentAmountMax
  }
}
```

### Volume by Vault (Vault Ranking)

```graphql
query VaultRanking {
  ManagerAggregateStats(
    order_by: { totalFilledVolume: desc }
    limit: 20
  ) {
    rateManagerId
    manager
    totalFilledVolume
    totalFeeAmount
    totalPnlUsdCents
    fulfilledIntents
    currentDelegatedBalance
    currentDelegatedDeposits
  }
}
```

### Recent Intent Activity for an Address

```graphql
query AddressActivity($address: String!) {
  asDepositor: Deposit(where: { depositor: { _eq: $address } }) {
    id
    depositId
    availableBalance
    acceptingIntents
    rateManagerId
    methodCurrencies {
      paymentMethodName
      currencyName
      conversionRate
      managerRate
    }
  }
  asTaker: Intent(
    where: { to: { _eq: $address } }
    order_by: { createdAt: desc }
    limit: 20
  ) {
    intentHash
    amount
    status
    conversionRate
    createdAt
    fulfilledAt
  }
}
```

### Vault Rate Configuration

```graphql
query VaultRates($rateManagerId: String!) {
  RateManager(where: { rateManagerId: { _eq: $rateManagerId } }) {
    name
    manager
    fee
    maxFee
    feeRecipient
  }
  RateManagerRate(
    where: { rateManagerId: { _eq: $rateManagerId } }
    order_by: { updatedAt: desc }
  ) {
    paymentMethodHash
    currencyCode
    managerRate
    updatedAt
  }
  RateManagerDelegation(where: { rateManagerId: { _eq: $rateManagerId } }) {
    depositId
    createdAt
  }
}
```

### Expired Intents (for pruning analysis)

```graphql
query ExpiredIntents($depositor: String!, $now: BigInt!) {
  Intent(
    where: {
      deposit: { depositor: { _eq: $depositor } },
      status: { _eq: "signaled" },
      expiresAt: { _lt: $now }
    }
    order_by: { expiresAt: asc }
  ) {
    intentHash
    amount
    expiresAt
    deposit { depositId }
  }
}
```

---

## x402 Payment Flow

```
Agent                          Peerlytics API                     Base Chain
  |                                 |                                |
  |-- GET /api/v1/market/summary -->|                                |
  |                                 |                                |
  |<-- HTTP 402 + Payment Details --|                                |
  |    { amount: "0.001",           |                                |
  |      recipient: "0xPeer...",    |                                |
  |      chainId: 8453,            |                                |
  |      token: USDC }             |                                |
  |                                 |                                |
  |-- USDC transfer (0.001) --------|-----> on-chain transfer ----->|
  |                                 |                                |
  |<-- tx hash confirmation --------|<----- tx confirmed -----------|
  |                                 |                                |
  |-- GET /api/v1/market/summary -->|                                |
  |    X-Payment-Proof: 0xtxhash   |                                |
  |                                 |-- validate tx on-chain ------>|
  |                                 |<-- confirmed -----------------|
  |                                 |                                |
  |<-- 200 OK + market data -------|                                |
  |                                 |                                |
```

Key properties:
- No registration or API key required
- Each request is independently paid and authenticated
- Payment IS the authentication -- no separate auth flow
- Agent only needs USDC on Base to access any endpoint
- Typical cost: $0.001-0.01 per request depending on data complexity
- Payment is validated on-chain so there is no trust assumption

---

## Rate Precision Reference

| Value | Meaning |
|-------|---------|
| `1000000000000000000` (1e18) | 1:1 conversion (0% spread) |
| `1010000000000000000` (1.01e18) | 1% spread |
| `1020000000000000000` (1.02e18) | 2% spread |
| `1050000000000000000` (1.05e18) | 5% spread |
| `0` | Pair disabled (no quoting) |

USDC amounts use 6-decimal precision: `1000000` = 1.00 USDC.

Conversion: `fiatAmount = usdcAmount * conversionRate / 1e18`

Example: 100 USDC at 1.02 rate = `100_000000 * 1020000000000000000 / 1e18` = 102.00 fiat units.
