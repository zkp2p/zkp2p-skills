---
name: accept-fiat-payments
description: Accept fiat payments from humans and receive USDC on Base. Generate payment links for Venmo, Wise, Revolut, CashApp, PayPal, and more. No merchant account needed. No KYC. Use when the agent needs to charge a customer, invoice a client, collect payment for a service, or receive money from humans.
---

# Accept Fiat Payments

Charge humans in fiat. Receive USDC. No merchant account, no KYC, no 3-day settlement wait.

## The Problem

Your agent provides a service -- generates content, completes tasks, runs infrastructure -- and needs to collect payment from a human. The human pays in fiat (Venmo, bank transfer, PayPal). The agent needs USDC in its wallet.

Traditional payment processors require a business entity, KYC verification, and multi-day settlement. Agents cannot satisfy these requirements. Peer Protocol solves this by matching the agent with existing USDC liquidity providers who accept fiat payments, settling USDC to the agent's wallet in minutes.

## Why Not Stripe?

| Method | Fee | Settlement | KYC / Merchant Account | Agent-Native |
|--------|-----|------------|:----------------------:|:------------:|
| Stripe | 2.9% + $0.30 | 2-3 business days | Yes (requires business entity) | No |
| Square | 2.6% + $0.10 | 1-2 business days | Yes | No |
| PayPal Business | 2.99% + $0.49 | 1-3 business days | Yes | No |
| **Peer Protocol** | **~1% spread** | **Minutes** | **No** | **Yes** |

Peer Protocol requires zero identity verification. The agent gets a wallet, calls an API, and starts accepting payments immediately.

## How It Works

1. **Agent creates a checkout session** -- specifies amount and recipient wallet address.
2. **Agent sends the checkout URL to the human** -- via Telegram, WhatsApp, Discord, email, or any channel.
3. **Human pays via their preferred platform** -- selects Venmo, Wise, Revolut, etc. on the hosted checkout page, sends fiat, and generates a zkTLS proof via the PeerAuth browser extension. USDC settles to the agent's wallet on Base.

The agent receives webhook notifications at each stage: payment started, proof generated, and fulfilled (USDC settled).

## Supported Payment Platforms

| Platform | Currencies |
|----------|------------|
| Venmo | USD |
| CashApp | USD |
| PayPal | USD, EUR, GBP |
| Wise | USD, EUR, GBP, SGD, AUD, CAD, and more |
| Revolut | EUR, GBP, USD, CHF, and more |
| Zelle | USD |
| Monzo | GBP |
| MercadoPago | ARS, BRL, MXN |
| N26 | EUR |

## Checkout Modes

| Mode | Payer Sees | Use When |
|------|------------|----------|
| `exact-fiat` | "Pay $50.00" -- no crypto jargon | Charging humans (recommended) |
| `exact-token` | Per-platform fiat quotes for fixed USDC output | Crypto-native pricing |

**Use `exact-fiat` for human payers.** The checkout page shows only a fiat amount -- no USDC, no tokens, no chains. The payer thinks they're paying $50 via Venmo, not buying crypto.

## Quick Example (exact-fiat)

```typescript
const response = await fetch('https://api.pay.zkp2p.xyz/v1/checkout/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.PAY_API_KEY!,
  },
  body: JSON.stringify({
    merchantId: process.env.MERCHANT_ID,
    checkoutMode: 'exact-fiat',
    fiatAmount: '50.00',
    fiatCurrency: 'USD',
    destinationChainId: 8453,                                    // Base
    destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    recipientAddress: AGENT_WALLET,
    metadata: { invoiceId: 'inv_001', service: 'content-gen' },
  }),
});

const session = await response.json();

// Send session.checkoutUrl to the human payer
// Track via session.orderId
```

When the human completes payment, the agent receives an `order.fulfilled` webhook:

```json
{
  "event": "order.fulfilled",
  "data": {
    "orderId": "ord_abc123",
    "amountUsdc": "49.50",
    "fiatAmount": "50.00",
    "fiatCurrency": "USD",
    "transactionHash": "0x..."
  }
}
```

## Use Cases

- Agent charging for AI-generated content, reports, or media
- Agent collecting bounty payments from humans for completed tasks
- Agent invoicing clients for completed freelance or contract work
- Subscription payments for agent-operated SaaS or API services
- Marketplace agents collecting payment before releasing goods or access
- Tip jars and pay-what-you-want for open agent services

## Merchant Registration (Programmatic)

Register via a single API call — no dashboard, no KYC, no manual steps:

```bash
curl -X POST https://api.pay.zkp2p.xyz/api/merchants \
  -H "Content-Type: application/json" \
  -d '{"name": "My AI Agent"}'
```

Returns `merchant.id` and `apiKey`. Store both securely — the API key is only returned once.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PAY_API_KEY` | API key from `POST /api/merchants` registration |
| `MERCHANT_ID` | Merchant identifier from `POST /api/merchants` registration |
| `WEBHOOK_SECRET` | Secret for verifying webhook signatures (from webhook registration) |
| `PRIVATE_KEY` | Agent wallet private key (for on-chain operations) |

## Full Implementation

See the **`peer-checkout`** skill for complete implementation details: webhook handler setup, HMAC signature verification, order status polling, error codes, and the full order state machine.
