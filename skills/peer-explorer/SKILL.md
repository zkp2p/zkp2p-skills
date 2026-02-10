---
name: peer-explorer
description: Look up deposits, intents, addresses, maker portfolios, verifier stats, and transaction history on the Peer protocol via Peerlytics API. Use when the user wants to inspect a specific deposit, intent, address, maker, or verifier, search across entities, or view maker/taker history.
---

# Peer Protocol Explorer

## Overview

The explorer surfaces on-chain Peer protocol state through the Peerlytics API. Look up any deposit, intent, address, maker portfolio, or verifier -- plus search across all entities and pull maker/taker history.

**SDK:** `@peerlytics/sdk` (v0.0.2+)
**Base URL:** `https://peerlytics.xyz`
**Auth:** `X-API-Key` header or x402 USDC micropayment (no key required)

## Setup

```bash
npm install @peerlytics/sdk
```

```typescript
import { Peerlytics } from '@peerlytics/sdk';

// With API key
const client = new Peerlytics({ apiKey: process.env.PEERLYTICS_API_KEY });

// Or with custom base URL
const client = new Peerlytics({ baseUrl: 'https://peerlytics.xyz' });
```

## Endpoints

### 1. Search

Universal search across deposits, intents, and addresses. The API auto-detects the query type (address, tx/intent hash, deposit ID).

```typescript
const results = await client.search('0xabc...def');

// results.query   -> { raw: '0xabc...def', type: 'address' }
// results.intents -> EnrichedIntent[]
// results.deposits -> DepositWithUsd[]
// results.linked  -> SearchLinkedData (activity, intentsByDeposit, paymentDetails, expiringSoon)
```

Filter by type or role:

```typescript
const results = await client.search('0xabc...def', {
  type: 'address',           // 'address' | 'hash' | 'deposit'
  role: 'owner',             // 'owner' | 'recipient' | 'verifier'
  limit: 20,
  offset: 0,
});
```

### 2. Deposit Detail

Get a single deposit with its intents and linked data (payment details, expired intents, maker's other deposits).

```typescript
const deposit = await client.getDeposit('escrow_123', { limit: 50 });

// deposit.deposit  -> DepositWithUsd (balance, status, success rate)
// deposit.intents  -> EnrichedIntent[] (intents against this deposit)
// deposit.linked   -> DepositDetailLinked
//   .paymentDetails    -> currencies, verifiers, platforms
//   .expiredIntents    -> recently expired intents
//   .makerDeposits     -> other deposits by the same maker
```

### 3. Intent Detail

Get a single intent with its linked deposit and related intents.

```typescript
const intent = await client.getIntent('0xhash...');

// intent.intent  -> EnrichedIntent (amount, status, lifecycle timing)
// intent.deposit -> DepositWithUsd | null
// intent.linked  -> IntentDetailLinked
//   .paymentDetails   -> currencies, verifiers, platforms
//   .relatedIntents   -> { sameDeposit, sameOwner }
```

### 4. Address Profile

Get all activity for an address -- intents, deposits, and aggregate stats.

```typescript
const addr = await client.getAddress('0xabc...def', { limit: 50 });

// addr.intents  -> IntentEntity[] (intents where address is owner)
// addr.deposits -> DepositEntity[] (deposits where address is depositor)
// addr.stats    -> AddressStats
//   .intents_total, .intents_fulfilled, .intents_pruned
//   .deposits_total
//   .volume_total_usd, .volume_as_taker_usd, .volume_as_maker_usd
// addr.linked.activity -> AddressActivity
//   .ownerIntents, .recipientIntents, .verifierIntents
//   .makerDeposits, .escrowContracts
```

### 5. Maker Portfolio

Get a maker's full portfolio -- summary stats, per-deposit breakdown, currency/platform allocations.

```typescript
const maker = await client.getMaker('0xmaker...');

// maker.summary -> PortfolioSummary
//   .totalDeposits, .activeDeposits
//   .totalLiquidityUsd, .availableLiquidityUsd, .lockedLiquidityUsd
//   .totalFillVolumeUsd, .totalProfitUsd
//   .weightedAvgApr, .capitalEfficiencyScore
//   .successRate, .fulfilledIntents, .prunedIntents
//   .firstSeenAt

// maker.deposits -> PortfolioDeposit[]
//   .depositId, .status, .availableUsd, .totalUsd
//   .currencies, .platforms
//   .fillVolumeUsd, .turnover, .apr, .successRate

// maker.currencyAllocations -> CurrencyAllocation[]
//   .currency, .label, .volumeUsd, .percentage

// maker.platformAllocations -> PlatformAllocation[]
//   .platform, .label, .volumeUsd, .percentage, .profitUsd
```

### 6. Verifier Stats

Get stats, currency breakdown, and recent activity for a verifier address.

```typescript
const verifier = await client.getVerifier('0xverifier...', { limit: 50 });

// verifier.verifier -> string (address)
// verifier.intents  -> IntentEntity[] (intents verified by this address)
// verifier.stats    -> VerifierStats
//   .totalIntents, .fulfilledIntents, .prunedIntents
//   .totalVolumeUsd, .successRateBps, .activeDeposits

// verifier.breakdown -> {
//   currencies: CurrencyBreakdown[] ({ code, count, volume })
//   topTakers: TopTaker[] ({ address, count, volume })
//   topMakers: TopMaker[] ({ address, deposits, volume, liquidity })
// }

// verifier.recentActivity -> Array<{
//   intentHash, status, amountUsd, currency, timestamp, taker
// }>
```

### 7. List Deposits

List deposits with filters. Returns enriched deposits with USD values and payment method details.

```typescript
const deposits = await client.getDeposits({
  depositor: '0xmaker...',       // filter by depositor
  status: 'ACTIVE',              // 'ACTIVE' | 'CLOSED' | 'WITHDRAWN'
  accepting: true,               // only accepting intents
  platform: ['venmo', 'wise'],   // filter by platform(s)
  currency: ['USD', 'EUR'],      // filter by currency(ies)
  limit: 20,
  offset: 0,
});

// deposits.deposits -> EnrichedDeposit[]
//   each has: paymentMethods, currencies, markets, availableUsd, outstandingUsd
// deposits.count, deposits.hasMore
```

### 8. List Intents

List intents with filters. Returns enriched intents with USD values and lifecycle data.

```typescript
const intents = await client.getIntents({
  owner: '0xtaker...',                      // filter by taker
  status: ['FULFILLED', 'SIGNALED'],        // IntentStatusFilter[]
  depositId: ['escrow_123', 'escrow_456'],  // filter by deposit(s)
  verifier: '0xverifier...',
  limit: 50,
  offset: 0,
});

// intents.intents -> EnrichedIntent[]
//   each has: amountUsd, exchangeRate, lifecycle, platform, currency
// intents.count, intents.hasMore
```

### 9. Maker History

Get a maker's historical performance -- deposit stats, intent outcomes, currency/platform breakdown.

```typescript
const history = await client.getMakerHistory('0xmaker...');

// history.deposits -> {
//   total, active, volumeUsd,
//   platforms: [{ id, label, count }],
//   currencies: [{ code, label, count }],
//   recent: [{ id, status, availableUsd, outstandingUsd, totalUsd, verifiers, currencies }]
// }

// history.intents -> {
//   total, fulfilled, pruned, successRate, volumeUsd,
//   averageFulfillmentSeconds, medianFulfillmentSeconds,
//   byCurrency: [{ code, label, volumeUsd, count }],
//   byPlatform: [{ platform, label, volumeUsd, count }],
//   recent: [{ hash, status, amountUsd, currency, signalTimestamp, fulfillTimestamp }]
// }

// history.takerIntents -> { total, volumeUsd }
```

### 10. Taker History

Get a taker's intent history, success metrics, and trust tier.

```typescript
const history = await client.getTakerHistory('0xtaker...');

// history.intents -> {
//   total, fulfilled, pruned, successRate, volumeUsd,
//   averageFulfillmentSeconds, medianFulfillmentSeconds,
//   byCurrency: [{ code, label, volumeUsd, count }],
//   byPlatform: [{ platform, label, volumeUsd, count }],
//   recent: [{ hash, status, amountUsd, currency, signalTimestamp, fulfillTimestamp }]
// }

// history.stats -> {
//   lockScore, tier,
//   tierProgress: { currentTier, nextTier, progress, volumeNeeded },
//   firstSeenAt, lastIntentAt
// }
```

## Common Patterns

### Check if an address is a maker or taker

```typescript
const addr = await client.getAddress('0x...');
const isMaker = addr.stats.deposits_total > 0;
const isTaker = addr.stats.intents_total > 0;
const role = isMaker && isTaker ? 'both' : isMaker ? 'maker' : 'taker';
```

### Get a maker's best-performing deposit

```typescript
const maker = await client.getMaker('0xmaker...');
const best = maker.deposits
  .filter(d => d.status === 'active')
  .sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0))[0];
```

### Find all fulfilled intents for a deposit

```typescript
const intents = await client.getIntents({
  depositId: 'escrow_123',
  status: 'FULFILLED',
  limit: 100,
});
```

### Search and inspect a transaction

```typescript
const results = await client.search('0xtxhash...');
if (results.intents.length > 0) {
  const detail = await client.getIntent(results.intents[0].intentHash);
  console.log(detail.intent.lifecycle);
}
```

## Pagination

All list endpoints support `limit` and `offset`. Responses include `hasMore` to indicate additional pages.

```typescript
let offset = 0;
const limit = 50;
let allDeposits: EnrichedDeposit[] = [];

do {
  const page = await client.getDeposits({ status: 'ACTIVE', limit, offset });
  allDeposits.push(...page.deposits);
  offset += limit;
  if (!page.hasMore) break;
} while (true);
```

## Error Handling

The SDK throws typed errors:

| Error | Status | When |
|-------|--------|------|
| `NotFoundError` | 404 | Deposit/intent/address not found |
| `ValidationError` | 400 | Invalid parameters |
| `RateLimitError` | 429 | Too many requests (includes `retryAfter` seconds) |
| `PeerlyticsError` | Other | General API error |

```typescript
import { NotFoundError, RateLimitError } from '@peerlytics/sdk';

try {
  const deposit = await client.getDeposit('nonexistent');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Deposit not found');
  } else if (err instanceof RateLimitError) {
    console.log(`Rate limited, retry after ${err.retryAfter}s`);
  }
}
```

## Full Response Schemas

See [references/explorer-api.md](references/explorer-api.md) for complete type definitions.

## Environment

| | Value |
|--|-------|
| Peerlytics API | `https://peerlytics.xyz` |
| Auth | `X-API-Key` header or x402 micropayment |

```bash
export PEERLYTICS_API_KEY="..."   # Optional -- or use x402 micropayment instead
```
