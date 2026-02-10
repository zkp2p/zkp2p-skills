---
name: look-up-peer-data
description: Look up any deposit, intent, address, maker, or verifier on the Peer protocol. Search transactions, check address history, inspect maker portfolios, and view verifier stats. Use when someone asks to find or inspect on-chain Peer data.
---

# Look Up Peer Data

## What You Can Look Up

Search and inspect any entity on the Peer protocol:

- **Deposits** -- balance, status, payment methods, linked intents
- **Intents** -- amount, lifecycle (signal -> fulfill/prune), related intents
- **Addresses** -- role detection (maker/taker/both), volume stats, full activity
- **Makers** -- portfolio summary, per-deposit APR, currency/platform allocations
- **Verifiers** -- throughput stats, currency breakdown, top takers/makers
- **History** -- maker fulfillment speed, taker trust tier progression

## Quick Example

```typescript
import { Peerlytics } from '@peerlytics/sdk';

const client = new Peerlytics({ apiKey: process.env.PEERLYTICS_API_KEY });

// Search any address, tx hash, or deposit ID
const results = await client.search('0xabc...def');

// Get a maker's portfolio
const maker = await client.getMaker('0xmaker...');
console.log(`${maker.summary.activeDeposits} active deposits, $${maker.summary.totalProfitUsd} profit`);

// Check a taker's trust tier
const taker = await client.getTakerHistory('0xtaker...');
console.log(`Tier: ${taker.stats.tier}, score: ${taker.stats.lockScore}`);
```

## Available Lookups

| What | Method | Returns |
|------|--------|---------|
| Universal search | `search(query)` | Matching intents, deposits, linked activity |
| Deposit detail | `getDeposit(id)` | Balance, intents, payment details, maker's other deposits |
| Intent detail | `getIntent(hash)` | Amount, lifecycle, related intents |
| Address profile | `getAddress(addr)` | Stats, all activity by role |
| Maker portfolio | `getMaker(addr)` | Summary, per-deposit breakdown, allocations |
| Verifier stats | `getVerifier(addr)` | Throughput, currency breakdown, top participants |
| List deposits | `getDeposits(filters)` | Filtered deposit list with USD values |
| List intents | `getIntents(filters)` | Filtered intent list with lifecycle data |
| Maker history | `getMakerHistory(addr)` | Deposit/intent stats, fulfillment speed |
| Taker history | `getTakerHistory(addr)` | Intent stats, trust tier, progression |

## Full Implementation

See **[peer-explorer](../peer-explorer/SKILL.md)** for complete SDK setup, all endpoint signatures, response types, pagination patterns, and error handling.
