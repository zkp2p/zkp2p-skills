---
name: analyze-peer-protocol
description: Measure Peer volume, makers, markets, and payment activity with explicit periods and attribution. Use for protocol reports and bounded activity monitoring.
license: MIT
compatibility: "Node.js 22+; @peerlytics/sdk 4.0.0; existing Peerlytics API key and request budget."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Measure Peer activity accurately

Turn a question into a metric before querying: scope (protocol, maker, integrator, vault, rail), UTC start/end, status, unit, and comparison period. “How much volume?” must distinguish signaled, fulfilled, released, and fiat-paid amounts. Do not present one as another or extrapolate a short window without labeling it.

## Query the current analytics client

Use `@peerlytics/sdk@4.0.0` and an existing API key supplied by the host. [The checked example](scripts/report.ts) fetches a windowed summary and one bounded activity page. API calls can consume credits; honor the existing access/budget. Do not create an x402 signer or authorize paid calls merely to produce a report. On missing credentials or quota, state the unavailable data rather than synthesizing a result.

Current method names:

- `getProtocolSummary({ from, to, compare: 'prior_period' })` for an explicit window. The no-argument overload is cumulative and is not equivalent.
- `getProtocolOverview`, `getTimeseries`, `getLeaderboard` for trends and ranked contributors with declared scope.
- `getMaker`, `getTaker`, `getIntegrator`, `getDeposit`, `getIntent` for a specific entity.
- `getMarketSummary`, `getOrderbook`, `getCurrencies`, `getPlatforms` for market/catalog observations.
- `getIntents`, `getDeposits`, `getActivity` for bounded records. Inspect the returned envelope, count, pagination, window, and `hasMore`; these are not bare arrays.

Retired `getSummary`, `getPeriod`, `getChunk`, `getAttribution`, and analytics `getQuote` examples must not be resurrected. Removed `lockScore`/taker-tier fields are not a current credit or eligibility score.

## Keep aggregation honest

1. Fetch a summary and inspect its resolved window. Use the same duration/status/units for comparisons. Distinguish zero events from an unavailable query.
2. Preserve monetary integer strings/bigints and declared decimals. State whether fees and partial settlements are included. Do not sum formatted strings or percentages.
3. Deduplicate by the entity/event key appropriate to the metric. A deposit offered in several currencies is one underlying inventory balance, not fresh liquidity per currency.
4. Separate maker, taker, integrator, and referral attribution. Indexer `attributionCodes`/`attributionSource` encode transaction attribution; they are not interchangeable with the payment recipient or every address in a transaction.
5. Record snapshot time, period, source, filters, limits, and truncation. A top-50 page is not the complete population. Use bounded pagination when a complete total is necessary, or explicitly report a sample.
6. If an aggregate and receipt-level evidence disagree, investigate scope, finality/indexing delay, statuses, decimals, and duplicates before declaring a protocol fault.

## Monitor with a defined stopping condition

`getActivity` returns `events`, `hasMore`, and `nextCursor`. That cursor walks older history; it is not a forward live-stream cursor. For polling, fetch a recent bounded window, deduplicate durable event IDs, and distinguish historical backfill from new alerts. Use `streamActivity` only with API-key authentication and an abort signal; x402 does not support that stream. A one-time report must not silently create a daemon or outbound notification schedule.

Return the answer first, followed by the period, definitions, source and observation time, comparison, and material coverage limits. Interpret changes cautiously: correlation or a leaderboard position does not establish the reason users behaved differently.

Sources: [published analytics SDK](https://www.npmjs.com/package/@peerlytics/sdk), [indexer domain schema](https://www.npmjs.com/package/@zkp2p/indexer-schema).
