---
name: pay-humans-fiat
description: Cash out USDC to a bank or payment app with Peer Cash. Use for fiat payouts, cash-out integration, and resuming a partial or stuck cash-out.
license: MIT
compatibility: "Node.js 22+; @zkp2p/cash 0.5.2; host wallet and Base RPC; browser identity flow for some payees."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Cash out to fiat

Use this when someone holds crypto and wants fiat delivered to a specified payment account. Peer Cash turns their Base USDC into a maker deposit: a buyer sends fiat to the payee, proves the payment, and receives USDC. A cash-out can fill in pieces. An estimate is neither a bank transfer nor a settlement guarantee.

## Gather the actual payout instruction

Resolve environment, amount, source chain/token, platform, currency, payee, and the authorized funding wallet. Reuse authorization already given for that exact payout; ask only for missing decisions. Never infer a recipient from an example or add a referral fee/code of your own. Keep account details in the host's private storage, out of transcripts and committed fixtures.

Use `@zkp2p/cash@0.5.2` and a host-supplied wallet. Start with canonical Base USDC; routed assets add a separate funding leg. Read [the checked example](scripts/cashout.ts) for exact calls and types. Install dependencies in the consuming project with its package manager; no script here executes on import.

## Execute the lifecycle

1. Call `cash.capabilities()` for the selected environment. Check the exact platform/currency pair, amount bounds, payee format, pricing mode, and attestation requirement. The default catalog does not prove live liquidity. UPI is a staging opt-in, not a production promise.
2. Call `cash.estimate({ amount, currency }, { includeEta: false })` before registering a payee. Report the estimate and variable fill time. Most corridors bind a rate when an intent is signaled; Alipay/CNY snapshots a creation-time rate. Use the returned corridor pricing, not one global assumption.
3. Register/prove the specified payee through the existing identity flow where required. New Wise, PayPal, and Alipay payees can require a browser identity attestation. `PAYEE_VERIFICATION_REQUIRED` is an unmet prerequisite; do not substitute dummy proof or put session cookies in code.
4. For a host-controlled signer, call `cash.prepare(input)`. **This registers payee details with the curator**, although it does not broadcast. Review every returned `txs[]` with its matching `steps[]`, including chain, spender, value, token amount, and target. Submit sequentially through the authorized wallet and confirm each receipt. Do not infer that every prepared plan contains exactly two transactions.
5. Pass the confirmed **createDeposit** receipt to `cash.finalizePreparedCashout(receipt)`. Persist the returned `depositId`, transaction hash, chain/environment, and owning account before subsequent work. The Cash resume key is `escrowAddress_onchainId`; keep the returned string rather than rebuilding it from a bare number.
6. For **every** `accessPolicyPaymentMethods` entry, submit `cash.prepareAccessPolicy(depositId, paymentMethod)` from the deposit owner's wallet and confirm it. Restricted legs require this post-creation policy; creation and policy are not atomic. Do not advertise the order as fully configured while any required policy is missing. If a policy fails, resume policy setup on the existing deposit.
7. Poll `cash.order(depositId)` or use `watch` with an abort signal and timeout. Report partial fills and `nextActions`. Distinguish `fiatOwed` from verified `fiatPaid`, payment ID, and released USDC. Completion is verified delivery, not the initial optimistic `awaiting-buyer` snapshot.

`cash.cashout(input, { signer })` performs the signed convenience path when the existing wallet and authorization permit it. It has the same persistence and recovery obligations.

## Recover without sending twice

- A timeout after broadcast is an unknown outcome. Find the transaction by wallet/nonce/hash and inspect its receipt before creating another deposit. An empty indexer result alone is not proof that broadcast failed.
- If creation succeeded but the indexer lags, retain receipt-derived state and retry reads with a bound. Never manufacture a second order to make it visible.
- Withdraw only when requested: `prepareWithdraw`/`withdraw` unwind unlocked funds and handle expired intents. Live locked funds cannot be withdrawn. A partial withdrawal can succeed while another fill remains active. `NOTHING_TO_WITHDRAW` does not imply all fiat was delivered.
- For source routing, retain the provider request ID and origin/destination transaction evidence separately. If bridging completed but cash-out creation failed, resume from the received Base USDC; do not bridge again. Unsigned `prepare` is the Base USDC path, not a generic unsigned bridge executor.

## Return a receipt

Report environment, deposited USDC, platform/currency, masked payee, deposit ID, transaction hashes, access-policy status, delivered/remaining amounts, and the next actionable state. Never call locked funds returned or an estimated payout paid.

Sources: [Peer Cash guide](https://docs.peer.xyz/developer/peer-cash), [published package](https://www.npmjs.com/package/@zkp2p/cash), [cash lifecycle](https://github.com/zkp2p/peer-cash/blob/main/docs/lifecycle-and-recovery.md).
