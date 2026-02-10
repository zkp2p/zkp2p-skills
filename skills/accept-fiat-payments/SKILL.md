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

## Quick Example

```typescript
const response = await fetch('https://api.pay.zkp2p.xyz/v1/checkout/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.PAY_API_KEY!,
  },
  body: JSON.stringify({
    merchantId: process.env.MERCHANT_ID,
    amountUsdc: '50.00',
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
    "amountUsdc": "50.00",
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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PAY_API_KEY` | API key from the ZKP2P Pay merchant dashboard |
| `MERCHANT_ID` | Merchant identifier from registration |
| `WEBHOOK_SECRET` | Secret for verifying webhook signatures |
| `PRIVATE_KEY` | Agent wallet private key (for on-chain operations) |

Register at `merchant.pay.zkp2p.xyz` to obtain credentials.

## Full Implementation

See the **`peer-checkout`** skill for complete implementation details: webhook handler setup, HMAC signature verification, order status polling, error codes, and the full order state machine.
