---
name: fiat-to-crypto
description: Buy crypto with bank or payment-app funds through Peer. Use for onramp integration, intent signaling, and Buyer TEE payment-proof fulfillment.
license: MIT
compatibility: "Browser with Peer extension; @zkp2p/sdk 0.14.0; host wallet and selected environment RPC."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Buy crypto with fiat

The buyer pays fiat to a quoted maker and receives crypto after payment verification. Use this skill for the buyer journey or its integration. Do not turn a request to cash out crypto into a buyer intent.

## Establish the order

Resolve environment, buyer wallet, receiving address, payment platform/currency, and either exact fiat spend or exact token output. Reuse existing spending authorization for that bounded order. Use `@zkp2p/sdk@0.14.0`; construct `Zkp2pClient` with the host wallet, Base chain ID `8453`, and the explicit runtime environment. Let the SDK choose the matching API/contracts; a website rebrand does not change API origins.

1. Fetch a fresh `client.getQuote` with buyer and recipient addresses, destination chain/token, payment platforms, currency, amount, and `isExactFiat`. Fiat quote amounts are integer strings with 6 decimals. Token amounts use the destination token's decimals. Never calculate a binding order from an FX midpoint.
2. For ordinary executable discovery, use `mode: 'eligible'`. If the user specifically wants staked chargeback-protected liquidity, use `eligible_with_chargeback_staked` and the actual buyer wallet. `eligible_with_chargeback` is discovery and may include insufficient-stake results. Whitelist and protection labels alone do not prove this buyer can signal.
3. Inspect success, quote expiry, full fees, output, payee, escrow, orchestrator, and eligibility. If no acceptable quote exists, report that or ask about a material amount/platform change; never silently expand spending or choose a nearby amount.
4. Prepare `client.signalIntent.prepare` with the selected quote's intent and conversion rate, pinning its escrow/orchestrator when provided. Simulate/submit through the host's authorized wallet. Persist the confirmed intent hash and signal transaction before opening the fiat payment step. If signaling reverts or the quote expires, refresh; do not ask the buyer to pay against an unconfirmed intent.
5. Show the exact fiat amount, currency, recipient details, memo if required, and live intent expiry from the confirmed order. Payment is performed in the user's authenticated bank/payment app. A screenshot or “sent” message is not payment proof.

## Capture and fulfill the same payment

Use the existing browser integration. Read [the official capture guide](https://docs.peer.xyz/onramp-llm.md) for `createPeerExtensionSdk`, extension state/version checks, listener registration, and provider-specific action configuration. Register the metadata listener **before** calling `authenticate`. If the browser or required provider is unavailable, report the missing integration; do not invent a headless credential bypass.

- Match the metadata message to the active request ID, platform, and unexpired capture; unregister the listener on completion or cancellation. Never reuse a message from another order.
- Bind selection to the expected payment ID, amount, currency, and recipient from this order. Reject ambiguous rows. A hidden row must not be selected. Use the provider row's `originalIndex`, never its index after filtering or sorting.
- Pass the selected row's `params` and captured `encryptedSessionMaterial` into a `proofType: 'buyerTee'` proof. Include `index` only when the current provider configuration requires it. Do not merge params from a different capture/order.
- [The checked proof helper](scripts/payment-proof.ts) demonstrates strict row matching and proof construction. It does not authenticate a bank, select a transaction automatically, or prove settlement.
- Call `client.fulfillIntent.prepare({ intentHash, proof })` or the signed `fulfillIntent` path under the existing order authorization. Attestation calls are external work; prepared fulfillment is not a purely local dry run.
- Confirm the fulfillment receipt and actual released amount/recipient. If a destination route follows Base settlement, track that route separately and report destination arrival only after its own evidence.

## Handle interruption

Resume the saved intent before creating another one. On an unknown broadcast outcome inspect the transaction, current intent, and receipt. On rejected proof, examine recipient, amount, currency, status, timestamp, provider configuration, and intent binding; keep encrypted session material private. Never work around a rejection with a fabricated attestation or a depositor's manual release.

If fiat has already been sent and the intent expires, preserve the payment evidence and route the order through the application's recovery/support flow. Do not blindly pay again, cancel, or create a replacement intent. Intent extension, if supported by the active deployment, is a separate prepaid action with a bounded cost, not a free retry.

Return the quoted and settled amounts separately, current state, intent hash, transaction evidence, and any remaining destination or recovery step.

Sources: [buyer guide](https://docs.peer.xyz/onramp-llm.md), [SDK client reference](https://docs.peer.xyz/developer/sdk/client-reference), [published SDK](https://www.npmjs.com/package/@zkp2p/sdk).
