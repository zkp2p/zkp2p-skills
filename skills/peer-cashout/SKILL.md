---
name: peer-cashout
description: "Create and resume cash-outs with the Peer SDK (createPeer, peer.sell): deposit Base USDC, receive fiat from buyers, track fills, and withdraw unlocked funds."
license: MIT
compatibility: "Node.js 22+; @zkp2p/sdk 0.16.0-rc.1 and viem 2.x; host wallet and Base RPC; browser identity flow for some payees."
metadata:
  author: zkp2p
  reviewed: "2026-11-23"
---

# Peer cash-outs

Use this for the Peer SDK sell lifecycle (`createPeer(...).sell`) when someone holds crypto and wants fiat delivered to a specified payment account. `peer.sell` turns their Base USDC into a maker deposit: a buyer sends fiat to the payee, proves the payment, and receives USDC. A cash-out can fill in pieces. An estimate is neither a bank transfer nor a settlement guarantee.

## Gather the actual payout instruction

Resolve environment, amount, platform, currency, payee, and the authorized funding wallet. Reuse authorization already given for that exact payout; ask only for missing decisions. Never infer a recipient from an example or add a referral fee/code of your own. Keep account details in the host's private storage, out of transcripts and committed fixtures.

Use `@zkp2p/sdk@0.16.0-rc.1` (npm dist-tag `rc`; pin it exactly) and a host-supplied viem wallet. The SDK sells canonical Base USDC only; it does not bridge or route other assets, so fund the wallet with Base USDC first. Read [the checked example](scripts/cashout.ts) for exact calls and types. Install dependencies in the consuming project with its package manager; no script here executes on import.

## Execute the lifecycle

1. Call `peer.sell.capabilities()` for the selected environment. Check the exact platform/currency pair, amount bounds, payee format, pricing mode, and attestation requirement. The default catalog does not prove live liquidity. UPI/INR is available in production, preproduction, and staging without opt-in.
2. Call `peer.sell.estimate({ amount, currency }, { includeEta: false })` before registering a payee. Report the estimate and variable fill time. Every corridor, including Alipay/CNY and UPI/INR, binds the zero-spread oracle rate when each buyer signals an intent; estimates do not lock that rate.
3. Register/prove the specified payee through the existing identity flow where required. New Wise, PayPal, and Alipay payees can require a browser identity attestation. `PAYEE_VERIFICATION_REQUIRED` is an unmet prerequisite; do not substitute dummy proof or put session cookies in code.
4. For a host-controlled signer, call `peer.sell.prepare(input)`. **This registers payee details with the curator**, although it does not broadcast. Review every returned `txs[]` with its matching `steps[]`, including chain, spender, value, token amount, and target. Submit sequentially through the authorized wallet and confirm each receipt. Do not infer that every prepared plan contains exactly two transactions.
5. Pass the confirmed **createDeposit** receipt to `peer.sell.finalizePrepared(receipt)`. Persist the returned `depositId`, transaction hash, chain/environment, and owning account before subsequent work. The resume key is `escrowAddress_onchainId`; keep the returned string rather than rebuilding it from a bare number. No access-policy or group transaction follows creation.
6. Poll `peer.sell.order(depositId)` or use `watch` with an abort signal and timeout. Report partial fills and `nextActions`. Distinguish `fiatOwed` from verified `fiatPaid`, payment ID, and released USDC. Completion is verified delivery, not the initial optimistic `awaiting-buyer` snapshot.

`peer.sell(input, { signer })` performs the signed convenience path when the existing wallet and authorization permit it. It has the same persistence and recovery obligations.

## Recover without sending twice

- A timeout after broadcast is an unknown outcome. Find the transaction by wallet/nonce/hash and inspect its receipt before creating another deposit. An empty indexer result alone is not proof that broadcast failed.
- If creation succeeded but the indexer lags, retain receipt-derived state and retry reads with a bound. Never manufacture a second order to make it visible.
- Withdraw only when requested: `peer.sell.prepareWithdraw`/`peer.sell.withdraw` unwind unlocked funds and handle expired intents. Live locked funds cannot be withdrawn. A partial withdrawal can succeed while another fill remains active. `NOTHING_TO_WITHDRAW` does not imply all fiat was delivered.
- Errors are `PeerError` (`isPeerError`) with `code`, `retryable`, and `remediation`. `PAYEE_NOT_FOUND` means the handle does not exist on that platform; fix the payee instead of retrying. `TRANSACTION_SUBMISSION_UNKNOWN` carries a `recovery` hint; inspect the wallet's Base transactions before trying again.

## Return a receipt

Report environment, deposited USDC, platform/currency, masked payee, deposit ID, transaction hashes, delivered/remaining amounts, and the next actionable state. Never call locked funds returned or an estimated payout paid.

Sources: [published SDK](https://www.npmjs.com/package/@zkp2p/sdk), [SDK docs](https://docs.peer.xyz/developer/sdk).
