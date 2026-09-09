---
name: peer-deposits
description: "Create and manage Peer escrow deposits through the protocol SDK: configure payees, payment methods, currencies, minimum rates, fill limits, and withdrawals."
license: MIT
compatibility: "@zkp2p/sdk 0.14.0 and viem 2.x; maker wallet; verified payee registration and Base RPC."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Peer escrow deposits

Use this for direct creation and management of protocol escrow deposits. A maker deposits USDC into escrow, configures fiat payment methods, and receives buyer payments. This is inventory and payment operations with fill, access, and dispute constraints. Do not describe it as guaranteed yield, an interest-bearing deposit, or idle USDC earning automatically.

## Design a deposit the maker can operate

Resolve the maker wallet, environment, USDC inventory, verified payees, offered currencies/platforms, minimum/maximum fill, and minimum acceptable fiat per USDC. Specify who monitors payments, whether seller automation is available, and who manages rates. Do not add unsupported corridors just to advertise liquidity.

Read the configured deployment and payee requirements with `@zkp2p/sdk@0.14.0`; reuse public SDK defaults rather than old hardcoded escrow/curator URLs. Use [the checked preparation example](scripts/deposit.ts) for a single supported method with a previously registered payee hash. It does not register a payee or send funds.

1. Verify each payee through the current curator identity flow. Keep raw account/session data out of logs. When passing `payeeData` to SDK preparation, registration can write external state; reusing a verified `payeeDetailsHashes` entry avoids re-registration. Never fabricate a hash to bypass identity requirements.
2. Inspect live token balance, chain, escrow, and allowance. Prepare an amount-scoped approval if needed, directed to the actual escrow in the prepared deposit plan. Have the existing authorized signer simulate and confirm it; an approval alone creates no deposit.
3. Prepare `client.prepareCreateDeposit` with token amount and fill range in 6-decimal USDC units. Conversion rates are **18-decimal fiat per USDC integer strings**. `processorNames`, payee hashes/data, and nested currency rates must line up by method index. A mismatch can attach the wrong payment destination.
4. Review the resulting deposit plan, then send through the maker wallet under the existing bounded authorization. Persist environment, escrow, on-chain numeric ID, full indexer ID returned by the service, and create receipt. Do not identify a deposit by numeric ID alone across escrow generations.
5. Configure the intended access/protection policy and confirm it before advertising protected/restricted liquidity. An enabled whitelist with no groups can still be restrictive. Read live state to prove settings; do not infer public access or stake protection from an omitted field.
6. Read the indexed deposit and actual on-chain availability after confirmation. Show configured currencies/rates, unlocked/locked balances, fill bounds, access, and automation status. A new deposit may not be immediately quotable while indexing catches up.

## Operate and unwind

- Track each intent and verified fiat payment; receiving a buyer's screenshot is not release evidence. Separate quoted/owed amounts from settled amounts and fees.
- `setCurrencyMinRate.prepare` changes an individual floor; `setAcceptingIntents.prepare` pauses new fills. Re-check owner permissions and current state immediately before either action. Existing intents keep their snapshotted terms.
- If rates are delegated, read both the deposit floor and manager result. The effective rate is the higher nonzero rate, **except a zero manager result disables the pair**; a reverting manager falls back to the deposit floor. A stale successful response is not an automatic fallback.
- `addFunds.prepare`, `removeFunds.prepare`, and `withdrawDeposit.prepare` are separate authorized inventory actions. Withdraw only free liquidity; prune expired intents through the supported method when appropriate. Never treat an active lock as a failed withdrawal that can be fixed by repeated submission.
- Manual release bypasses ordinary payment proof. Do not use it as routine automation or as a workaround for a failed attestation. It requires an explicit decision from the authorized depositor with verified payment evidence.

Return deposit and transaction identifiers, actual available/locked inventory, effective rate scope, fees, and the next monitoring or withdrawal condition. Report observed earnings from settled flows; do not annualize a short sample into a promised APY.

Sources: [seller guide](https://docs.peer.xyz/guides/for-sellers/provide-liquidity-sell-usdc), [SDK client reference](https://docs.peer.xyz/developer/sdk/client-reference), [EscrowV2 rate semantics](https://github.com/zkp2p/zkp2p-contracts/blob/2e70f3cc8ce7364bd3f417acd83452880f4df330/contracts/EscrowV2.sol).
