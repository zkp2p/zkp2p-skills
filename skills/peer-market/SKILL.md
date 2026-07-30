---
name: peer-market
description: Query ZKP2P market intelligence — spreads, volume, liquidity, LP performance, and orderbook data via Peerlytics API and protocol indexer. Use when the user wants market data, spread analysis, volume trends, LP rankings, or protocol analytics from ZKP2P.
---

# ZKP2P Market Intelligence Skill

## Overview

Two complementary data sources provide full market intelligence for ZKP2P:

| Source | What It Provides | Access |
|--------|-----------------|--------|
| **Peerlytics** | Aggregated analytics: spreads, volume trends, LP rankings, orderbook | x402 (USDC micropayment) or API key |
| **ZKP2P Indexer** | Raw on-chain state: deposits, intents, vault performance, rates | Open GraphQL endpoint |

Use Peerlytics for market-level insights (what spreads look like, who the top LPs are, where volume is flowing). Use the indexer for granular on-chain state (individual deposit configurations, intent histories, vault delegation details).

## Peerlytics Setup

Install the SDK:

```bash
npm install @peerlytics/sdk
```

### Access via API Key

```typescript
import { Peerlytics } from '@peerlytics/sdk';

const client = new Peerlytics({
  apiKey: 'YOUR_API_KEY',
  // baseUrl defaults to 'https://peerlytics.xyz'
});
```

### Access via x402 (No API Key Required)

The x402 model lets agents pay per request with USDC on Base -- no registration, no API key provisioning.

1. Agent makes API request without authentication
2. Server responds with HTTP 402 + payment requirements (USDC amount, Base recipient address)
3. Agent sends USDC microtransaction on Base
4. Agent retries request with `X-Payment-Proof` header containing the tx hash
5. Server validates the on-chain payment and returns data

Cost per query: ~$0.001-0.01 USDC depending on endpoint complexity.

## Market Summary (Spreads)

Query current market spread data by platform and currency:

```typescript
const market = await client.getMarketSummary({
  platform: ['venmo', 'wise', 'revolut'],
  currency: ['USD', 'EUR'],
});

// market.markets -> MarketEntry[] with spread percentiles per platform/currency
// market.markets[0] -> {
//   platform: 'venmo', currency: 'USD',
//   sampleSize: 42, totalLiquidity: 125000,
//   p25: 1.005, median: 1.018, p75: 1.025, p90: 1.035,
//   suggestedRate: 1.015
// }
```

A rate of `1.02` means $1.02 fiat per $1.00 USDC -- the 2% is the LP's spread.

## Analytics Period (Volume Trends)

Query volume and metrics for a time range:

```typescript
const period = await client.getPeriod('mtd'); // 'mtd' | '3mtd' | 'ytd' | 'all'

// period.meta -> { cached_at, cache_duration_seconds, source, range: 'mtd' }
```

For time-series breakdowns (daily, hourly, flows, deposits):

```typescript
const daily = await client.getChunk('mtd', 'daily');
// daily.data -> time-series array
// daily.range -> 'mtd'
// daily.chunk -> 'daily'
```

## LP Rankings (Leaderboard)

Query maker and taker leaderboards:

```typescript
const leaderboard = await client.getLeaderboard({ limit: 20 });

// Makers ranked by volume, APR, and profit
// leaderboard.makers.byVolume[0] -> {
//   rank: 1, address: '0xabc...', addressShort: '0xabc...def',
//   volumeUsd: 450000, grossDepositedUsd: 500000,
//   activeDeposits: 3, fulfilledIntents: 120,
//   successRatePct: 97, realizedProfitUsd: 4500,
//   realizedPnlPct: 0.9, aprPct: 12.5
// }
// leaderboard.makers.byAPR -> sorted by APR
// leaderboard.makers.byProfit -> sorted by realized profit

// Takers ranked by volume, lock score, and activity
// leaderboard.takers.byVolume[0] -> {
//   rank: 1, address: '0xdef...', volumeUsd: 25000,
//   signalCount: 30, fulfillCount: 28, pruneCount: 2,
//   successRatePct: 93, trustScore: 850, tier: 'gold', tierCap: 5000
// }
```

## Orderbook

Live liquidity is available at `orderbook.peerlytics.xyz` (web UI) and via the API. The orderbook is **rate-level aggregated** (not individual deposits):

```typescript
const orderbook = await client.getOrderbook({
  currency: 'USD',
  platform: 'venmo',
  minSize: 100,
});

// orderbook.stats -> { totalLiquidityUsd, activeMakers, volume24hUsd, activeIntents }
// orderbook.orderbooks -> OrderbookCurrency[] (one per currency)
// orderbook.orderbooks[0] -> {
//   currency: 'USD',
//   bestRate: 1.005,
//   fxMidRate: 1.0,
//   totalLiquidityUsd: 125000,
//   levels: [{
//     rate: 1.005, totalLiquidityUsd: 50000, depositCount: 8,
//     platforms: ['venmo', 'wise'],
//     topDeposit: { depositor: '0xabc...', depositId: '42' }
//   }, ...]
// }
// orderbook.activity -> recent signals, fulfills, prunes
// orderbook.filters -> applied and available filter options
```

## Indexer Queries

The ZKP2P indexer exposes on-chain state via GraphQL.

- **Production endpoint:** `https://indexer.zkp2p.xyz/v1/graphql`
- **Staging endpoint:** `https://indexer-staging.zkp2p.xyz/v1/graphql`

### Active Deposits with Rates

```graphql
query ActiveDeposits {
  Deposit(
    where: { acceptingIntents: { _eq: true }, availableBalance_gt: "0" }
    order_by: { availableBalance: desc }
    limit: 50
  ) {
    id
    depositor
    token
    depositAmount
    availableBalance
    acceptingIntents
    retainOnEmpty
    intentAmountMin
    intentAmountMax
    rateManagerId
    methodCurrencies {
      paymentMethod
      currencyCode
      conversionRate
      managerRate
      isActive
    }
  }
}
```

### Intent History and Fulfillment Stats

```graphql
query IntentHistory($depositor: String!) {
  Intent(
    where: { deposit: { depositor: { _eq: $depositor } } }
    order_by: { createdAt: desc }
    limit: 100
  ) {
    id
    intentHash
    amount
    status
    paymentMethod
    fiatCurrency
    conversionRate
    createdAt
    fulfilledAt
    managerFee
    managerFeeAmount
    rateManagerId
  }
}
```

### Vault Performance

```graphql
query VaultPerformance($rateManagerId: String!) {
  ManagerAggregateStats(where: { rateManagerId: { _eq: $rateManagerId } }) {
    totalFilledVolume
    totalFeeAmount
    totalPnlUsdCents
    fulfilledIntents
    currentDelegatedBalance
    currentDelegatedDeposits
    updatedAt
  }
  ManagerStats(
    where: { rateManagerId: { _eq: $rateManagerId } }
    order_by: { createdAt: desc }
    limit: 20
  ) {
    intentId
    amount
    spreadBps
    pnlUsdCents
    managerFee
    managerFeeAmount
    quoteConversionRate
    marketRate
    createdAt
  }
}
```

## Quote API

Get the best available rate for a given amount and platform combination. Uses `@zkp2p/sdk`:

```typescript
import { OfframpClient } from '@zkp2p/sdk';

const client = new OfframpClient({ walletClient, chainId: 8453, runtimeEnv: 'production', apiKey: 'KEY' });

const quote = await client.getQuote({
  paymentPlatforms: ['venmo', 'wise'],
  fiatCurrency: 'USD',
  amount: '100',
  user: AGENT_WALLET,
  recipient: AGENT_WALLET,
  destinationChainId: 8453,
  destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  includeNearbyQuotes: true,
  nearbyQuotesCount: 5,
});

// quote.bestQuote -> { depositId, conversionRate, availableAmount, paymentPlatform, ... }
// quote.nearbyQuotes -> [{ ... }, ...] -- alternative rates within range
```

### Quote Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `paymentPlatforms` | string[] | Yes | Platforms to consider (e.g., `['venmo', 'wise']`) |
| `fiatCurrency` | string | Yes | Fiat currency code (e.g., `'USD'`) |
| `amount` | string | Yes | USDC amount to quote |
| `user` | string | Yes | Requester's wallet address |
| `recipient` | string | Yes | Token recipient address |
| `destinationChainId` | number | Yes | Target chain (8453 = Base) |
| `destinationToken` | string | Yes | Token address (USDC on Base) |
| `isExactFiat` | boolean | No | If true, `amount` is in fiat units instead of USDC |
| `includeNearbyQuotes` | boolean | No | Include alternative rates near the best |
| `nearbyQuotesCount` | number | No | Number of nearby quotes (1-10, default 3) |
| `nearbySearchRange` | number | No | Max percentage deviation for nearby quotes |

## Access Patterns

### x402 vs API Key

| Feature | x402 | API Key |
|---------|------|---------|
| Setup | None -- pay with USDC on Base | Register at peerlytics.xyz |
| Authentication | Payment proof in request header | `X-API-Key` header |
| Cost | Per-request (~$0.001-0.01 USDC) | Tiered subscription |
| Rate Limits | Based on payment | Based on tier |
| Best For | Agents, bots, permissionless access | Applications with predictable usage |

### x402 Flow

1. Agent makes API request without authentication
2. Server responds with HTTP 402 + payment requirements (USDC amount, Base recipient address)
3. Agent sends USDC microtransaction on Base
4. Agent retries request with `X-Payment-Proof` header containing the tx hash
5. Server validates the on-chain payment and returns data

## Common Analysis Patterns

### Spread Comparison Across Platforms

```typescript
// Compare spreads across all platforms for USD
const market = await client.getMarketSummary({ currency: 'USD' });

// Find the platform with the tightest spread (lowest cost for buyers)
const tightest = market.markets
  .filter(m => m.median !== null)
  .sort((a, b) => (a.median ?? Infinity) - (b.median ?? Infinity));

// tightest[0] -> { platform: 'wise', currency: 'USD', median: 1.005, totalLiquidity: 80000 }
```

### Volume Period Comparison

```typescript
// Compare MTD vs YTD summary metrics
const summary = await client.getSummary();

const mtdVolume = summary.periods.mtd.metrics.volume;
const ytdVolume = summary.periods.ytd.metrics.volume;
const volumeChange = summary.changes.volume.mtd_vs_prior_month;
// volumeChange > 0 = growing, < 0 = declining
```

### Liquidity Depth by Rate Tier

```graphql
# Find how much USDC is available at different rate tiers for Venmo/USD
query LiquidityByRate {
  tight: Deposit_aggregate(
    where: {
      acceptingIntents: { _eq: true },
      methodCurrencies: {
        paymentMethod: { _eq: "venmo" },
        currencyCode: { _eq: "USD" },
        conversionRate_lte: "1015000000000000000"
      }
    }
  ) { aggregate { sum { availableBalance } count } }

  mid: Deposit_aggregate(
    where: {
      acceptingIntents: { _eq: true },
      methodCurrencies: {
        paymentMethod: { _eq: "venmo" },
        currencyCode: { _eq: "USD" },
        conversionRate_gt: "1015000000000000000",
        conversionRate_lte: "1030000000000000000"
      }
    }
  ) { aggregate { sum { availableBalance } count } }

  wide: Deposit_aggregate(
    where: {
      acceptingIntents: { _eq: true },
      methodCurrencies: {
        paymentMethod: { _eq: "venmo" },
        currencyCode: { _eq: "USD" },
        conversionRate_gt: "1030000000000000000"
      }
    }
  ) { aggregate { sum { availableBalance } count } }
}
```

### Vault Benchmarking

```graphql
# Compare vault performance metrics across all vaults
query VaultBenchmark {
  ManagerAggregateStats(
    order_by: { totalFilledVolume: desc }
    limit: 10
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

## Environment

| | Production | Staging |
|--|-----------|---------|
| Chain | Base (8453) | Base Sepolia (84532) |
| Peerlytics API | `https://peerlytics.xyz` | - |
| Core API | `https://api.zkp2p.xyz` | `https://api-staging.zkp2p.xyz` |
| Indexer | `https://indexer.zkp2p.xyz/v1/graphql` | `https://indexer-staging.zkp2p.xyz/v1/graphql` |
