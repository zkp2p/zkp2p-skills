---
name: peer-activity
description: Monitor real-time Peer (ZKP2P) protocol activity — intents signaled/fulfilled/pruned, deposits created/topped-up/closed, and rate changes. Poll or stream events via Peerlytics SDK. Use when the user wants a live feed, needs to watch a specific deposit or maker, or wants to react to protocol events.
---

# Peer Activity Skill

## Overview

Real-time event feed for the Peer protocol. Every on-chain action — intents, deposits, rate changes — emits a `LiveEvent` that can be polled or streamed.

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

## Event Types

| Event Type | Description |
|-----------|-------------|
| `intent_signaled` | New intent created — buyer locked USDC in escrow |
| `intent_fulfilled` | Intent completed — proof verified, USDC released |
| `intent_pruned` | Intent expired and was pruned from deposit |
| `deposit_created` | New LP deposit opened |
| `deposit_topup` | Funds added to an existing deposit |
| `deposit_withdrawn` | Funds removed from a deposit |
| `deposit_closed` | Deposit deactivated |
| `deposit_rate_updated` | Conversion rate changed on a deposit |

## Polling Activity

Fetch recent events with optional filters:

```typescript
const { events } = await peerlytics.getActivity({
  type: 'intent_fulfilled',
  limit: 20,
});

for (const event of events) {
  console.log(`${event.type} | ${event.timestamp}`);
  console.log(`  Intent: ${event.intentHash}`);
  console.log(`  Amount: ${event.amount} ($${event.amountUsd} USD)`);
  console.log(`  Platform: ${event.platform}`);
  console.log(`  Rate: ${event.conversionRate}`);
}
```

### Filter Options

All filters are optional. Combine as needed.

| Filter | Type | Description |
|--------|------|-------------|
| `type` | `EventType \| EventType[]` | Filter by event type(s) |
| `intentHash` | `string \| string[]` | Filter by specific intent(s) |
| `depositId` | `string \| string[]` | Filter by specific deposit(s) |
| `address` | `string \| string[]` | Filter by any involved address(es) |
| `owner` | string | Filter by intent owner |
| `depositor` | string | Filter by deposit owner |
| `recipient` | string | Filter by USDC recipient |
| `since` | number | Unix timestamp — only events after this time |
| `limit` | number | Max events to return |
| `offset` | number | Pagination offset |

### Filter Examples

#### Watch a Specific Deposit

```typescript
const events = await peerlytics.getActivity({
  depositId: '42',
  type: ['intent_signaled', 'intent_fulfilled', 'intent_pruned'],
  limit: 50,
});
```

#### Track a Maker's Activity

```typescript
const events = await peerlytics.getActivity({
  depositor: '0xMakerAddress...',
  since: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
});
```

#### Monitor All Fulfillments

```typescript
const events = await peerlytics.getActivity({
  type: 'intent_fulfilled',
  since: Math.floor(Date.now() / 1000) - 3600, // Last hour
  limit: 100,
});
```

#### Rate Change Alerts

```typescript
const events = await peerlytics.getActivity({
  type: 'deposit_rate_updated',
  since: Math.floor(Date.now() / 1000) - 3600,
});

for (const event of events) {
  console.log(`Deposit ${event.depositId}: rate changed to ${event.newRate}`);
}
```

## Polling Loop

For continuous monitoring, poll at an interval:

```typescript
async function monitorActivity(
  peerlytics: Peerlytics,
  filters: ActivityFilters,
  intervalMs = 15_000,
) {
  let lastTimestamp = Math.floor(Date.now() / 1000);

  setInterval(async () => {
    try {
      const { events } = await peerlytics.getActivity({
        ...filters,
        since: lastTimestamp,
      });

      if (events.length > 0) {
        lastTimestamp = Math.max(...events.map(e => Number(e.timestamp)));

        for (const event of events) {
          handleEvent(event);
        }
      }
    } catch (err) {
      console.error('Activity poll error:', err);
    }
  }, intervalMs);
}

function handleEvent(event: LiveEvent) {
  switch (event.type) {
    case 'intent_fulfilled':
      console.log(`Fulfilled: ${event.intentHash} | ${event.amount} USDC | ${event.platform}`);
      break;
    case 'intent_signaled':
      console.log(`New intent: ${event.intentHash} | ${event.amount} USDC`);
      break;
    case 'deposit_rate_updated':
      console.log(`Rate update: deposit ${event.depositId} -> ${event.newRate}`);
      break;
    default:
      console.log(`${event.type}: ${JSON.stringify(event)}`);
  }
}
```

## SSE Streaming (Real-Time)

For lower latency, use the Server-Sent Events stream endpoint directly:

```typescript
const url = new URL('https://peerlytics.xyz/api/v1/activity/stream');

// Optional query params for filtering
url.searchParams.set('type', 'intent_fulfilled');
// url.searchParams.set('depositId', '42');
// url.searchParams.set('depositor', '0x...');

const eventSource = new EventSource(url.toString(), {
  headers: { 'x-api-key': process.env.PEERLYTICS_API_KEY },
} as EventSourceInit);

eventSource.onmessage = (event) => {
  const data: LiveEvent = JSON.parse(event.data);
  console.log(`[${data.type}] ${data.intentHash ?? data.depositId} | ${data.amount} USDC`);
};

eventSource.onerror = (err) => {
  console.error('SSE error:', err);
  // EventSource auto-reconnects
};
```

### Node.js SSE (eventsource package)

Native `EventSource` is available in modern Node.js (v18+). For older versions:

```bash
npm install eventsource
```

```typescript
import EventSource from 'eventsource';

const es = new EventSource(
  'https://peerlytics.xyz/api/v1/activity/stream?type=intent_fulfilled',
  { headers: { 'x-api-key': process.env.PEERLYTICS_API_KEY! } },
);

es.onmessage = (event) => {
  const data: LiveEvent = JSON.parse(event.data);
  handleEvent(data);
};
```

## LiveEvent Type

```typescript
interface LiveEvent {
  id: string;
  type: EventType;
  chainId: number;
  blockNumber: number;
  logIndex: number;
  timestamp: string;

  // Intent fields (present for intent events)
  intentHash?: string;
  depositId?: string;
  owner?: string;
  toAddress?: string;
  amount?: string;
  amountUsd?: number;
  paymentMethod?: string;
  platform?: string | null;
  fiatCurrency?: string;
  currency?: string;
  conversionRate?: string;
  exchangeRate?: number;
  isManualRelease?: boolean;

  // Deposit fields (present for deposit events)
  depositor?: string;
  fundsTransferredTo?: string;
  token?: string;
  intentGuardian?: string;
  delegate?: string;

  // Rate update fields
  newMinConversionRate?: string;
  newRate?: number;
}

type EventType =
  | 'intent_signaled'
  | 'intent_fulfilled'
  | 'intent_pruned'
  | 'deposit_created'
  | 'deposit_topup'
  | 'deposit_withdrawn'
  | 'deposit_closed'
  | 'deposit_rate_updated';

interface ActivityFilters {
  type?: EventType | EventType[];
  intentHash?: string | string[];
  depositId?: string | string[];
  address?: string | string[];
  owner?: string;
  depositor?: string;
  recipient?: string;
  since?: string | number;
  limit?: number;
  offset?: number;
}
```

## Common Patterns

### Pattern: Alert on Large Intents

```typescript
monitorActivity(peerlytics, { type: 'intent_signaled' }, 10_000);

function handleEvent(event: LiveEvent) {
  const amountUsd = event.amountUsd ?? 0;
  if (amountUsd > 5000) {
    console.log(`Large intent: ${event.intentHash} | $${amountUsd}`);
  }
}
```

### Pattern: Track Your Own Deposit

```typescript
const MY_DEPOSIT_ID = '42';

monitorActivity(peerlytics, {
  depositId: MY_DEPOSIT_ID,
  type: ['intent_signaled', 'intent_fulfilled', 'intent_pruned'],
}, 15_000);
```

### Pattern: Competitive Rate Monitoring

Watch rate changes from competing LPs to adjust your own rates:

```typescript
const events = await peerlytics.getActivity({
  type: 'deposit_rate_updated',
  since: Math.floor(Date.now() / 1000) - 3600,
});

for (const event of events) {
  if (event.depositor !== MY_ADDRESS) {
    console.log(`Competitor ${event.depositor} changed rate on deposit ${event.depositId} to ${event.newRate}`);
  }
}
```

## Environment

| | Value |
|--|-------|
| Peerlytics API | `https://peerlytics.xyz` |
| Auth | `X-API-Key` header or x402 micropayment |

| Variable | Description |
|----------|-------------|
| `PEERLYTICS_API_KEY` | Peerlytics API key (or use x402 instead) |
