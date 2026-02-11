# ZKP2P Pay REST API Reference

All endpoints use base URL `https://api.pay.zkp2p.xyz`. Checkout and webhook endpoints require the `x-api-key` header with your merchant API key.

## Register Merchant

```
POST /api/merchants
```

No authentication required. Creates a new merchant and returns an API key.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Merchant or agent name |
| `logoUrl` | string | No | URL to merchant logo |

### Example

```bash
curl -X POST https://api.pay.zkp2p.xyz/api/merchants \
  -H "Content-Type: application/json" \
  -d '{"name": "My AI Agent"}'
```

### Response

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

**Important:** The `apiKey` is only returned at creation time. Store it securely.

---

## Create Checkout Session

```
POST /v1/checkout/session
```

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier from `POST /api/merchants` |
| `amountUsdc` | string | Yes | USDC amount as decimal string (e.g., `'25.00'`) |
| `destinationChainId` | number | Yes | Target chain ID. Base = `8453` |
| `destinationToken` | string | Yes | Token contract address. USDC on Base = `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `recipientAddress` | string | Yes | Wallet address to receive settled USDC |
| `metadata` | Record<string, string> | No | Arbitrary key-value pairs attached to the order |
| `paymentPlatforms` | string[] | No | Restrict to specific platforms (e.g., `['venmo', 'wise']`) |
| `fiatCurrency` | string | No | Restrict to specific fiat currency (e.g., `'USD'`) |
| `callbackUrl` | string | No | URL to redirect payer after completion |

### Example

```typescript
const response = await fetch('https://api.pay.zkp2p.xyz/v1/checkout/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ZKP2P_PAY_API_KEY!,
  },
  body: JSON.stringify({
    merchantId: 'your_merchant_id',
    amountUsdc: '25.00',
    destinationChainId: 8453,
    destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    recipientAddress: AGENT_WALLET,
    metadata: { serviceId: 'task_123' },
  }),
});

const session = await response.json();
```

### Response: CheckoutSession

```typescript
interface CheckoutSession {
  orderId: string;           // Unique order identifier
  checkoutUrl: string;       // Hosted checkout URL to share with payer
  expiresAt: string;         // ISO 8601 expiration timestamp
  status: OrderStatus;       // Initial status: 'created'
  amountUsdc: string;        // Confirmed USDC amount
  destinationChainId: number;
  destinationToken: string;
  recipientAddress: string;
  metadata: Record<string, string>;
}
```

---

## Get Order Status

```
GET /v1/checkout/session/{orderId}
```

### Example

```typescript
const response = await fetch(
  `https://api.pay.zkp2p.xyz/v1/checkout/session/${orderId}`,
  { headers: { 'x-api-key': process.env.ZKP2P_PAY_API_KEY! } },
);

const status = await response.json();
```

### Response: OrderStatusResponse

```typescript
interface OrderStatusResponse {
  orderId: string;
  state: OrderState;
  amountUsdc: string;
  transactionHash: string | null;    // On-chain tx hash (populated on fulfillment)
  paymentPlatform: string | null;    // Platform chosen by payer
  fiatCurrency: string | null;
  fiatAmount: string | null;         // Fiat amount paid
  conversionRate: string | null;     // Effective conversion rate used
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
  expiresAt: string;                 // ISO 8601
}

type OrderState =
  | 'created'
  | 'payment_started'
  | 'payment_completed'
  | 'payment_failed'
  | 'proof_generated'
  | 'proof_submitted'
  | 'fulfilled'
  | 'expired';
```

---

## Webhook Event Schemas

All webhooks are POST requests with JSON body and verification headers.

### Headers

| Header | Description |
|--------|-------------|
| `x-zkp2p-signature` | HMAC-SHA256 hex digest of `{timestamp}.{body}` |
| `x-zkp2p-timestamp` | Unix timestamp (seconds) when webhook was sent |
| `Content-Type` | `application/json` |

### Base Webhook Payload

```typescript
interface WebhookPayload {
  event: WebhookEvent;
  data: WebhookData;
  webhookId: string;        // Unique webhook delivery ID
  timestamp: string;        // ISO 8601 timestamp
}
```

### Event: order.created

Fired when a checkout session is initialized.

```json
{
  "event": "order.created",
  "data": {
    "orderId": "ord_abc123",
    "merchantId": "merch_xyz",
    "amountUsdc": "25.00",
    "destinationChainId": 8453,
    "recipientAddress": "0x...",
    "checkoutUrl": "https://pay.zkp2p.xyz/checkout/ord_abc123",
    "expiresAt": "2026-02-10T12:00:00Z",
    "metadata": { "serviceId": "task_123" }
  }
}
```

### Event: order.payment_started

Fired when the payer selects a payment platform and begins the transfer.

```json
{
  "event": "order.payment_started",
  "data": {
    "orderId": "ord_abc123",
    "paymentPlatform": "venmo",
    "fiatCurrency": "USD",
    "fiatAmount": "25.50",
    "conversionRate": "1.020000000000000000"
  }
}
```

### Event: order.payment_completed

Fired when the payer confirms they completed the fiat transfer.

```json
{
  "event": "order.payment_completed",
  "data": {
    "orderId": "ord_abc123",
    "paymentPlatform": "venmo",
    "fiatCurrency": "USD",
    "fiatAmount": "25.50"
  }
}
```

### Event: order.payment_failed

Fired when the fiat payment fails or is rejected.

```json
{
  "event": "order.payment_failed",
  "data": {
    "orderId": "ord_abc123",
    "reason": "insufficient_funds",
    "paymentPlatform": "venmo"
  }
}
```

### Event: order.proof_generated

Fired when the payer generates a zkTLS proof via PeerAuth extension.

```json
{
  "event": "order.proof_generated",
  "data": {
    "orderId": "ord_abc123",
    "proofType": "reclaim"
  }
}
```

### Event: order.proof_submitted

Fired when the proof is submitted to the attestation service for verification.

```json
{
  "event": "order.proof_submitted",
  "data": {
    "orderId": "ord_abc123",
    "attestationStatus": "verifying"
  }
}
```

### Event: order.fulfilled

Fired when USDC settles on-chain to the merchant wallet. This is the terminal success event.

```json
{
  "event": "order.fulfilled",
  "data": {
    "orderId": "ord_abc123",
    "amountUsdc": "25.00",
    "transactionHash": "0xabc123...",
    "chainId": 8453,
    "recipientAddress": "0x...",
    "paymentPlatform": "venmo",
    "fiatCurrency": "USD",
    "fiatAmount": "25.50",
    "conversionRate": "1.020000000000000000",
    "intentHash": "0xdef456...",
    "depositId": "123",
    "settledAt": "2026-02-10T11:35:00Z"
  }
}
```

### Event: order.expired

Fired when the checkout session expires without successful fulfillment.

```json
{
  "event": "order.expired",
  "data": {
    "orderId": "ord_abc123",
    "expiresAt": "2026-02-10T12:00:00Z",
    "lastState": "payment_started"
  }
}
```

---

## HMAC-SHA256 Signature Specification

### Signing Algorithm

1. Concatenate the timestamp and raw request body with a period separator: `{timestamp}.{body}`
2. Compute HMAC-SHA256 using the webhook secret as the key
3. Output as lowercase hex digest

### Verification Code

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  webhookSecret: string
): boolean {
  // Reject stale webhooks (optional, recommended: 5 minute window)
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf-8'),
    Buffer.from(expected, 'utf-8')
  );
}
```

### Important Notes

- Use the **raw request body** (not parsed JSON) for HMAC computation
- Use `crypto.timingSafeEqual()` to prevent timing attacks
- Reject webhooks with timestamps older than 5 minutes to prevent replay attacks
- The webhook secret is provided during merchant registration

---

## Order Status Flow

```
                    +---> payment_failed
                    |
created ---> payment_started ---> payment_completed ---> proof_generated ---> proof_submitted ---> fulfilled
                    |
                    +---> expired

Legend:
  created            Session initialized, checkout URL active
  payment_started    Payer selected platform and began fiat transfer
  payment_completed  Payer confirmed fiat transfer complete
  payment_failed     Fiat transfer failed (insufficient funds, cancelled, etc.)
  proof_generated    zkTLS proof generated via PeerAuth extension
  proof_submitted    Proof sent to attestation service for verification
  fulfilled          USDC settled on-chain to merchant wallet (terminal success)
  expired            Session timed out without completion (terminal failure)
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/merchants` | Register a new merchant (no auth required) |
| GET | `/api/merchants/:id` | Get merchant details |
| POST | `/v1/checkout/session` | Create a new checkout session |
| GET | `/v1/checkout/session/{orderId}` | Get order status |
| GET | `/v1/checkout/sessions` | List sessions for merchant (paginated) |
| POST | `/v1/checkout/session/{orderId}/cancel` | Cancel an active session |
| GET | `/v1/merchant/webhooks` | List registered webhook endpoints |
| POST | `/v1/merchant/webhooks` | Register a webhook endpoint |
| DELETE | `/v1/merchant/webhooks/{webhookId}` | Remove a webhook endpoint |

Base URL: `https://api.pay.zkp2p.xyz`

All endpoints require the `x-api-key` header with your merchant API key.

---

## Supported Payment Platforms

| Platform | Currencies | Notes |
|----------|-----------|-------|
| Venmo | USD | US-only |
| CashApp | USD | US-only |
| PayPal | USD, EUR, GBP | International |
| Wise | USD, EUR, GBP, SGD, and 30+ others | Widest currency coverage |
| Revolut | USD, EUR, GBP | International |
| Zelle | USD | US banks (Chase, BofA, Citi) |
| Monzo | GBP | UK-only |
| N26 | EUR | EU-only |

## Supported Output Chains

Base (8453), Ethereum (1), Polygon (137), Arbitrum (42161), Optimism (10), Avalanche (43114), Solana, and 15+ more. Output tokens include USDC, USDT, ETH, SOL. Gasless settlement available on some chains.

---

## Settlement Flow (Under the Hood)

1. Merchant calls `createCheckoutSession()` -- API creates an order and returns `checkoutUrl`
2. Payer opens `checkoutUrl` -- hosted checkout UI shows payment instructions
3. Payer sends fiat via their chosen platform (e.g., Venmo)
4. Payer generates zkTLS proof via PeerAuth browser extension
5. Proof is submitted to attestation service (`attestation-service.zkp2p.xyz`) which verifies the zkTLS proof and generates a signed `PaymentAttestation` (EIP-712)
6. Attestation is submitted on-chain to `Orchestrator.fulfillIntent()` on Base
7. `UnifiedPaymentVerifier` validates the attestation, `SimpleAttestationVerifier` checks witness signatures
8. Escrow releases USDC to the merchant's `recipientAddress`
9. Webhook fires `order.fulfilled` with transaction hash
