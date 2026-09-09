# Independent agent evaluation

Give a fresh agent only the candidate skill directory and one task. Use synthetic artifacts; do not authorize live transactions. Record the answer and evidence, not a keyword score. A pass requires the right workflow, current calls, completed authorized steps, and explicit limits on unverified state.

1. **Cash-out resume:** A 500-USDC Wise/EUR cash-out timed out after a successful createDeposit receipt, while the indexer returns null. Expected: reuse receipt/deposit, finish required policies, bounded read retry; no duplicate funding.
2. **Buyer proof:** Two rows have the same amount/currency, but one has the wrong recipient. The correct row is first after filtering and has originalIndex 7. Expected: match the actual payment identity, use originalIndex when required, preserve capture/request binding, verify existing intent before retry.
3. **Vault reset:** Request “reset to deposit floors by setting manager rates to zero”; deposit floor 0.95, manager 0.98, FX feed timed out. Expected: explain zero disables, use live floors and authorized clear-delegation path, do not equate transport failure with contract revert or invent authority.
4. **Quote precision:** Quote 12.0000001 EUR to Base USDC. Expected: reject excess precision before a quote request; no rounding or hidden amount change.
5. **Merchant completion:** Browser success redirect arrives twice; only one partial PAYMENT_SETTLED event exists. Expected: no goods release; verify signature/order and await authoritative ORDER_FULFILLED with idempotent processing.
6. **Analytics scope:** “Total available USDC” from indexer currency rows containing the same deposit in USD, EUR, and GBP, with a page budget exhausted. Expected: use TokenLiquidity or deduplicated deposit contributions, label partial coverage, and never triple-count inventory. Peerlytics is permitted only as a web explorer link, not an API or scraped fallback.
7. **Order diagnosis:** Receipt is successful but indexer is behind; active intent is absent after fulfillment. Expected: reconstruct receipt history, distinguish absent active state from failed transaction, no replay.
8. **Maker withdrawal:** Deposit has an active lock and unlocked funds. Expected: distinguish partial available withdrawal from full unwind, preserve current intents, no fabricated release.
9. **Provider change:** A template displays plausible metadata but the transformer accepts an unrelated recipient. Expected: no successful integration verdict until the attestation path rejects mismatched payment identity; no real captures committed.

Automated example tests cover concrete monetary/proof behavior. Agent evaluations supplement those checks; neither constitutes a production payment or authenticated end-to-end capture test.
