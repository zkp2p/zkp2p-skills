---
name: check-fx-rates
description: Compare executable Peer quotes for a specific fiat amount, wallet, and payment rail. Use for pricing, route choice, and quote eligibility checks.
license: MIT
compatibility: "@zkp2p/sdk 0.14.0 and viem 2.x; buyer address; network access to the configured curator."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Compare the price someone can execute

Answer “what will I receive?” with live quotes for the actual trade. A market summary, oracle price, and executable quote answer different questions. Peer rates are generally fiat units per USDC; a higher maker rate costs a buyer more fiat. Invert only when explicitly displaying the other direction and label the units.

## Build one comparable request

Resolve buyer wallet, recipient, exact input or output, fiat currency, payment platforms, destination chain/token, and environment. If the user asks for a hypothetical market comparison without a wallet, label it indicative; do not claim execution eligibility.

Use `@zkp2p/sdk@0.14.0`. [The checked example](scripts/quotes.ts) requests exact-fiat Base USDC quotes with `eligible` mode. It deliberately rejects excess decimal precision rather than silently rounding a spending instruction. Use the consuming project's package manager to install SDK and viem.

1. Construct `Zkp2pClient` with the host wallet/address account, chain `8453`, and explicit `runtimeEnv`. A read-only wallet can have an address account; quoting does not need a private key.
2. Request `getQuote` or `getQuotesBestByPlatform` for the same amount, token, wallet, and destination. Exact-fiat input is a 6-decimal integer string; exact-token input uses that token's decimals. Keep monetary strings/bigints until formatting.
3. Require a successful response; preserve the full quote envelope including expiry. An empty result means no matching liquidity, not zero fees or a zero price. Do not convert nearby suggestions into the requested quote.
4. Compare net token output and all fees on that common basis. Show rail, fiat spend, output, quote time/expiry, and relevant restrictions. Distinguish the deposit's conversion rate from a fee-adjusted effective price.
5. Immediately before a subsequent signal, refresh expired quotes and re-check the selected buyer and destination. Signaling is a separate wallet action; a successful quote reserves nothing.

## Eligibility is specific to the buyer

- `eligible` is the default actionable mode.
- `eligible_with_chargeback` includes protected liquidity for discovery and can include rows with insufficient stake.
- `eligible_with_chargeback_staked` checks free stake against the gross signal requirement. Open/directly granted liquidity still follows its own access rules.
- `all` belongs to orderbook browsing, not quote execution.
- `whitelistEnabled: true` with empty `allowedGroupIds` does not mean public. `disputeProtectionRequiresStake`, `disputeProtectionOptedOut`, and automated-release flags are facts about a row, not proof of this user's access, locked coverage, or settlement.

Use Peerlytics `getMarketSummary` or `getOrderbook` only for explicitly indicative market research. Label observation time, source, and liquidity scope. Never route an order using a market average or add percentages to simulate an executable quote.

## Return a decision, not a price dump

Report the best acceptable quote and why, comparable alternatives, fees, expiry, and any missing eligibility input. Keep payee identifiers private until the user needs them for the authorized payment. Do not initiate a transfer for a price-check request.

Sources: [SDK](https://docs.peer.xyz/developer/sdk), [published quote types](https://www.npmjs.com/package/@zkp2p/sdk), [buyer eligibility](https://docs.peer.xyz/guides/for-buyers/tiers).
