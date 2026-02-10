---
name: peer-onramp
description: On-ramp fiat to USDC via ZKP2P protocol. Agent sends fiat payment, generates headless Reclaim proof, and receives USDC on Base. Use when the user or agent needs to convert fiat (Venmo, Wise, Revolut) to USDC, buy crypto, or replenish on-chain balance.
---

# ZKP2P On-Ramp (Fiat to USDC)

Agent-driven fiat-to-crypto conversion via the ZKP2P protocol. The agent finds an LP with available USDC liquidity, signals an intent to buy, sends fiat payment off-chain, generates a Reclaim proof headlessly, and receives USDC on Base.

## Overview

The on-ramp flow consists of six steps:

```
1. GET QUOTE       → Find best LP rate for (platform, currency, amount)
2. SIGNAL INTENT   → Lock LP's USDC in escrow
3. SEND FIAT       → Agent sends fiat payment via payment platform API
4. GENERATE PROOF  → Headless Reclaim proof via @reclaimprotocol/attestor-core
5. SUBMIT PROOF    → POST proof to attestation service for EIP-712 signing
6. FULFILL INTENT  → Submit attestation on-chain, receive USDC
```

## Current Status

| Step | Status | Notes |
|------|--------|-------|
| Get Quote | AVAILABLE | `@zkp2p/sdk` |
| Signal Intent | AVAILABLE | `@zkp2p/sdk` |
| Send Fiat | PLATFORM-DEPENDENT | Requires payment platform credentials |
| Generate Proof | AVAILABLE | `@reclaimprotocol/attestor-core` (Node.js compatible) |
| Submit Proof | AVAILABLE | Attestation service REST API |
| Fulfill Intent | AVAILABLE | `@zkp2p/sdk` |

**All six steps work today.** Proof generation uses `@reclaimprotocol/attestor-core` v4.0.3, the same library the PeerAuth browser extension uses internally. It runs headlessly in Node.js.

## Platform Autonomy Matrix

Not all payment platforms have equal agent readiness:

| Platform | Auth | Payment | Proof | Agent Readiness |
|----------|:----:|:-------:|:-----:|:---------------:|
| **Wise** | Full (API token, no 2FA) | Full (REST API) | Full (headless) | **100%** |
| **PayPal Business** | Full (OAuth) | Full (REST API) | Full (headless) | **100%** |
| **Venmo** | Partial (needs cookie export or 2FA setup once) | Full (API) | Full (headless) | **80%** |
| **Revolut Business** | Partial (device trust) | Full (API) | Full (headless) | **70%** |
| **CashApp** | None (device-based) | Manual | Full once authed | **20%** |
| **Zelle (any bank)** | None (bank auth) | Manual | Full once authed | **20%** |

**Recommendation**: Start with Wise for fully autonomous agent on-ramp. Use Venmo with pre-exported cookies for semi-autonomous. Use human-in-the-loop for CashApp/Zelle/banks.

## Setup

```bash
npm install @zkp2p/sdk @reclaimprotocol/attestor-core @zkp2p/providers viem
```

```typescript
import { OfframpClient } from '@zkp2p/sdk';
import { createClaimOnAttestor } from '@reclaimprotocol/attestor-core';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const client = new OfframpClient({
  walletClient,
  chainId: 8453,
  runtimeEnv: 'production',
  apiKey: process.env.ZKP2P_API_KEY,
});
```

## Step 1: Get Quote

Find the best available LP for the desired on-ramp:

```typescript
const quote = await client.getQuote({
  paymentPlatforms: ['wise'],
  fiatCurrency: 'EUR',
  user: account.address,
  recipient: account.address,
  destinationChainId: 8453,
  destinationToken: USDC,
  amount: '500000000', // 500 USDC (6 decimals)
  isExactFiat: false,
});

// quote.depositId — which LP deposit to use
// quote.conversionRate — rate in 1e18 precision
// quote.fiatAmount — how much fiat to send
// quote.payeeDetails — hashed LP payment recipient
```

### Multi-Platform Comparison

```typescript
const quotes = await client.getQuote({
  paymentPlatforms: ['venmo', 'wise', 'revolut', 'paypal'],
  fiatCurrency: 'USD',
  user: account.address,
  recipient: account.address,
  destinationChainId: 8453,
  destinationToken: USDC,
  amount: '100000000',
  includeNearbyQuotes: true,
  nearbyQuotesCount: 5,
});
```

## Step 2: Signal Intent

Lock the LP's USDC in escrow:

```typescript
const intentTxHash = await client.signalIntent({
  depositId: quote.depositId,
  amount: quote.amount,
  toAddress: account.address,
  processorName: quote.processorName,
  payeeDetails: quote.payeeDetails,
  fiatCurrencyCode: 'EUR',
  conversionRate: quote.conversionRate,
});
// Parse intentHash from transaction receipt logs
```

**Important**: After signaling, the agent has up to 5 days (configurable per deposit) to complete payment + proof. If the intent expires, the LP reclaims the locked USDC.

## Step 3: Send Fiat Payment

The agent sends fiat to the LP's payment address. Platform-specific:

```typescript
const payeeInfo = await client.resolvePayeeHash(
  quote.depositId,
  quote.paymentMethodHash
);

const fiatAmount = Number(quote.amount) * Number(quote.conversionRate) / 1e18;
// For 500 USDC at 1.02 rate: 500 * 1.02 = €510.00
```

### Wise (Fully Autonomous)

```typescript
// Wise has a proper REST API with long-lived personal tokens
const wiseHeaders = { Authorization: `Bearer ${process.env.WISE_API_TOKEN}` };

// 1. Get profile
const profiles = await fetch('https://api.wise.com/v1/profiles', { headers: wiseHeaders });
const profileId = (await profiles.json())[0].id;

// 2. Create quote
const wiseQuote = await fetch('https://api.wise.com/v3/profiles/' + profileId + '/quotes', {
  method: 'POST',
  headers: { ...wiseHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sourceCurrency: 'EUR',
    targetCurrency: 'EUR',
    sourceAmount: fiatAmount,
    targetAccount: payeeInfo.accountId,
  }),
});

// 3. Create transfer
const transfer = await fetch('https://api.wise.com/v1/transfers', {
  method: 'POST',
  headers: { ...wiseHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetAccount: payeeInfo.accountId,
    quoteUuid: (await wiseQuote.json()).id,
    customerTransactionId: `zkp2p-${intentHash.slice(0, 8)}`,
  }),
});
```

### Venmo (Semi-Autonomous — needs pre-exported cookies)

```typescript
// Venmo requires session cookies from browser export
const venmoHeaders = {
  Cookie: process.env.VENMO_COOKIES, // 'api_access_token=...; v_id=...; login=...'
};

const payment = await fetch('https://api.venmo.com/v1/payments', {
  method: 'POST',
  headers: { ...venmoHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: payeeInfo.recipientId,
    amount: -fiatAmount, // Negative = outgoing
    note: `ZKP2P-${intentHash.slice(0, 8)}`,
  }),
});
```

## Step 4: Generate Reclaim Proof (Headless)

After payment, generate a cryptographic proof using `@reclaimprotocol/attestor-core`:

```typescript
import { createClaimOnAttestor } from '@reclaimprotocol/attestor-core';
import wiseProvider from '@zkp2p/providers/wise/transfer_wise.json' assert { type: 'json' };

// 1. Fetch transaction feed to find the payment
const txResponse = await fetch(wiseProvider.url.replace('{{PROFILE_ID}}', profileId), {
  headers: { Authorization: `Bearer ${process.env.WISE_API_TOKEN}` },
});
const transactions = await txResponse.json();

// 2. Find matching transaction by amount + recipient
const txIndex = transactions.findIndex(
  tx => tx.targetAmount === fiatAmount && tx.targetAccount === payeeInfo.accountId
);

// 3. Build claim request (same structure the PeerAuth extension uses)
const claimRequest = {
  name: 'http',
  context: {
    contextAddress: '0x0',
    contextMessage: intentHash, // Links proof to the on-chain intent
  },
  params: {
    url: wiseProvider.url.replace('{{PROFILE_ID}}', profileId),
    method: wiseProvider.method,
    body: wiseProvider.body || '',
    headers: {},
    paramValues: { PROFILE_ID: profileId },
    responseMatches: wiseProvider.responseMatches.map(m => ({
      ...m,
      value: m.value.replace(/\{\{INDEX\}\}/g, String(txIndex)),
    })),
    responseRedactions: wiseProvider.responseRedactions.map(r => ({
      jsonPath: r.jsonPath?.replace(/\{\{INDEX\}\}/g, String(txIndex)),
      xPath: r.xPath?.replace(/\{\{INDEX\}\}/g, String(txIndex)),
    })),
    ...(wiseProvider.additionalClientOptions && {
      additionalClientOptions: wiseProvider.additionalClientOptions,
    }),
  },
  secretParams: {
    headers: { Authorization: `Bearer ${process.env.WISE_API_TOKEN}` },
  },
  ownerPrivateKey: process.env.PRIVATE_KEY,
  client: {
    url: 'wss://attestation-service.zkp2p.xyz/ws', // provisional — confirm with ZKP2P team
  },
};

// 4. Generate proof (runs headlessly in Node.js)
const proof = await createClaimOnAttestor(claimRequest);

if (proof.error) {
  throw new Error(`Proof generation failed: ${proof.error}`);
}
// proof = { claim, signatures }
```

### Venmo Proof Generation

```typescript
import venmoProvider from '@zkp2p/providers/venmo/transfer_venmo.json' assert { type: 'json' };

// Venmo uses cookies instead of bearer tokens
const claimRequest = {
  name: 'http',
  context: {
    contextAddress: '0x0',
    contextMessage: intentHash,
  },
  params: {
    url: venmoProvider.url.replace('{{SENDER_ID}}', senderId),
    method: 'GET',
    body: '',
    headers: {},
    paramValues: { SENDER_ID: senderId },
    responseMatches: venmoProvider.responseMatches.map(m => ({
      ...m,
      value: m.value.replace(/\{\{INDEX\}\}/g, String(txIndex)),
    })),
    responseRedactions: venmoProvider.responseRedactions.map(r => ({
      jsonPath: r.jsonPath?.replace(/\{\{INDEX\}\}/g, String(txIndex)),
    })),
    additionalClientOptions: venmoProvider.additionalClientOptions,
  },
  secretParams: {
    cookieStr: process.env.VENMO_COOKIES,
  },
  ownerPrivateKey: process.env.PRIVATE_KEY,
  client: {
    url: 'wss://attestation-service.zkp2p.xyz/ws', // provisional — confirm with ZKP2P team
  },
};

const proof = await createClaimOnAttestor(claimRequest);
```

### Wise Two-Proof Flow

Wise requires 2 proofs (transfer list + delivery confirmation). Use `additionalProofs` from the provider template:

```typescript
// First proof: transfer list
const proof1 = await createClaimOnAttestor(mainClaimRequest);

// Second proof: delivery detail (from provider.additionalProofs[0])
const additionalProvider = wiseProvider.additionalProofs[0];
const proof2 = await createClaimOnAttestor({
  ...mainClaimRequest,
  params: {
    ...mainClaimRequest.params,
    url: additionalProvider.url.replace('{{TRANSFER_ID}}', transferId),
    responseMatches: additionalProvider.responseMatches,
    responseRedactions: additionalProvider.responseRedactions,
  },
});

// Both proofs are submitted together
const combinedProof = { proofs: [proof1, proof2] };
```

## Step 5: Submit Proof to Attestation Service

```typescript
const attestationUrl = 'https://attestation-service.zkp2p.xyz';

const response = await fetch(
  `${attestationUrl}/verify/wise/transfer_wise`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proofType: 'reclaim',
      proof: JSON.stringify(proof),
      chainId: 8453,
      verifyingContract: '0x16b3e4a3CA36D3A4bCA281767f15C7ADeF4ab163',
      intent: {
        intentHash,
        amount: String(quote.amount),
        timestampMs: String(Date.now()),
        paymentMethod: quote.paymentMethodHash,
        fiatCurrency: quote.fiatCurrencyHash,
        conversionRate: String(quote.conversionRate),
        payeeDetails: quote.payeeDetails,
        timestampBufferMs: '300000',
      },
    }),
  }
);

const attestation = await response.json();
// attestation = { intentHash, releaseAmount, dataHash, signatures, data, metadata }
```

## Step 6: Fulfill Intent

Submit the attestation on-chain. The SDK handles encoding + contract call:

```typescript
const fulfillTxHash = await client.fulfillIntent({
  intentHash,
  proof: proof, // The Reclaim { claim, signatures } object
});

// USDC is now in the agent's wallet
```

The `fulfillIntent` method internally:
1. Resolves intent parameters from chain
2. Maps paymentMethodHash to platform/actionType
3. POSTs proof to attestation service
4. Encodes attestation into PaymentAttestation struct
5. Calls Orchestrator.fulfillIntent() on-chain

## Agent Operation Modes

### Mode 1: Fully Autonomous (Wise, PayPal Business)

Human provides API token once. Agent handles everything after:

```typescript
// Human: "Here's my Wise API token: sk_live_..."
// Agent stores token → finds LP → sends fiat → generates proof → fulfills intent
// No further human interaction needed.
```

### Mode 2: Semi-Autonomous (Venmo with pre-exported cookies)

Human exports cookies periodically. Agent handles the rest:

```typescript
// Human exports cookies from browser (every few days when they expire)
// Agent: uses cookies → finds LP → sends fiat → generates proof → fulfills intent
```

### Mode 3: Human Pays, Agent Proves

Agent provides payment instructions. Human makes payment. Agent generates proof:

```typescript
// Agent: "Send $102 to @lp-venmo-username with note ZKP2P-ABC"
// Human: sends payment via Venmo app
// Human: provides fresh session cookies
// Agent: fetches transaction feed → generates proof → fulfills intent
```

## Taker Tiers

ZKP2P uses a tier system that limits per-intent amounts based on taker history. New addresses start at the lowest tier and graduate as they successfully complete intents.

| Tier | Name | Per-Intent Cap | Requirements |
|------|------|---------------|--------------|
| 0 | PEASANT | ~$50 | New address, no history |
| 1 | PEER | ~$250 | 1+ successful intents |
| 2 | PLUS | ~$1,000 | Volume + success rate threshold |
| 3 | PRO | ~$5,000 | Sustained volume + high success rate |
| 4 | PLATINUM | ~$10,000 | High volume, excellent completion rate |
| 5 | PEER_PRESIDENT | ~$25,000+ | Top tier, highest caps |

Caps also vary by platform risk level. Higher-risk platforms (CashApp, Zelle) have lower caps per tier than lower-risk platforms (Wise, Revolut).

### Check Taker Tier

Taker tier data is available via the Peerlytics API:

```typescript
import { Peerlytics } from '@peerlytics/sdk';

const peerlytics = new Peerlytics({ apiKey: process.env.PEERLYTICS_API_KEY });
const history = await peerlytics.getTakerHistory(account.address);

// history.stats.lockScore -> numeric trust score
// history.stats.tier -> 'PEASANT' | 'PEER' | 'PLUS' | 'PRO' | 'PLATINUM' | 'PEER_PRESIDENT'
// history.stats.tierProgress -> { currentTier, nextTier, progress, volumeNeeded }
// history.intents -> { total, fulfilled, pruned, successRate, volumeUsd }
```

### Cooldown Between Intents

After an intent is pruned (expired without fulfillment), there is a cooldown period before the taker can signal another intent. Repeated prunes lower the trust score and may reduce the taker's tier.

## Security Rules

1. **Encrypt credentials at rest.** Payment platform tokens give access to financial accounts.
2. **Set transaction limits.** Cap per-intent and daily volume to limit exposure.
3. **Monitor token expiry.** Gracefully degrade to human-in-the-loop when re-auth is needed.
4. **Validate LP before payment.** Check deposit is still active and has sufficient liquidity.
5. **Watch intent expiration.** Cancel intent and alert if proof cannot be generated in time.
6. **Never log credentials.** Auth tokens, cookies, and private keys must never appear in logs.

## Open Questions

1. **Attestor endpoint URL**: The exact WebSocket URL for `createClaimOnAttestor`'s `client.url` may vary. Confirm with ZKP2P team whether it's `wss://attestation-service.zkp2p.xyz/ws` or a separate attestor endpoint.
2. **Owner private key**: The extension uses a hardcoded key. Agents should use their own wallet private key or a dedicated signing key.
3. **Rate limiting**: Server-side proof generation from data center IPs may trigger rate limits on the attestor. Test concurrency limits.

## Environment

| | Production | Staging |
|--|-----------|---------|
| Chain | Base (8453) | Base Sepolia (84532) |
| Escrow | `0x2f121CDDCA6d652f35e8B3E560f9760898888888` | `0x5C2a8B9246777eE4501B6C426a8B8C7635C7b5b5` |
| Orchestrator | `0x88888883Ed048FF0a415271B28b2F52d431810D0` | - |
| UnifiedPaymentVerifier | `0x16b3e4a3CA36D3A4bCA281767f15C7ADeF4ab163` | - |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | - |
| Core API | `https://api.zkp2p.xyz` | `https://api-staging.zkp2p.xyz` |
| Attestation Service | `https://attestation-service.zkp2p.xyz` | `https://attestation-service-staging.zkp2p.xyz` |
