---
name: peer-analytics
description: "Query the canonical ZKP2P indexer for Peer metrics, attribution, and activity. Use for aggregate reports and bounded monitoring; Peerlytics links are for viewing only."
license: MIT
compatibility: "Node.js 22+; canonical ZKP2P indexer GraphQL access; @zkp2p/indexer-schema 0.22.0 for entity types."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Peer protocol analytics

The **ZKP2P indexer is the canonical data source** for this skill. Query it directly and derive reports from its records and aggregates. Peerlytics is an external web explorer for viewing details: do not use its API, SDK, scraped pages, cached metrics, or streaming service as report data. If indexer access fails, report the gap instead of falling back to another analytics source.

Turn the question into a metric first: scope (protocol, maker, integrator, rate manager, payment method), chain/environment, UTC start/end, status, unit, and comparison period. “Volume” must distinguish signaled, fulfilled, released, and actual fiat-paid amounts.

## Query the canonical indexer

Production GraphQL: `https://indexer.zkp2p.xyz/v1/graphql`. Use the configured canonical endpoint for another environment. Production accepted direct read-only requests without an auth header at review time; if access policy changes, use the host's existing indexer credentials. Never acquire paid access, disclose credentials, or substitute a retired HyperIndex endpoint to bypass a failure.

Use `@zkp2p/indexer-schema@0.22.0` for entity types. Its domain SDL is not the live Hasura query schema: inspect the selected endpoint when constructing unfamiliar queries. The live API uses PascalCase entity roots, `where`, `order_by`, `limit`, and a `numeric` scalar for indexed big integers. Check both HTTP status and GraphQL `errors`; HTTP 200 with partial data is not a complete report.

[The checked example](scripts/report.ts) queries `GlobalDailyStats` with variables, a chain filter, a half-open UTC date window, unique-ID keyset pagination, a request timeout, and a finite page budget. Call `reportWindow({ from: "2026-09-01", to: "2026-09-08", chainId: 8453, pageSize: 100, maxPages: 2 })` for September 1–7 UTC. The example returns observed totals, source, dates, observation time, underlying rows, and completeness; it sends requests only when called.

## Choose the entity that owns the metric

- **Daily protocol totals:** `GlobalDailyStats`, filtered by `chainId` and `dayTimestamp`. Sum period fields such as `fulfilledVolumeUsdCents` and `fulfilledIntentCount`, never cumulative fields. USD cents are the indexer's USDC-derived volume measure, not the customer's actual fiat payment. For sub-day boundaries, query the underlying intent records instead of including entire boundary days.
- **Makers and payment methods:** use the appropriate maker/platform statistics, daily snapshots, or `DailyPlatformVolume`. Verify whether the field is a lifetime total or a period value. `Intent.owner` is the taker; attribute maker activity using the corresponding deposit or the owning maker aggregate.
- **Available USDC inventory:** query `TokenLiquidity` for the exact chain and canonical USDC token. `DepositTokenLiquidity` provides its deduplicated per-deposit contributions. `CurrencyLiquidity` and `CurrencyPlatformLiquidity` describe overlapping currency/method views; summing them would count the same inventory several times.
- **Intent activity and settlement:** query `Intent` by the appropriate event timestamp and status. Use `signalTimestamp` for signaling, `fulfillTimestamp` for fulfillment, and `pruneTimestamp` for pruning. `releasedAmount` is gross released token value; `amount` is the signaled amount. Separate `FULFILLED` from `MANUALLY_RELEASED` when the question concerns verified payment rather than any release. Preserve nullable payment/release fields as unknown, not zero.
- **Attribution:** use canonical `attributionCodes` and `attributionSource` on deposits/intents. Deposit-creation attribution and intent attribution answer different questions. Do not relabel every address or referral-fee recipient as the integrator.

For new breakdowns, inspect the live fields and their indexer definitions before building a query. An executable quote still comes from the quote workflow; indexed orderbook or liquidity rows are observations, not reservations or guarantees of buyer eligibility.

## Keep aggregation and coverage explicit

1. Use `[start, end)` UTC windows consistently across comparisons. Big-integer timestamps are Unix seconds; JavaScript dates are milliseconds. Keep money as integer strings/bigints and label cents, token units, or fiat units before formatting.
2. Deduplicate using the entity's full ID. Preserve chain/escrow identity across contract generations. Paginate in a stable order with a strict keyset; do not switch to offsets for a changing dataset.
3. Do not add daily distinct-maker counts to claim distinct makers for a week. Union actual maker identities over the period, or report the daily counts separately. Retain the indexer's field-specific rounding when summing daily money aggregates.
4. A page budget exhausted means a partial observed result. In the example, `complete` means the filtered query was exhausted, not that chain indexing is current. `nextAfterId` identifies the last included row for further query design; it is not a live-stream cursor.
5. Record source endpoint, chain/environment, filters, period, query time, returned `updatedAt` values, and limits. `updatedAt` is the record's last update, not proof of the indexer's chain head. An ongoing day, reindex, backfill, or lag can make a snapshot provisional. A missing day/row alone does not prove zero activity.
6. For monitoring, use a bounded timestamp window and stable event position/ID cursor supported by the selected entity. Re-query an overlap window and deduplicate when records can change. A one-time report does not create a daemon or notification schedule.

## Link to details without changing the source

For an intent hash returned by the indexer, attach `https://peerlytics.xyz/explorer/intent/<intentHash>` as a **View in explorer** link. [Example intent page](https://peerlytics.xyz/explorer/intent/0x09e6e5750c3dc5a66300c0a35dec742b91e4018439563dcff86cbecdc2dd3674). The checked `intentExplorerLink` helper validates and formats the hash without making a request. Do not label the explorer as the source of the metric; report numbers remain sourced to the indexer. Verify other explorer route formats before emitting them.

Return the answer first, then metric definitions, UTC period, indexer provenance, comparison, and material coverage limits. Link relevant individual records for inspection. A leaderboard or correlation does not establish why activity changed.

Source: [published indexer domain schema](https://www.npmjs.com/package/@zkp2p/indexer-schema).
