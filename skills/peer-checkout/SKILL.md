---
name: peer-checkout
description: Generate ZKP2P Pay checkout links for receiving fiat payments as USDC. Create checkout sessions, send payment links to users, and handle webhook notifications for payment completion. Use when the user wants to accept payments, generate a payment link, or receive fiat payments as crypto.
---

# ZKP2P Checkout Skill

## Overview

ZKP2P Pay lets agents accept fiat payments (Venmo, CashApp, PayPal, Wise, Revolut, Zelle, Monzo, N26) and receive USDC on Base. The merchant creates a checkout session, receives a hosted checkout URL, shares it with the payer, and gets webhook notifications as the payment progresses through verification and settlement.

The payer completes payment on their chosen platform, generates a zkTLS proof via the PeerAuth browser extension, and the protocol settles USDC to the merchant's wallet -- fully non-custodial, no KYC required.

## Setup

### 1. Register as a Merchant (Programmatic — No Dashboard Required)

```bash
curl -X POST https://api.pay.zkp2p.xyz/api/merchants \
  -H "Content-Type: application/json" \
  -d '{"name": "My AI Agent"}'
```

Response:
```json
{
  "success": true,
  "responseObject": {
    "merchant": {
      "id": "merchant_abc123",
      "name": "My AI Agent",
      "walletAddress": "0x..."
    },
    "apiKey": "sk_live_xxxxx"
  }
}
```

No authentication required. Store the `apiKey` securely — it is only returned once. The `merchant.id` and `apiKey` are needed for all subsequent API calls.

### 2. (Optional) Register a Webhook Endpoint

```bash
curl -X POST https://api.pay.zkp2p.xyz/v1/merchant/webhooks \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_live_xxxxx" \
  -d '{"url": "https://your-agent.example.com/webhooks/zkp2p"}'
```

Alternatively, you can poll session status instead of using webhooks (see [Track Order Status](#track-order-status)).

## Checkout Modes

Two checkout modes control what the payer sees and how amounts work:

| Mode | Fixed Side | Payer Sees | Use When |
|------|-----------|------------|----------|
| `exact-fiat` | Fiat amount | "Pay $25.00 via Venmo" -- no crypto jargon | Charging humans who think in dollars |
| `exact-token` | USDC amount | Per-platform fiat quotes for a fixed USDC output | Pricing in USDC, crypto-native payers |

**Recommended for agents: `exact-fiat`.** The payer sees a clean fiat amount with no mention of USDC, tokens, or chains. The checkout page hides all crypto complexity.

### exact-fiat (Recommended)

The payer pays a fixed fiat amount. The agent receives a variable USDC amount (fiat minus spread).

- Checkout UI shows: "Pay $25.00" -- platforms sorted by best rate, unavailable ones grayed out
- Requires: `fiatAmount`, `fiatCurrency`
- Optional: `maxFeePercentage` (default 10%) -- caps the spread between fiat paid and USDC received

### exact-token

The agent receives an exact USDC amount. The payer sees per-platform fiat quotes that vary.

- Checkout UI shows: "Send ~$25.50 via Venmo" with different fiat amounts per platform
- Requires: `amountUsdc`
- Better for: USDC-denominated pricing, crypto-native audiences

## Create Checkout Session

### exact-fiat Example

```typescript
const API_BASE = 'https://api.pay.zkp2p.xyz';

const response = await fetch(`${API_BASE}/v1/checkout/session`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ZKP2P_PAY_API_KEY!,
  },
  body: JSON.stringify({
    merchantId: 'your_merchant_id',
    checkoutMode: 'exact-fiat',
    fiatAmount: '25.00',
    fiatCurrency: 'USD',
    destinationChainId: 8453,
    destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    recipientAddress: AGENT_WALLET,
    metadata: { serviceId: 'task_123' },
  }),
});

const session = await response.json();

// session.checkoutUrl   -- send this to the payer
// session.orderId       -- use for tracking
// session.expiresAt     -- session expiration timestamp
```

### exact-token Example

```typescript
const response = await fetch(`${API_BASE}/v1/checkout/session`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ZKP2P_PAY_API_KEY!,
  },
  body: JSON.stringify({
    merchantId: 'your_merchant_id',
    checkoutMode: 'exact-token',
    amountUsdc: '25.00',
    destinationChainId: 8453,
    destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    recipientAddress: AGENT_WALLET,
    metadata: { serviceId: 'task_123' },
  }),
});
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your merchant ID from `POST /api/merchants` registration |
| `checkoutMode` | string | Yes | `'exact-fiat'` or `'exact-token'` |
| `fiatAmount` | string | exact-fiat only | Fiat amount the payer pays (e.g., `'25.00'`) |
| `fiatCurrency` | string | exact-fiat only | Currency code (e.g., `'USD'`, `'EUR'`, `'GBP'`) |
| `maxFeePercentage` | number | No | Max spread % for exact-fiat (default: 10) |
| `amountUsdc` | string | exact-token only | USDC amount to receive (e.g., `'25.00'`) |
| `destinationChainId` | number | Yes | Target chain (8453 = Base) |
| `destinationToken` | string | Yes | Token address (USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| `recipientAddress` | string | Yes | Wallet address to receive USDC |
| `metadata` | object | No | Arbitrary key-value pairs for your records |
| `paymentPlatforms` | string[] | No | Restrict to specific platforms (e.g., `['venmo', 'wise']`) |

## Share Payment Link

Send the `session.checkoutUrl` to the payer via any channel:

- **Telegram** -- Send as a message or inline button
- **WhatsApp** -- Send as a text link
- **Discord** -- Post in a channel or DM
- **Email** -- Embed as a hyperlink

The checkout URL opens ZKP2P Pay's hosted checkout interface where the payer selects their payment platform, completes the fiat transfer, and generates a zkTLS proof.

## Webhook Handling

Set up an HTTP endpoint to receive webhook notifications. Register the endpoint URL via the webhooks API (see Setup step 2) or in the merchant dashboard.

### Event Types

| Event | Description |
|-------|-------------|
| `order.created` | Checkout session initialized |
| `order.payment_started` | Payer initiated fiat transfer |
| `order.payment_completed` | Fiat payment confirmed by payer |
| `order.payment_failed` | Fiat payment failed or was rejected |
| `order.proof_generated` | zkTLS proof generated by payer |
| `order.proof_submitted` | Proof submitted to attestation service |
| `order.fulfilled` | USDC settled to merchant wallet on-chain |
| `order.expired` | Session expired without completion |

### Webhook Handler Example

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

app.post('/webhooks/zkp2p', (req, res) => {
  const signature = req.headers['x-zkp2p-signature'] as string;
  const timestamp = req.headers['x-zkp2p-timestamp'] as string;
  const body = JSON.stringify(req.body);

  // Verify signature
  if (!verifyWebhookSignature(body, signature, timestamp, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data } = req.body;

  switch (event) {
    case 'order.fulfilled':
      console.log(`Payment settled: ${data.orderId}`);
      console.log(`Amount: ${data.amountUsdc} USDC`);
      console.log(`Tx hash: ${data.transactionHash}`);
      // Deliver the service or product
      break;

    case 'order.payment_failed':
      console.log(`Payment failed: ${data.orderId}`);
      // Notify payer, offer retry
      break;

    case 'order.expired':
      console.log(`Session expired: ${data.orderId}`);
      // Clean up, optionally create new session
      break;

    default:
      console.log(`Event: ${event}`, data);
  }

  res.status(200).json({ received: true });
});
```

## Verify Webhook Signature

All webhooks include HMAC-SHA256 signatures for authenticity verification.

```typescript
function verifyWebhookSignature(
  body: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  const payload = `${timestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

The `WEBHOOK_SECRET` is returned when you register a webhook endpoint via the webhooks API (see Setup step 2).

## Track Order Status

You can either rely on webhooks (recommended) or poll the order status:

```typescript
const statusResponse = await fetch(
  `${API_BASE}/v1/checkout/session/${session.orderId}`,
  {
    headers: { 'x-api-key': process.env.ZKP2P_PAY_API_KEY! },
  },
);

const status = await statusResponse.json();

// status.state -- current order state
// status.transactionHash -- on-chain tx hash (when fulfilled)
// status.amountUsdc -- settled USDC amount
```

### Order State Flow

```
created -> payment_started -> payment_completed -> proof_generated -> proof_submitted -> fulfilled
                  |
                  +-> payment_failed
                  +-> expired
```

## Security

- **Always verify webhook signatures** before processing events. Never trust unverified webhook payloads.
- **Validate amounts** -- confirm the `amountUsdc` in the webhook matches what you expected for the order.
- **Use HTTPS endpoints** for webhook receivers. HTTP endpoints will be rejected.
- **Store your API key and webhook secret securely** -- use environment variables, not source code.
- **Idempotency** -- webhooks may be delivered more than once. Use `orderId` as an idempotency key.

## Customize Checkout UI

Customize the hosted checkout page colors to match your brand. Only the left panel (order summary) is customizable -- the right panel (payment flow) stays fixed for payer trust.

### Theme Presets

Three built-in presets are available:

| Preset | Description |
|--------|-------------|
| `default` | Cream background, dark text |
| `dark` | Dark background, light text, blue accents |
| `light` | White background, blue accents |

### Set Theme via Dashboard

Log in to the merchant dashboard at `merchant.pay.zkp2p.xyz` and configure colors under Settings > Checkout Theme.

### Set Theme via API

Requires Privy authentication (dashboard login). Use the merchant dashboard for initial setup, or the API for programmatic updates:

```bash
# Get available presets (public, no auth)
curl https://api.pay.zkp2p.xyz/api/checkout/theme-presets

# Set a preset (requires Privy auth)
curl -X PUT https://api.pay.zkp2p.xyz/api/merchants/me/checkout-theme \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <privy_token>" \
  -d '{"presetName": "dark"}'

# Set custom colors (requires Privy auth)
curl -X PUT https://api.pay.zkp2p.xyz/api/merchants/me/checkout-theme \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <privy_token>" \
  -d '{
    "presetName": "custom",
    "pageBackgroundColor": "#0f0f0f",
    "panelBackgroundColor": "#1a1a1a",
    "panelTextColor": "#ffffff",
    "panelTextMutedColor": "#a0a0a0",
    "panelAccentColor": "#3b82f6",
    "panelBorderColor": "#2a2a2a",
    "buttonBackgroundColor": "#3b82f6",
    "buttonTextColor": "#ffffff"
  }'
```

### Customizable Fields

| Field | Description |
|-------|-------------|
| `pageBackgroundColor` | Full page background |
| `panelBackgroundColor` | Order summary panel background |
| `panelTextColor` | Primary text color |
| `panelTextMutedColor` | Secondary/muted text color |
| `panelAccentColor` | Accent and border highlights |
| `panelBorderColor` | Panel border color |
| `buttonBackgroundColor` | Button fill color |
| `buttonTextColor` | Button text color |

All colors are hex format (`#xxxxxx`). Omitted fields inherit from the selected preset or defaults.

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `INVALID_MERCHANT_ID` | Merchant ID not found | Verify `POST /api/merchants` registration succeeded |
| `INVALID_AMOUNT` | Amount below minimum or malformed | Use a valid decimal string (e.g., `'1.00'`) |
| `SESSION_EXPIRED` | Checkout session timed out | Create a new checkout session |
| `RATE_LIMIT_EXCEEDED` | Too many API calls | Implement exponential backoff |
| `WEBHOOK_VERIFICATION_FAILED` | Signature mismatch | Check webhook secret, ensure raw body is used for HMAC |
| `INSUFFICIENT_LIQUIDITY` | No LP deposits available at requested amount | Reduce amount or try later |

For transient errors (rate limits, network timeouts), implement retry with exponential backoff. For permanent errors (invalid merchant ID, invalid amount), fix the input parameters before retrying.
