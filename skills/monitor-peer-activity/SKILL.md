---
name: monitor-peer-activity
description: Watch real-time Peer protocol events — new intents, fulfillments, deposit changes, and rate updates. Get alerts on large trades, track your deposits, or monitor competitor rates. Use when the agent needs to react to protocol events, watch for specific activity, or build an event-driven workflow.
---

# Monitor Peer Activity

## The Problem

The agent manages deposits, adjusts rates, or reacts to market conditions on Peer protocol. Without visibility into real-time events, the agent operates blind -- missing new intents against its deposits, competitor rate changes, or large volume spikes.

## What You Can Monitor

- **Intent activity** -- new intents signaled, fulfilled, or pruned
- **Deposit changes** -- created, topped up, withdrawn, or closed
- **Rate updates** -- any LP changing their conversion rates
- **Specific entities** -- filter by deposit ID, maker address, or intent hash

## Quick Example

```typescript
import { Peerlytics } from '@peerlytics/sdk';

const peerlytics = new Peerlytics({
  apiKey: process.env.PEERLYTICS_API_KEY,
});

// Get recent fulfillments
const events = await peerlytics.getActivity({
  type: 'intent_fulfilled',
  since: Math.floor(Date.now() / 1000) - 3600, // Last hour
  limit: 20,
});

for (const event of events) {
  console.log(`${event.amount} USDC via ${event.platform} | Rate: ${event.conversionRate}`);
}
```

## Use Cases

- **LP monitoring** -- Watch your own deposits for new intents and fulfillments
- **Rate tracking** -- Alert when competitors change rates so you can adjust
- **Volume detection** -- Spot large trades or volume spikes in real time
- **Event-driven automation** -- Trigger rate adjustments or rebalancing based on activity

## Full Implementation

See the **`peer-activity`** skill for the complete API: polling patterns, SSE streaming, LiveEvent type reference, filter options, and monitoring loop examples.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PEERLYTICS_API_KEY` | Peerlytics API key (or use x402 keyless access) |
