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
import { PeerlyticsClient } from '@peerlytics/sdk';

const client = new PeerlyticsClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://api.peerlytics.xyz'
});
```

### Access via x402 (No API Key Required)

The x402 model lets agents pay per request with USDC on Base -- no registration, no API key provisioning.

```typescript
import { PeerlyticsClient } from '@peerlytics/sdk';

const client = new PeerlyticsClient({
  x402: {
    walletClient,  // viem WalletClient with USDC on Base
    chainId: 8453
  },
  baseUrl: 'https://api.peerlytics.xyz'
});
```

Cost per query: ~$0.001-0.01 USDC depending on endpoint complexity.

## Market Spreads

Query current conversion rate spreads by payment platform and currency:

```typescript
const spreads = await client.getSpreads({
  paymentPlatforms: ['venmo', 'wise', 'revolut'],
  fiatCurrencies: ['USD', 'EUR'],
});

// spreads.venmo.USD -> { min: 1.005, max: 1.035, median: 1.018, count: 42 }
// spreads.wise.EUR -> { min: 1.002, max: 1.028, median: 1.012, count: 67 }
```

Spread values are conversion rates in 18-decimal precision. A rate of `1.02` means $1.02 fiat per $1.00 USDC -- the 2% is the LP's spread.

## Volume Trends

Query historical volume by platform, currency, and time period:

```typescript
const volume = await client.getVolume({
  paymentPlatforms: ['venmo'],
  fiatCurrency: 'USD',
  period: '7d',            // '1d', '7d', '30d', '90d'
  granularity: 'daily'     // 'hourly', 'daily', 'weekly'
});

// volume.dataPoints -> [{ date: '2026-02-03', volumeUsdc: '125430.00', txCount: 87 }, ...]
// volume.totalUsdc  -> '892100.00'
// volume.totalTxns  -> 612
```

## LP Rankings

Query maker leaderboard with fill rates and volume:

```typescript
const leaderboard = await client.getMakerLeaderboard({
  period: '30d',
  limit: 20,
  sortBy: 'volume'     // 'volume', 'fillRate', 'txCount'
});

// leaderboard[0] -> {
//   address: '0xabc...',
//   volumeUsdc: '450000.00',
//   fillRate: 0.97,
//   avgSpreadBps: 180,
//   activeDeposits: 3,
//   platforms: ['venmo', 'wise'],
//   currencies: ['USD', 'EUR']
// }
```

## Orderbook

Live liquidity is available at `orderbook.peerlytics.xyz` (web UI) and via the API:

```typescript
const orderbook = await client.getOrderbook({
  paymentPlatform: 'venmo',
  fiatCurrency: 'USD',
  limit: 50
});

// orderbook.bids -> [{
//   depositId: '123',
//   availableUsdc: '5000.00',
//   conversionRate: '1.018000000000000000',
//   spreadBps: 180,
//   maker: '0xabc...',
//   paymentMethods: ['venmo'],
//   intentRange: { min: '10.00', max: '1000.00' }
// }, ...]
```

## Indexer Queries

The ZKP2P indexer exposes on-chain state via GraphQL.

**Staging endpoint:** `https://indexer.hyperindex.xyz/00be13d/v1/graphql`

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

Get the best available rate for a given amount and platform combination. Uses the offramp-sdk:

```typescript
import { OfframpClient } from '@zkp2p/offramp-sdk';

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
| Authentication | Payment proof in request header | `x-api-key` header |
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
const spreads = await client.getSpreads({
  paymentPlatforms: ['venmo', 'cashapp', 'wise', 'revolut', 'paypal', 'zelle'],
  fiatCurrencies: ['USD'],
});

// Find the platform with the tightest spread (lowest cost for buyers)
const tightest = Object.entries(spreads)
  .map(([platform, currencies]) => ({
    platform,
    medianSpread: currencies.USD.median
  }))
  .sort((a, b) => a.medianSpread - b.medianSpread);
```

### Volume Velocity Detection

```typescript
// Detect volume acceleration (compare last 24h to prior 7d average)
const recent = await client.getVolume({ period: '1d' });
const baseline = await client.getVolume({ period: '7d' });

const dailyAvg = parseFloat(baseline.totalUsdc) / 7;
const velocity = parseFloat(recent.totalUsdc) / dailyAvg;

// velocity > 1.5 = significant increase
// velocity < 0.5 = significant decrease
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
