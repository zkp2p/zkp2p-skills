---
name: zkp2p-rate-optimizer
description: Optimize ZKP2P vault and LP deposit rates using market intelligence and PnL feedback. Analyzes spreads, volume, and performance data to recommend or execute rate adjustments. Use when the user wants to optimize rates, improve LP returns, or automate rate management strategy.
---

# ZKP2P Rate Optimizer

Closed-loop rate optimization for ZKP2P vaults and LP deposits. Uses Peerlytics market intelligence to inform rate decisions, executes adjustments on-chain, and monitors PnL outcomes via the indexer.

## Overview

The optimization loop has three stages:

```
1. DATA COLLECTION
   Peerlytics API → market spreads, competitor rates, volume by pair
   Indexer GraphQL → ManagerAggregateStats (vault PnL), ManagerStats (per-intent)

2. RATE COMPUTATION
   For each (paymentMethod, currency) pair:
     analyze PnL, volume, market share, competitor spread
     compute target rate using algorithm below

3. EXECUTION
   setMinRate() or setMinRatesBatch() on DepositRateManagerRegistryV1
   Monitor outcomes in next iteration
```

## Data Collection

Before adjusting rates, gather these data points:

### Market Data (Peerlytics)

Query the Peerlytics orderbook for current market state:

```typescript
// Install: npm install @peerlytics/sdk
// Access: API key or x402 pay-per-request (USDC on Base)

// Orderbook data available at: orderbook.peerlytics.xyz
// Key metrics to collect:
// - Best available rates per (platform, currency) pair
// - Total liquidity depth per pair
// - 24h/7d volume per pair
// - Number of active LPs per pair
// - Spread distribution (min, median, max rates)
```

### Vault Performance (Indexer)

Query the staging indexer at `https://indexer.hyperindex.xyz/00be13d/v1/graphql`:

```graphql
# Vault aggregate stats — overall PnL and volume
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
}
```

```graphql
# Per-intent stats — granular performance data
query IntentPerformance($rateManagerId: String!, $since: BigInt!) {
  ManagerStats(
    where: {
      rateManagerId: { _eq: $rateManagerId }
      createdAt: { _gte: $since }
    }
    order_by: { createdAt: desc }
  ) {
    intentId
    depositId
    amount
    quoteConversionRate
    marketRate
    spreadBps
    pnlUsdCents
    managerFee
    managerFeeAmount
    createdAt
  }
}
```

```graphql
# Current vault rates
query VaultRates($rateManagerId: String!) {
  RateManagerRate(where: { rateManagerId: { _eq: $rateManagerId } }) {
    paymentMethodHash
    currencyCode
    managerRate
    updatedAt
  }
}
```

### Competitor Rates (Indexer)

```graphql
# All active deposits with their rates (competitor analysis)
query CompetitorRates($paymentMethodHash: String!, $currencyCode: String!) {
  MethodCurrency(
    where: {
      paymentMethodHash: { _eq: $paymentMethodHash }
      currencyCode: { _eq: $currencyCode }
      conversionRate: { _gt: "0" }
    }
    order_by: { conversionRate: asc }
  ) {
    depositId
    conversionRate
    managerRate
    rateManagerId
  }
}
```

## Optimization Algorithm

### Core Logic (Pseudocode)

```
For each (payment_method, currency) pair managed by this vault:

  1. Compute current metrics:
     - current_rate = vault's managerRate for this pair
     - pnl_7d = sum of pnlUsdCents for intents in last 7 days
     - volume_7d = sum of amounts for intents in last 7 days
     - fill_count_7d = count of fulfilled intents in last 7 days
     - market_best_rate = lowest competitor rate for this pair
     - market_median_rate = median competitor rate for this pair

  2. Apply rules:
     IF pnl_7d < 0:
       → WIDEN spread by 20 bps (increase rate by 0.002 * 1e18)
       → Rationale: losing money, need better margin

     ELSE IF fill_count_7d == 0 AND current_rate > 0:
       IF days_since_last_fill > 7:
         → DISABLE pair (set rate to 0)
         → Rationale: no demand, stop quoting
       ELSE:
         → TIGHTEN spread by 15 bps (decrease rate by 0.0015 * 1e18)
         → Rationale: may be priced too high

     ELSE IF volume_7d > 0 AND current_rate > market_median_rate * 1.05:
       → TIGHTEN spread by 10 bps
       → Rationale: overpriced vs market, can capture more volume

     ELSE IF volume_7d > 0 AND current_rate < market_best_rate:
       → WIDEN spread by 5 bps
       → Rationale: underpriced, leaving money on the table

     ELSE:
       → HOLD steady
       → Rationale: performing within acceptable range

  3. Apply safety constraints:
     - new_rate >= MINIMUM_SPREAD_FLOOR (default: 1.001 * 1e18 = 10 bps)
     - new_rate <= MAXIMUM_SPREAD_CAP (default: 1.10 * 1e18 = 10%)
     - abs(new_rate - current_rate) <= MAX_CHANGE_PER_ITERATION (default: 50 bps)
     - If change > 30 bps, log WARNING for review
```

### TypeScript Implementation

```typescript
import { createWalletClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// --- Constants ---
const PRECISE_UNIT = 1_000_000_000_000_000_000n; // 1e18
const BPS_UNIT = PRECISE_UNIT / 10_000n;         // 1 bps in 1e18
const MIN_SPREAD_FLOOR = PRECISE_UNIT + (10n * BPS_UNIT);   // 1.001 (10 bps)
const MAX_SPREAD_CAP = PRECISE_UNIT + (1000n * BPS_UNIT);   // 1.10  (10%)
const MAX_CHANGE_PER_ITER = 50n * BPS_UNIT;                 // 50 bps

const REGISTRY_ADDRESS = '0x3125F621482887d158cb51cE9b54D9D25b145877';
const INDEXER_URL = 'https://indexer.hyperindex.xyz/00be13d/v1/graphql';

// --- Types ---
interface PairMetrics {
  paymentMethodHash: string;
  currencyCode: string;
  currentRate: bigint;
  pnl7d: bigint;
  volume7d: bigint;
  fillCount7d: number;
  daysSinceLastFill: number;
  marketBestRate: bigint;
  marketMedianRate: bigint;
}

interface RateAdjustment {
  paymentMethodHash: string;
  currencyCode: string;
  currentRate: bigint;
  newRate: bigint;
  changeBps: number;
  reason: string;
}

// --- Algorithm ---
function computeAdjustment(metrics: PairMetrics): RateAdjustment {
  let newRate = metrics.currentRate;
  let reason = 'HOLD — performing within acceptable range';

  if (metrics.pnl7d < 0n) {
    // Losing money — widen spread
    newRate = metrics.currentRate + (20n * BPS_UNIT);
    reason = `WIDEN +20bps — negative PnL (${metrics.pnl7d} cents)`;

  } else if (metrics.fillCount7d === 0 && metrics.currentRate > 0n) {
    if (metrics.daysSinceLastFill > 7) {
      newRate = 0n;
      reason = 'DISABLE — zero fills for 7+ days';
    } else {
      newRate = metrics.currentRate - (15n * BPS_UNIT);
      reason = 'TIGHTEN -15bps — no recent fills, may be overpriced';
    }

  } else if (
    metrics.volume7d > 0n &&
    metrics.currentRate > (metrics.marketMedianRate * 105n / 100n)
  ) {
    newRate = metrics.currentRate - (10n * BPS_UNIT);
    reason = 'TIGHTEN -10bps — overpriced vs market median';

  } else if (
    metrics.volume7d > 0n &&
    metrics.currentRate < metrics.marketBestRate
  ) {
    newRate = metrics.currentRate + (5n * BPS_UNIT);
    reason = 'WIDEN +5bps — underpriced vs market best';
  }

  // Apply safety constraints
  if (newRate !== 0n) {
    if (newRate < MIN_SPREAD_FLOOR) newRate = MIN_SPREAD_FLOOR;
    if (newRate > MAX_SPREAD_CAP) newRate = MAX_SPREAD_CAP;

    const delta = newRate > metrics.currentRate
      ? newRate - metrics.currentRate
      : metrics.currentRate - newRate;
    if (delta > MAX_CHANGE_PER_ITER) {
      newRate = newRate > metrics.currentRate
        ? metrics.currentRate + MAX_CHANGE_PER_ITER
        : metrics.currentRate - MAX_CHANGE_PER_ITER;
      reason += ' [CLAMPED to 50bps max change]';
    }
  }

  const changeBps = Number(
    ((newRate - metrics.currentRate) * 10_000n) / PRECISE_UNIT
  );

  return {
    paymentMethodHash: metrics.paymentMethodHash,
    currencyCode: metrics.currencyCode,
    currentRate: metrics.currentRate,
    newRate,
    changeBps,
    reason,
  };
}

// --- Execution ---
async function executeAdjustments(
  rateManagerId: string,
  adjustments: RateAdjustment[],
  privateKey: `0x${string}`
) {
  const changed = adjustments.filter(a => a.newRate !== a.currentRate);
  if (changed.length === 0) {
    console.log('No rate changes needed.');
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  const registryAbi = parseAbi([
    'function setMinRate(bytes32 rateManagerId, bytes32 paymentMethodHash, bytes32 currencyHash, uint256 rate)',
    'function setMinRatesBatch(bytes32 rateManagerId, bytes32[][] paymentMethods, bytes32[][] currencies, uint256[][] rates)',
  ]);

  if (changed.length === 1) {
    // Single rate update
    const adj = changed[0];
    console.log(`Setting rate: ${adj.reason}`);
    const hash = await client.writeContract({
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: 'setMinRate',
      args: [
        rateManagerId as `0x${string}`,
        adj.paymentMethodHash as `0x${string}`,
        adj.currencyCode as `0x${string}`,
        adj.newRate,
      ],
    });
    console.log(`Tx: ${hash}`);
  } else {
    // Batch update
    console.log(`Batch updating ${changed.length} rates...`);
    const paymentMethods = [changed.map(a => a.paymentMethodHash as `0x${string}`)];
    const currencies = [changed.map(a => a.currencyCode as `0x${string}`)];
    const rates = [changed.map(a => a.newRate)];

    const hash = await client.writeContract({
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: 'setMinRatesBatch',
      args: [
        rateManagerId as `0x${string}`,
        paymentMethods,
        currencies,
        rates,
      ],
    });
    console.log(`Batch tx: ${hash}`);
  }
}
```

## Implementation — Full Optimization Loop

```typescript
async function runOptimizationLoop(
  rateManagerId: string,
  privateKey: `0x${string}`
) {
  console.log(`=== Rate Optimization: ${new Date().toISOString()} ===`);

  // Step 1: Fetch current vault rates from indexer
  const currentRates = await queryIndexer(`{
    RateManagerRate(where: { rateManagerId: { _eq: "${rateManagerId}" } }) {
      paymentMethodHash, currencyCode, managerRate, updatedAt
    }
  }`);

  // Step 2: Fetch vault performance (last 7 days)
  const sevenDaysAgo = BigInt(Math.floor(Date.now() / 1000) - 7 * 86400);
  const performance = await queryIndexer(`{
    ManagerStats(
      where: {
        rateManagerId: { _eq: "${rateManagerId}" }
        createdAt: { _gte: "${sevenDaysAgo}" }
      }
    ) {
      amount, spreadBps, pnlUsdCents, createdAt,
      quoteConversionRate, marketRate
    }
  }`);

  // Step 3: Fetch aggregate stats
  const aggregateStats = await queryIndexer(`{
    ManagerAggregateStats(where: { rateManagerId: { _eq: "${rateManagerId}" } }) {
      totalFilledVolume, totalFeeAmount, totalPnlUsdCents,
      fulfilledIntents, currentDelegatedBalance
    }
  }`);

  // Step 4: For each pair, fetch competitor rates
  const adjustments: RateAdjustment[] = [];
  for (const rate of currentRates.RateManagerRate) {
    const competitors = await queryIndexer(`{
      MethodCurrency(
        where: {
          paymentMethodHash: { _eq: "${rate.paymentMethodHash}" }
          currencyCode: { _eq: "${rate.currencyCode}" }
          conversionRate: { _gt: "0" }
        }
        order_by: { conversionRate: asc }
      ) { conversionRate }
    }`);

    const competitorRates = competitors.MethodCurrency.map(
      (c: any) => BigInt(c.conversionRate)
    );
    const marketBestRate = competitorRates.length > 0
      ? competitorRates[0]
      : BigInt(rate.managerRate);
    const marketMedianRate = competitorRates.length > 0
      ? competitorRates[Math.floor(competitorRates.length / 2)]
      : BigInt(rate.managerRate);

    // Compute pair-specific performance
    const pairIntents = performance.ManagerStats.filter(
      (s: any) => true // All intents (per-pair filtering requires additional data)
    );
    const pnl7d = pairIntents.reduce(
      (sum: bigint, s: any) => sum + BigInt(s.pnlUsdCents), 0n
    );
    const volume7d = pairIntents.reduce(
      (sum: bigint, s: any) => sum + BigInt(s.amount), 0n
    );

    const metrics: PairMetrics = {
      paymentMethodHash: rate.paymentMethodHash,
      currencyCode: rate.currencyCode,
      currentRate: BigInt(rate.managerRate),
      pnl7d,
      volume7d,
      fillCount7d: pairIntents.length,
      daysSinceLastFill: computeDaysSinceLastFill(pairIntents),
      marketBestRate,
      marketMedianRate,
    };

    adjustments.push(computeAdjustment(metrics));
  }

  // Step 5: Log recommendations
  console.log('\n--- Rate Recommendations ---');
  for (const adj of adjustments) {
    const status = adj.newRate === adj.currentRate ? 'HOLD' : 'CHANGE';
    console.log(`[${status}] ${adj.paymentMethodHash.slice(0, 10)}... / ${adj.currencyCode.slice(0, 10)}...`);
    console.log(`  Current: ${adj.currentRate} → New: ${adj.newRate} (${adj.changeBps > 0 ? '+' : ''}${adj.changeBps} bps)`);
    console.log(`  Reason: ${adj.reason}`);
  }

  // Step 6: Execute changes
  await executeAdjustments(rateManagerId, adjustments, privateKey);
}

// --- Helper: GraphQL query ---
async function queryIndexer(query: string): Promise<any> {
  const resp = await fetch(INDEXER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await resp.json();
  return json.data;
}

function computeDaysSinceLastFill(intents: any[]): number {
  if (intents.length === 0) return 999;
  const latest = Math.max(...intents.map((i: any) => Number(i.createdAt)));
  return Math.floor((Date.now() / 1000 - latest) / 86400);
}
```

## Monitoring

After each optimization run, track these metrics over time:

| Metric | Source | Purpose |
|--------|--------|---------|
| `totalPnlUsdCents` | ManagerAggregateStats | Is the vault profitable? |
| `totalFeeAmount` | ManagerAggregateStats | Revenue from management fees |
| `fulfilledIntents` | ManagerAggregateStats | Volume throughput |
| `spreadBps` per intent | ManagerStats | Are spreads converging to optimal? |
| `currentDelegatedBalance` | ManagerAggregateStats | Is liquidity growing or shrinking? |

Compare these week-over-week to assess optimization effectiveness.

## Safety Guardrails

1. **Maximum change per iteration**: 50 bps. Prevents catastrophic mispricing from a single bad data point.
2. **Minimum spread floor**: 10 bps (1.001x). Never set rates below cost (LP must always earn something).
3. **Maximum spread cap**: 10% (1.10x). Prevents absurd rates that would never fill.
4. **Disable threshold**: Only disable a pair (rate = 0) after 7+ days of zero fills. Prevents premature shutdown.
5. **Warning threshold**: Log a WARNING for any change exceeding 30 bps. Enables human review of large adjustments.
6. **Dry run mode**: Always log recommendations before executing. Add a `--dry-run` flag to scripts.

## Scheduling

Run the optimization loop on a regular cadence:

```bash
# Run every 15 minutes (recommended for active vaults)
*/15 * * * * cd /path/to/skills && python3 scripts/optimize.py VAULT_ID

# Run every hour (for low-volume vaults)
0 * * * * cd /path/to/skills && python3 scripts/optimize.py VAULT_ID

# Run every 6 hours (for stable, set-and-forget vaults)
0 */6 * * * cd /path/to/skills && python3 scripts/optimize.py VAULT_ID
```

Adjust frequency based on volume:
- High volume (>$10K/day): every 15 minutes
- Medium volume ($1K-$10K/day): every hour
- Low volume (<$1K/day): every 6 hours

## Contract Reference

| Contract | Address | Chain |
|----------|---------|-------|
| DepositRateManagerRegistryV1 | `0x3125F621482887d158cb51cE9b54D9D25b145877` | Base (staging) |
| DepositRateManagerController | `0x2CF2FA7F21be0F920E1D8f4bb9C08E2c07F0E5d7` | Base (staging) |
| Indexer | `https://indexer.hyperindex.xyz/00be13d/v1/graphql` | - |
| Peerlytics Orderbook | `https://orderbook.peerlytics.xyz` | - |

## Rate Encoding Reference

Rates use 18-decimal fixed-point (PRECISE_UNIT = 1e18):

| Scenario | Encoded Value | BPS Markup |
|----------|---------------|------------|
| 1:1 (no markup) | `1000000000000000000` | 0 bps |
| 10 bps markup | `1001000000000000000` | 10 bps |
| 50 bps markup | `1005000000000000000` | 50 bps |
| 2% markup | `1020000000000000000` | 200 bps |
| 5% markup | `1050000000000000000` | 500 bps |
| Disabled | `0` | N/A |
