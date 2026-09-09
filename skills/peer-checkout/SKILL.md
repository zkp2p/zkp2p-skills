---
name: peer-checkout
description: "Create Peer Pay checkout orders and integrate merchant payment links, signed webhooks, and order fulfillment."
license: MIT
compatibility: "Server-side Node.js; @zkp2p/pay-sdk 4.0.1; merchant API key, configured API/checkout origins, webhook endpoint."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Peer Pay checkout orders

Use hosted checkout when a merchant wants customers to pay through supported rails and receive crypto settlement. An order, a payment attempt, and settlement are separate records. Use the merchant API; do not improvise a maker deposit as a merchant checkout.

## Set the merchant contract

Resolve merchant environment, server-side API key, authorized recipient and destination chain/token, either exact USDC amount or exact fiat amount/currency, fee payer, permitted rails, and return URLs. Confirm only missing material choices; reuse the merchant's configured defaults when the request intends them. Never put a merchant key in browser code or model-visible logs.

Use `@zkp2p/pay-sdk@4.0.1`. [The checked server example](scripts/checkout.ts) creates a USDC-denominated order with exact decimal strings and a bounded request. It writes an order when called. Supply API and checkout origins from the merchant's live environment configuration; do not replace service URLs with `peer.xyz` based on branding.

1. Optionally call `checkQuoteAvailability` with the same amount and `enabledRails`. This is advisory and reserves nothing. If only nearby amounts are available, obtain authorization for an amount change rather than silently resizing the purchase.
2. Call `createCheckout` server-side. Use either `requestedUsdcAmount` or `requestedFiatAmount` plus `requestedFiatCurrency`, never both. The amount is a human decimal string here, unlike protocol quote base-unit amounts.
3. Persist the returned order identity and its association with your internal purchase before delivering `checkoutUrl`. Treat order tokens/checkout links as sensitive capabilities; do not publish them in issue bodies or analytics.
4. Send the hosted link through the existing authorized customer flow. A redirect URL, iframe `checkout.success` message, or customer assertion is a UI signal, not fulfillment authority.
5. Verify signed server webhooks using the current documented signature scheme and raw-body handling. Read [the webhook reference](https://docs.pay.peer.xyz/webhooks/payloads) and the merchant environment's current integration docs before implementing verification. Do not invent a header, algorithm, replay window, or shared secret.
6. Reconcile events idempotently with the owning order and internal purchase. Release goods/credit on verified `ORDER_FULFILLED`. Use `PAYMENT_SETTLED` to reconcile actual payout amounts; one settled payment need not fulfill an entire order. A bridged destination can settle a different amount from its quote.

## Handle retries and later events

- Creation timing out does not prove no order was created. Reconcile using the merchant's server records before retrying; do not invent an unsupported idempotency header or duplicate checkout links.
- `PAYMENT_EXPIRED`/`PAYMENT_FAILED` concern an attempt. Do not automatically cancel the order or discard a possible late settlement.
- If dynamic orders are enabled, process `ORDER_RESIZED` against the new server amount and the merchant's fulfillment policy. Do not enable resizing implicitly for fixed-price goods.
- Chargebacks are additive facts. A fulfilled order can acquire a chargeback status while remaining fulfilled. Record `PAYMENT_CHARGEBACKED`, `ORDER_CHARGEBACKED`, and `ORDER_PARTIALLY_CHARGEBACKED` without rewriting historical fulfillment or claiming an automatic refund.
- Read current rail/stake availability. Protection for Venmo/PayPal is not a blanket claim that every rail/payment is covered or cannot be disputed.

Return the created order ID privately, checkout delivery status, configured amount/destination, and verified payment/fulfillment state. For an integration change, include webhook signature, duplicate delivery, partial payment, late settlement, resize, and chargeback tests. Do not test by placing a real customer order unless that test transaction is specifically authorized.

Sources: [published Pay SDK](https://www.npmjs.com/package/@zkp2p/pay-sdk), [Pay documentation](https://docs.pay.peer.xyz).
