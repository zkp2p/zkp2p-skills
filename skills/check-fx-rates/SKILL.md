---
name: check-fx-rates
description: Check fiat-to-USDC exchange rates, spreads, and liquidity across payment platforms. Query live orderbook, compare rates across Venmo/Wise/Revolut/PayPal, and find the cheapest way to move between fiat and crypto. Use when the agent needs exchange rates, wants to compare payment options, or needs market data before a transaction.
---

# Check FX Rates

What is the best rate to exchange between fiat and USDC right now?

## The Problem

Before buying USDC or paying a human in fiat, the agent needs to know the best available rate. Rates vary by payment platform (Venmo vs Wise vs Revolut), by currency (USD vs EUR vs GBP), and by available liquidity at each price tier. Blindly picking a platform can cost 2-3x more in spread than checking first.

## What You Can Query

- **Best available rate** for any (platform, currency, amount) combination
- **Spread comparison** across all platforms for a given currency
- **Liquidity depth** -- how much USDC is available at each rate tier
- **Volume trends** -- daily, weekly, monthly transaction flow
- **LP rankings** -- top makers by fill rate, volume, and spread

## Quick Rate Check

Get the best rate for 100 USDC via Venmo or Wise:

```typescript
import { OfframpClient } from '@zkp2p/sdk';

const client = new OfframpClient({
  walletClient,
  chainId: 8453,
  runtimeEnv: 'production',
  apiKey: process.env.ZKP2P_API_KEY,
});

const quote = await client.getQuote({
  paymentPlatforms: ['venmo', 'wise'],
  fiatCurrency: 'USD',
  amount: '100000000',  // 100 USDC (6 decimals)
  user: AGENT_WALLET,
  recipient: AGENT_WALLET,
  destinationChainId: 8453,
  destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  includeNearbyQuotes: true,
  nearbyQuotesCount: 5,
});

// quote.bestQuote -> { depositId, conversionRate, availableAmount, paymentPlatform }
// quote.nearbyQuotes -> alternative rates within range
```

## Data Sources

| Source | Access | Best For |
|--------|--------|---------|
| Quote API (`@zkp2p/sdk`) | API key | Best rate for a specific amount |
| Peerlytics (`@peerlytics/sdk`) | API key or x402 (USDC micropayment) | Spreads, volume, LP rankings |
| ZKP2P Indexer | Open GraphQL | Raw on-chain state, deposit details |

## Example Output

A multi-platform rate comparison for USD to USDC:

```
USD -> USDC rates (best available):
  Venmo:    1.018 (1.8% spread) -- $12,400 available
  Wise:     1.012 (1.2% spread) -- $45,200 available  <- cheapest
  Revolut:  1.022 (2.2% spread) -- $8,100 available
  CashApp:  1.035 (3.5% spread) -- $3,200 available
```

The conversion rate is how much fiat per 1 USDC. A rate of `1.012` means $1.012 fiat buys $1.00 USDC -- the 1.2% above parity is the LP's spread. Lower is cheaper for the buyer.

## Spread Comparison (Peerlytics)

```typescript
import { Peerlytics } from '@peerlytics/sdk';

const client = new Peerlytics({
  apiKey: process.env.PEERLYTICS_API_KEY,
});

const market = await client.getMarketSummary({
  platform: ['venmo', 'cashapp', 'wise', 'revolut', 'paypal'],
  currency: ['USD'],
});

// market.markets[0] -> {
//   platform: 'wise', currency: 'USD',
//   sampleSize: 67, totalLiquidity: 80000,
//   p25: 1.005, median: 1.012, p75: 1.020, p90: 1.028,
//   suggestedRate: 1.010
// }
```

## Full Implementation Details

See the **`peer-market`** skill for Peerlytics SDK setup (including x402 keyless access), indexer GraphQL queries, volume analysis, LP benchmarking, and liquidity depth queries by rate tier.

## Environment Variables

```bash
export ZKP2P_API_KEY="..."        # Required -- for quote API (@zkp2p/sdk)
export PEERLYTICS_API_KEY="..."   # Optional -- for analytics (or use x402 instead)
```
