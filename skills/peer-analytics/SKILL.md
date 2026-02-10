---
name: peer-analytics
description: Analyze Peer (ZKP2P) protocol health — volume, liquidity, spreads, leaderboards, attribution, and market data via the Peerlytics SDK. Use when the user wants protocol metrics, period comparisons, maker/taker rankings, or market spread analysis.
---

# Peer Analytics Skill

## Overview

Query aggregated protocol analytics from the Peerlytics API. This skill covers protocol-level metrics — volume, liquidity, spreads, leaderboards, attribution, and market summaries. For entity-level lookups (individual deposits, intents, addresses), see the **`peer-explorer`** skill.

**SDK:** `@peerlytics/sdk` (Peerlytics class)

## Setup

```bash
npm install @peerlytics/sdk
```

### With API Key

```typescript
import { Peerlytics } from '@peerlytics/sdk';

const peerlytics = new Peerlytics({
  apiKey: process.env.PEERLYTICS_API_KEY,
});
```

### With x402 (No API Key Required)

```typescript
import { Peerlytics } from '@peerlytics/sdk';

const peerlytics = new Peerlytics({
  x402: {
    walletClient,  // viem WalletClient with USDC on Base
    chainId: 8453,
  },
});
```

Cost per query: ~$0.001-0.01 USDC depending on endpoint complexity.

## Core Analytics Endpoints

### Protocol Summary

Get a full snapshot of protocol health across multiple time ranges:

```typescript
const summary = await peerlytics.getSummary();

// summary.periods.mtd.metrics.volume     — month-to-date volume (USD)
// summary.periods.mtd.metrics.trades     — trade count
// summary.periods.mtd.metrics.successRate — fulfillment rate
// summary.liquidity.available            — total available USDC
// summary.liquidity.activeDeposits       — active deposit count
// summary.spreads.current_spread_bps     — current median spread in bps
// summary.changes.volume.mtd_vs_prior_month — volume change %
// summary.topCurrencies                  — top currencies by volume
```

### Period Analytics

Query metrics for a specific time range:

```typescript
// Ranges: 'mtd' | '3mtd' | 'ytd' | 'all'
const period = await peerlytics.getPeriod('3mtd');
```

### Chunked Time-Series Data

Get granular time-series breakdowns:

```typescript
// Chunks: 'daily' | 'hourly' | 'flows' | 'deposits'
const daily = await peerlytics.getChunk('mtd', 'daily');
const flows = await peerlytics.getChunk('ytd', 'flows');
```

### Leaderboards

Query maker and taker rankings:

```typescript
const leaderboard = await peerlytics.getLeaderboard({ limit: 20, offset: 0 });

// leaderboard.makers.byVolume     — top makers by total volume
// leaderboard.makers.byAPR        — top makers by annualized return
// leaderboard.makers.byProfit     — top makers by realized profit
// leaderboard.takers.byVolume     — top takers by total volume
// leaderboard.takers.byLockScore  — top takers by trust/tier score
// leaderboard.takers.byActivity   — most active takers
```

Each maker entry includes: `address`, `volumeUsd`, `activeDeposits`, `fulfilledIntents`, `successRatePct`, `realizedProfitUsd`, `aprPct`.

Each taker entry includes: `address`, `volumeUsd`, `signalCount`, `fulfillCount`, `pruneCount`, `successRatePct`, `trustScore`, `tier`, `tierCap`.

### Attribution

```typescript
const attribution = await peerlytics.getAttribution();
const depositAttribution = await peerlytics.getDepositAttribution();
```

## Market Data Endpoints

### Market Summary (Spreads by Platform/Currency)

```typescript
const market = await peerlytics.getMarketSummary({
  platform: ['venmo', 'wise', 'revolut'],
  currency: ['USD', 'EUR'],
  includeRates: true,
});

// market.markets -> MarketEntry[]
// Each entry: { platform, currency, sampleSize, totalLiquidity, p25, median, p75, p90, suggestedRate }
// With includeRates: rateEntries[] shows liquidity at each rate level
```

### Metadata

```typescript
const currencies = await peerlytics.getCurrencies();
// Returns available currencies with their hashes

const platforms = await peerlytics.getPlatforms();
// Returns available platforms with method hashes
```

## Common Analysis Patterns

### Protocol Health Check

```typescript
const summary = await peerlytics.getSummary();
const { periods, liquidity, spreads, changes } = summary;

console.log(`MTD volume: $${periods.mtd.metrics.volume}`);
console.log(`Active liquidity: $${liquidity.available} across ${liquidity.activeDeposits} deposits`);
console.log(`Current spread: ${spreads?.current_spread_bps ?? 'N/A'} bps`);
console.log(`Volume vs last month: ${changes.volume.mtd_vs_prior_month}%`);
```

### Compare Platforms by Spread

```typescript
const market = await peerlytics.getMarketSummary({
  platform: ['venmo', 'wise', 'revolut', 'cashapp', 'paypal', 'zelle'],
  currency: 'USD',
});

const sorted = market.markets
  .filter((m) => m.median !== null)
  .sort((a, b) => (a.median ?? 0) - (b.median ?? 0));

for (const m of sorted) {
  const spreadBps = ((m.median! - 1) * 10000).toFixed(0);
  console.log(`${m.platform}: ${spreadBps} bps median, $${m.totalLiquidity} liquidity`);
}
```

### Period-over-Period Comparison

```typescript
const mtd = await peerlytics.getPeriod('mtd');
const qtd = await peerlytics.getPeriod('3mtd');
const ytd = await peerlytics.getPeriod('ytd');

// Compare volume, trade count, user growth across periods
```

### Top Maker Analysis

```typescript
const { makers } = await peerlytics.getLeaderboard({ limit: 10 });

for (const maker of makers.byVolume) {
  console.log(
    `${maker.addressShort}: $${maker.volumeUsd} volume, ` +
    `${maker.successRatePct}% fill rate, ` +
    `${maker.aprPct?.toFixed(1) ?? 'N/A'}% APR`
  );
}
```

## Full API Reference

See `references/analytics-api.md` for complete response type definitions and all query parameters.

## Related Skills

- **`peer-explorer`** — Entity lookups: deposits, intents, addresses, makers, verifiers, search
- **`peer-market`** — Market intelligence with indexer GraphQL queries, orderbook, quote API
- **`check-fx-rates`** — Quick rate checks and spread comparisons (action skill)

## Environment

| | Value |
|--|-------|
| Peerlytics API | `https://peerlytics.xyz` |
| Auth | `X-API-Key` header or x402 micropayment |

```bash
export PEERLYTICS_API_KEY="..."   # Required (or use x402 instead)
```
