---
name: analyze-peer-protocol
description: Analyze Peer protocol health and performance — volume trends, liquidity depth, spreads, maker/taker leaderboards, and market data. Use when the agent wants to understand protocol metrics, compare periods, rank participants, or assess market conditions.
---

# Analyze Peer Protocol

How is the Peer protocol performing? What are the trends?

## The Problem

Before deploying capital, adjusting rates, or choosing a payment platform, agents need protocol-level intelligence: How much volume is flowing? Are spreads tightening or widening? Who are the top LPs? What currencies are growing? Without analytics, agents operate blind.

## What You Can Analyze

- **Protocol summary** — volume, trades, liquidity, spreads, and period-over-period changes in a single call
- **Period comparison** — compare month-to-date, quarter-to-date, and year-to-date metrics
- **Time-series data** — daily/hourly volume, flow breakdowns, deposit trends
- **Leaderboards** — top makers by volume/APR/profit, top takers by volume/lock score/activity
- **Market spreads** — median spreads and liquidity by platform and currency pair
- **Attribution** — volume and deposit attribution data
- **Currencies and platforms** — available payment methods and supported currencies

## Quick Protocol Health Check

```typescript
import { Peerlytics } from '@peerlytics/sdk';

const peerlytics = new Peerlytics({
  apiKey: process.env.PEERLYTICS_API_KEY,
});

const summary = await peerlytics.getSummary();

console.log(`MTD volume: $${summary.periods.mtd.metrics.volume}`);
console.log(`Success rate: ${summary.periods.mtd.metrics.successRate}%`);
console.log(`Active liquidity: $${summary.liquidity.available}`);
console.log(`Current spread: ${summary.spreads?.current_spread_bps} bps`);
console.log(`Volume change vs last month: ${summary.changes.volume.mtd_vs_prior_month}%`);
```

## Example Analyses

### Who are the top LPs right now?

```typescript
const { makers } = await peerlytics.getLeaderboard({ limit: 10 });

for (const maker of makers.byVolume) {
  console.log(`${maker.addressShort}: $${maker.volumeUsd} vol, ${maker.aprPct?.toFixed(1)}% APR`);
}
```

### Which platform has the tightest spreads for USD?

```typescript
const market = await peerlytics.getMarketSummary({
  platform: ['venmo', 'wise', 'revolut', 'cashapp', 'paypal'],
  currency: 'USD',
});

const best = market.markets
  .filter((m) => m.median !== null)
  .sort((a, b) => (a.median ?? 0) - (b.median ?? 0))[0];

console.log(`Cheapest: ${best.platform} at ${((best.median! - 1) * 10000).toFixed(0)} bps`);
```

### Is volume growing or shrinking?

```typescript
const summary = await peerlytics.getSummary();
const { volume } = summary.changes;

if (volume.mtd_vs_prior_month !== null && volume.mtd_vs_prior_month > 0) {
  console.log(`Volume up ${volume.mtd_vs_prior_month}% vs last month`);
} else {
  console.log(`Volume down ${volume.mtd_vs_prior_month}% vs last month`);
}
```

## Data Access

| Method | Setup | Cost |
|--------|-------|------|
| API Key | Register at peerlytics.xyz | Tiered subscription |
| x402 | No registration — pay with USDC on Base | ~$0.001-0.01 per request |

## Full Implementation Details

See the **`peer-analytics`** skill for all SDK methods, response types, chunked time-series queries, and attribution endpoints.

For entity-level lookups (individual deposits, intents, addresses), see the **`peer-explorer`** skill.

For live rates and quote comparisons, see the **`check-fx-rates`** skill.

## Environment Variables

```bash
export PEERLYTICS_API_KEY="..."   # Required (or use x402 instead)
```
