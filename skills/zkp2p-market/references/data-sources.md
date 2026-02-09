# ZKP2P Market Data Sources Reference

## Peerlytics API Endpoints

Base URL: `https://api.peerlytics.xyz`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/spreads` | Current conversion rate spreads by platform and currency |
| GET | `/v1/volume` | Historical volume with time granularity |
| GET | `/v1/leaderboard/makers` | LP leaderboard by volume, fill rate |
| GET | `/v1/leaderboard/takers` | Taker leaderboard by volume |
| GET | `/v1/orderbook` | Live orderbook (available deposits with rates) |
| GET | `/v1/entity/address/{address}` | Address lookup: deposits, intents, stats |
| GET | `/v1/entity/intent/{intentHash}` | Intent lookup: details, fulfillment status |
| GET | `/v1/entity/deposit/{depositId}` | Deposit lookup: config, balance, history |
| GET | `/v1/entity/tx/{txHash}` | Transaction lookup with USD context |
| GET | `/v1/protocol/stats` | Aggregate protocol metrics |
| GET | `/v1/protocol/events` | Live contract event stream |

### Authentication Headers

| Header | Method | Value |
|--------|--------|-------|
| `x-api-key` | API Key | Your API key string |
| `X-Payment-Proof` | x402 | Transaction hash of USDC payment on Base |

---

### Response Schemas

#### GET /v1/spreads

Query params: `paymentPlatforms` (comma-separated), `fiatCurrencies` (comma-separated)

```typescript
interface SpreadsResponse {
  [platform: string]: {
    [currency: string]: {
      min: number;          // Lowest conversion rate (tightest spread)
      max: number;          // Highest conversion rate (widest spread)
      median: number;       // Median rate across active deposits
      mean: number;         // Mean rate
      stddev: number;       // Standard deviation
      count: number;        // Number of active deposits at this pair
      totalLiquidity: string; // Sum of available USDC at this pair
    }
  }
}
```

#### GET /v1/volume

Query params: `paymentPlatforms`, `fiatCurrency`, `period` (`1d`|`7d`|`30d`|`90d`), `granularity` (`hourly`|`daily`|`weekly`)

```typescript
interface VolumeResponse {
  totalUsdc: string;         // Total USDC volume in period
  totalTxns: number;         // Total transaction count
  dataPoints: Array<{
    date: string;            // ISO 8601 date or hour
    volumeUsdc: string;      // Volume for this interval
    txCount: number;         // Transaction count for this interval
    avgSpreadBps: number;    // Average spread in basis points
  }>;
  platforms: {
    [platform: string]: {
      volumeUsdc: string;
      txCount: number;
      percentage: number;    // Share of total volume
    }
  };
}
```

#### GET /v1/leaderboard/makers

Query params: `period` (`7d`|`30d`|`90d`|`all`), `limit` (1-100), `sortBy` (`volume`|`fillRate`|`txCount`)

```typescript
interface MakerLeaderboardResponse {
  makers: Array<{
    rank: number;
    address: string;
    volumeUsdc: string;        // Total USDC filled
    fillRate: number;          // Ratio of fulfilled vs expired intents (0-1)
    avgSpreadBps: number;      // Average spread in basis points
    activeDeposits: number;    // Current number of active deposits
    platforms: string[];       // Payment platforms used
    currencies: string[];      // Fiat currencies supported
    avgFillTimeSeconds: number; // Average time to fulfill an intent
  }>;
  totalMakers: number;
  period: string;
}
```

#### GET /v1/orderbook

Query params: `paymentPlatform`, `fiatCurrency`, `limit` (1-100), `minAmount`, `maxAmount`

```typescript
interface OrderbookResponse {
  bids: Array<{
    depositId: string;
    maker: string;
    availableUsdc: string;
    conversionRate: string;      // 18-decimal precision
    effectiveConversionRate: string; // Fee-adjusted rate (if vault-managed)
    spreadBps: number;
    paymentMethods: string[];
    fiatCurrencies: string[];
    intentRange: {
      min: string;
      max: string;
    };
    rateManagerId: string | null; // Vault ID if delegated
    managerFee: string | null;    // Vault fee if delegated
  }>;
  lastUpdated: string;           // ISO 8601
  totalLiquidity: string;        // Sum of all available USDC
  depositCount: number;
}
```

#### GET /v1/protocol/stats

No query params required.

```typescript
interface ProtocolStatsResponse {
  totalVolumeUsdc: string;        // All-time volume
  totalTransactions: number;       // All-time fulfilled intents
  activeMakers: number;            // Unique addresses with active deposits
  activeTakers: number;            // Unique addresses with recent intents (30d)
  totalLiquidityUsdc: string;      // Current available USDC across all deposits
  activeDeposits: number;          // Deposits currently accepting intents
  volume24h: string;               // Last 24 hours
  volume7d: string;                // Last 7 days
  volume30d: string;               // Last 30 days
  platformBreakdown: {
    [platform: string]: {
      volumeUsdc: string;
      percentage: number;
    }
  };
  currencyBreakdown: {
    [currency: string]: {
      volumeUsdc: string;
      percentage: number;
    }
  };
}
```

#### GET /v1/entity/address/{address}

```typescript
interface AddressEntityResponse {
  address: string;
  isMaker: boolean;
  isTaker: boolean;
  makerStats: {
    totalVolumeUsdc: string;
    activeDeposits: number;
    totalDeposits: number;
    fulfilledIntents: number;
    avgFillRate: number;
    avgSpreadBps: number;
    platforms: string[];
    currencies: string[];
  } | null;
  takerStats: {
    totalVolumeUsdc: string;
    totalIntents: number;
    fulfilledIntents: number;
    cancelledIntents: number;
    expiredIntents: number;
  } | null;
  recentActivity: Array<{
    type: 'deposit' | 'intent' | 'fulfillment';
    timestamp: string;
    details: Record<string, unknown>;
  }>;
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
  |-- GET /v1/spreads ------------->|                                |
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
  |-- GET /v1/spreads ------------->|                                |
  |    X-Payment-Proof: 0xtxhash   |                                |
  |                                 |-- validate tx on-chain ------>|
  |                                 |<-- confirmed -----------------|
  |                                 |                                |
  |<-- 200 OK + spreads data ------|                                |
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
