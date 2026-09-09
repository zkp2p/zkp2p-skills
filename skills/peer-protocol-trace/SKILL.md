---
name: peer-protocol-trace
description: "Investigate a specific Peer intent, deposit, or transaction using indexer records and on-chain receipts. Use for lifecycle diagnosis and reconciliation; read-only."
license: MIT
compatibility: "@zkp2p/sdk 0.14.0; optional @zkp2p/indexer-schema 0.22.0; environment-specific RPC and indexer access."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Trace Peer intents, deposits, and transactions

Use this for one concrete incident or a bounded set of related deposits/intents. Establish the chain/environment and supplied identifier first. A transaction hash, intent hash, and composite deposit ID are different keys; a numeric deposit ID needs its escrow address. Do not infer identity by searching unrelated wallets.

## Reconstruct the lifecycle

Use `@zkp2p/sdk@0.14.0` for protocol/indexer reads and `@zkp2p/indexer-schema@0.22.0` for current entity types. [The checked example](scripts/trace.ts) uses the supported indexer wrappers. Configure a read-only wallet address, chain/RPC, and runtime environment; indexer credentials, if needed, remain in the host's secret store. Do not use a retired HyperIndex URL from another environment.

1. If given a transaction, fetch it and its receipt from that chain. Record status, block, sender, destination contract, and decoded relevant events using the matching deployed ABI. A transaction being found or mined is not enough: check receipt success. If pending/unknown, say so before treating missing events as absence.
2. Look up an intent with `client.indexer.getIntentByHash(hash)` or deposit with `getDepositById(id, { includeIntents: true })`. For an owner-scoped question use a bounded `getOwnerIntents`/deposit query. Preserve full IDs returned by the indexer rather than rebuilding them from obsolete SDK comments.
3. Follow intent → escrow/deposit → owner/recipient → signal, fulfillment, cancellation/prune, and extension events. Read the actual on-chain intent via `client.getIntent` where applicable; it can be absent after settlement/pruning, so a missing active record does not erase receipt history.
4. Reconcile token amount, fiat obligation, verified payment, released amount, fees, timestamps, and recipient. Money fields are integer strings/bigints with schema-defined decimals. Do not convert arbitrary monetary values through JavaScript `Number`.
5. Compare indexed observation with confirmed receipts/live contract state. Record the latest indexed evidence/block available. If the indexer lags, retry bounded reads; a lagging null is inconclusive, not a failed transaction or permission to replay it.

## Diagnose the actual state

- **Awaiting buyer:** a deposit exists but no active matching intent. Investigate available liquidity, rates, fill limits, currency/rail, acceptance, and access policy; balance alone does not prove it is quotable.
- **Matched/locked:** a live intent reserves funds. Check its actual expiry and payment status. Time passing is not proof of an emitted prune event.
- **Proof rejected:** compare payment recipient, currency, amount, timestamp, provider status, and intent binding. Preserve sensitive capture material privately; do not paste bank responses/cookies into a ticket.
- **Partially filled:** distinguish deposit-wide progress from the one intent's settlement. Do not claim the whole deposit paid because one fill fulfilled.
- **Fulfilled:** cite the fulfillment receipt and released value. If a bridge/destination route remains, show it as a separate state. For manually released funds, label that release mechanism; it is not proof that an attestor verified fiat.
- **Cancelled/pruned:** explain unlocked USDC and any independent fiat payment evidence. Cancellation does not prove a bank payment was reversed.
- **Extended:** use the escrow's canonical updated expiry; guardian payment alone is not the final expiry record.

For raw GraphQL, inspect the owning live schema and credentials first. The published domain SDL supplies entity types; it is not a promise that raw audit-event fields or generated Hasura root names match an old query. Prefer SDK wrappers for supported reads.

## Return a forensic receipt

Give the verdict and uncertainty, chain/environment, exact identifiers, ordered events with timestamps/transaction links, money reconciliation, and the smallest next step. Recommend a write only after proving the state and its required authority. This diagnostic skill does not cancel, prune, extend, refund, or retry a transfer merely because an order looks stuck.

Sources: [SDK reference](https://docs.peer.xyz/developer/sdk/client-reference), [indexer schema package](https://www.npmjs.com/package/@zkp2p/indexer-schema), [contracts](https://github.com/zkp2p/zkp2p-contracts).
