---
name: peer-offramp
description: Off-ramp USDC to fiat via ZKP2P protocol. Pay humans in their local fiat currency by matching with LP liquidity. Use when the agent needs to pay a human freelancer, convert USDC to fiat, or send fiat payments to non-crypto users.
---

# ZKP2P Off-Ramp (USDC to Fiat)

Agent holds USDC on Base and needs to pay a human in fiat (USD, EUR, GBP, etc.). The agent signals an intent to sell USDC, an LP sends fiat to the recipient, the LP proves the payment, and the escrowed USDC transfers to the LP.

## Overview

The off-ramp flow is the mirror of the on-ramp:

```
1. FIND LP         → Query deposits accepting the target currency/platform
2. SIGNAL INTENT   → Agent locks its own USDC in escrow, specifying the fiat recipient
3. LP SENDS FIAT   → LP sends fiat to the agent's specified recipient
4. LP PROVES       → LP generates proof of fiat payment
5. LP FULFILLS     → LP submits proof on-chain, receives the escrowed USDC
6. CONFIRMATION    → Agent monitors intent status for fulfillment
```

**Key difference from on-ramp**: In the off-ramp, the agent is the one locking USDC (acting as the "maker"), and the LP is the one sending fiat and proving payment (acting as the "taker"). The agent does NOT need to generate proofs -- the LP handles that.

## Current Status

| Step | Status | Notes |
|------|--------|-------|
| Find LP | AVAILABLE | Query via indexer or `getQuote()` |
| Signal Intent | AVAILABLE | `signalIntent()` in `@zkp2p/sdk` |
| LP Sends Fiat | LP-SIDE | Agent waits; LP handles fiat transfer |
| LP Proves | LP-SIDE | LP generates proof via PeerAuth extension |
| LP Fulfills | LP-SIDE | LP calls `fulfillIntent()` on-chain |
| Confirmation | AVAILABLE | Monitor intent status via indexer or RPC |

**Bottom line**: The agent-side operations (Steps 1-2, 6) work today via the SDK. Steps 3-5 are handled by the LP. A higher-level "pay human" API that abstracts the full flow is planned but not yet available.

## Step 1: Find LP

Query for available LP deposits that accept the target payment platform and currency:

```typescript
import { OfframpClient } from '@zkp2p/sdk';

const client = new OfframpClient({
  walletClient,
  chainId: 8453,
  runtimeEnv: 'production',
  apiKey: 'YOUR_API_KEY',
});

// Find best LP to off-ramp 200 USDC to EUR via Wise
const quote = await client.getQuote({
  paymentPlatforms: ['wise'],
  fiatCurrency: 'EUR',
  user: agentAddress,
  recipient: agentAddress,              // Agent is the USDC holder
  destinationChainId: 8453,
  destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: '200000000',                  // 200 USDC (6 decimals)
});

console.log(`Best rate: ${quote.conversionRate}`);
console.log(`LP deposit: ${quote.depositId}`);
console.log(`Fiat recipient gets: ~${Number(quote.fiatAmount) / 100} EUR`);
```

### Alternative: Direct Indexer Query

For more control over LP selection, query the indexer directly:

```graphql
# Find deposits accepting Wise + EUR
query FindLPs {
  MethodCurrency(
    where: {
      paymentMethodHash: { _eq: "0x..." }  # keccak256("wise")
      currencyCode: { _eq: "EUR" }
      conversionRate: { _gt: "0" }
    }
    order_by: { conversionRate: asc }
  ) {
    depositId
    conversionRate
    managerRate
    rateManagerId
  }
}
```

```typescript
// Compute payment method hash
import { keccak256, toBytes } from 'viem';
const wiseHash = keccak256(toBytes('wise'));
const eurHash = keccak256(toBytes('EUR'));
```

### Rate Selection Strategy

When choosing an LP, consider:

| Factor | How to Evaluate |
|--------|----------------|
| **Rate** | Lower `conversionRate` = better for agent (less fiat per USDC) |
| **Available balance** | Check deposit's unlocked USDC balance covers the amount |
| **Intent range** | Verify amount falls within deposit's `[min, max]` intent range |
| **Active intents** | Fewer active intents = faster fulfillment likelihood |
| **LP history** | Check LP's fulfillment rate via indexer |

## Step 2: Signal Intent

The agent locks its USDC in escrow and specifies the fiat payment recipient:

```typescript
// First, ensure the agent has approved USDC to the Escrow contract
await client.ensureAllowance({
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
  amount: 200_000000n,  // 200 USDC
});

// Signal intent to sell 200 USDC
const intentTx = await client.signalIntent({
  depositId: quote.depositId,
  amount: '200000000',                   // 200 USDC
  toAddress: agentAddress,               // Receives USDC back if intent cancelled
  processorName: 'wise',
  payeeDetails: recipientPayeeHash,      // Hashed fiat recipient details (see below)
  fiatCurrencyCode: 'EUR',
  conversionRate: quote.conversionRate,
});

console.log(`Intent signaled: ${intentTx}`);
```

### What Happens On-Chain

1. Agent's USDC is transferred to the Escrow contract
2. The Orchestrator creates an intent record with:
   - `depositId`: which LP deposit to match with
   - `amount`: USDC locked
   - `payeeDetails`: hashed fiat recipient info (the person the LP must pay)
   - `conversionRate`: agreed rate
   - `paymentMethod`: which platform the LP must use
3. The LP can now see this intent and knows exactly who to pay and how much

## Payee Details — Hashing Recipient Payment Info

The `payeeDetails` field is a hash of the fiat payment recipient's platform-specific identifier. This preserves privacy while allowing the LP to verify they paid the correct person.

```typescript
import { keccak256, toBytes, encodePacked } from 'viem';

// For Venmo: hash the recipient's Venmo username or user ID
const venmoPayeeHash = keccak256(encodePacked(
  ['string'],
  ['venmo_username_here']
));

// For Wise: hash the recipient's email or account number
const wisePayeeHash = keccak256(encodePacked(
  ['string'],
  ['recipient@email.com']
));

// For bank transfers (Zelle, etc.): hash the recipient's email or phone
const zellePayeeHash = keccak256(encodePacked(
  ['string'],
  ['+1234567890']
));
```

**Important**: The LP needs the actual (unhashed) payee details to send the fiat payment. The ZKP2P API stores encrypted payee details and exposes them only to the matched LP. Use the `apiPostDepositDetails()` adapter to register payee details:

```typescript
// Register payee details with ZKP2P API (encrypted, LP-only access)
import { apiPostDepositDetails } from '@zkp2p/sdk';

const result = await apiPostDepositDetails(
  {
    depositId: quote.depositId.toString(),
    paymentMethodHash: wiseHash,
    payeeDetails: 'recipient@email.com',  // Plaintext -- API encrypts
    chainId: 8453,
    escrowAddress: '0x2f121CDDCA6d652f35e8B3E560f9760898888888',
  },
  'https://api.zkp2p.xyz',
  15000
);
// result.hashedOnchainId is the hash to use as payeeDetails in signalIntent
```

## Step 3-5: LP Handles Fiat Payment and Proof

After the agent signals an intent, the LP-side flow is:

1. **LP detects the intent** (via indexer, ProtocolViewer, or event listener)
2. **LP sends fiat** to the specified recipient via the required payment platform
3. **LP generates proof** using the PeerAuth browser extension
4. **LP calls `fulfillIntent()`** with the proof, releasing USDC to the LP

The agent does NOT need to do anything during Steps 3-5 -- the LP handles everything.

## Step 6: Monitor Intent Status

The agent should monitor the intent to confirm fulfillment:

```typescript
// Poll intent status
async function waitForFulfillment(
  client: OfframpClient,
  intentHash: `0x${string}`,
  timeoutMs: number = 86400000 // 24 hours
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const intent = await client.getIntent(intentHash);

    if (intent.status === 'FULFILLED') {
      console.log('Intent fulfilled! Fiat has been sent to recipient.');
      return true;
    }

    if (intent.status === 'CANCELLED' || intent.status === 'EXPIRED') {
      console.log(`Intent ${intent.status}. USDC returned to agent.`);
      return false;
    }

    // Wait 60 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 60000));
  }

  console.log('Timeout waiting for fulfillment.');
  return false;
}
```

### Via Indexer (GraphQL)

```graphql
query IntentStatus($intentHash: String!) {
  Intent(where: { intentHash: { _eq: $intentHash } }) {
    intentHash
    status
    amount
    conversionRate
    paymentMethod
    fiatCurrency
    createdAt
    fulfilledAt
    cancelledAt
  }
}
```

### Fulfillment Events

```graphql
query FulfillmentDetails($intentHash: String!) {
  IntentFulfilled(where: { intentHash: { _eq: $intentHash } }) {
    intentHash
    depositId
    amount
    transactionHash
    blockNumber
    timestamp
  }
}
```

## Complete Off-Ramp Flow (Agent Pays Freelancer)

```typescript
import { OfframpClient } from '@zkp2p/sdk';
import { createWalletClient, http, keccak256, toBytes } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Setup
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

// Scenario: Pay a freelancer $150 USD via Venmo
const FREELANCER_VENMO = '@freelancer-username';
const PAYMENT_AMOUNT_USDC = 150_000000n; // 150 USDC

// 1. Find best LP accepting Venmo/USD
const quote = await client.getQuote({
  paymentPlatforms: ['venmo'],
  fiatCurrency: 'USD',
  user: account.address,
  recipient: account.address,
  destinationChainId: 8453,
  destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: PAYMENT_AMOUNT_USDC.toString(),
});

console.log(`LP found: deposit ${quote.depositId}`);
console.log(`Rate: ${quote.conversionRate} (1e18 precision)`);
console.log(`Freelancer receives: ~$${Number(quote.fiatAmount) / 100} USD`);

// 2. Approve USDC
await client.ensureAllowance({
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: PAYMENT_AMOUNT_USDC,
});

// 3. Signal intent — locks USDC, tells LP to pay the freelancer
const intentTx = await client.signalIntent({
  depositId: quote.depositId,
  amount: PAYMENT_AMOUNT_USDC.toString(),
  toAddress: account.address,
  processorName: 'venmo',
  payeeDetails: quote.payeeDetails,   // Freelancer's hashed Venmo details
  fiatCurrencyCode: 'USD',
  conversionRate: quote.conversionRate,
});

console.log(`Intent signaled: ${intentTx}`);
console.log('Waiting for LP to send fiat to freelancer...');

// 4. Wait for LP to send fiat and prove payment
// (LP handles Steps 3-5 of the protocol)
// Agent just monitors intent status
```

## Intent Cancellation

If the LP does not fulfill the intent within the expiration window, the agent can cancel and recover the USDC:

```typescript
// Cancel an expired intent
const cancelTx = await client.cancelIntent({
  intentHash: intentHash,
});
console.log(`Intent cancelled, USDC recovered: ${cancelTx}`);
```

Alternatively, the depositor (LP) can release funds back:

```typescript
// LP releases funds back to the agent (depositor-initiated)
const releaseTx = await client.releaseFundsToPayer({
  intentHash: intentHash,
});
```

## Limitations

1. **No direct "pay human" API.** Currently the agent must manually find an LP, signal an intent, and register payee details. A higher-level API (`POST /v1/agent/checkout`) that wraps these steps is planned.

2. **LP fulfillment is not guaranteed.** After the agent signals an intent and locks USDC, the LP may not fulfill. The agent's USDC is recoverable after intent expiration via `cancelIntent()`.

3. **Fiat amount depends on rate.** The fiat amount the freelancer receives is `usdcAmount * conversionRate / 1e18`. At a 1.02 rate, 150 USDC results in ~$153 USD being sent. The agent pays the spread as a fee to the LP.

4. **Payee details registration.** The agent must register the fiat recipient's plaintext payment details with the ZKP2P API so the LP knows where to send fiat. This uses the `apiPostDepositDetails()` adapter.

5. **Limited platform coverage.** Not all payment platforms support all currencies. Check the LP's deposit configuration to ensure the (platform, currency) pair is active.

## Future: Agent Off-Ramp Checkout API

A planned API will simplify the off-ramp to a single call:

```typescript
// FUTURE — not yet available
const checkout = await fetch('https://api.zkp2p.xyz/v1/agent/checkout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    amount: '150000000',          // 150 USDC
    currency: 'USD',
    platform: 'venmo',
    recipient: '@freelancer-username',
    senderAddress: agentAddress,
  }),
});

// Returns: { intentHash, estimatedFiatAmount, lpDepositId, rate }
// Agent signs a single transaction to lock USDC
// API handles LP matching, payee registration, and monitoring
```

## Contract Reference

| Contract | Address | Chain |
|----------|---------|-------|
| Escrow | `0x2f121CDDCA6d652f35e8B3E560f9760898888888` | Base |
| Orchestrator | `0x88888883Ed048FF0a415271B28b2F52d431810D0` | Base |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Base |
| ProtocolViewer | `0x30B03De22328074Fbe8447C425ae988797146606` | Base |
| API | `https://api.zkp2p.xyz` | - |

## Amount Calculations

```
fiatAmount = usdcAmount * conversionRate / 1e18
usdcAmount = fiatAmount * 1e18 / conversionRate
```

Example: 150 USDC at 1.02 rate:
- `150_000000 * 1_020000000000000000 / 1_000000000000000000 = 153_000000` (in USDC decimals)
- Freelancer receives $153.00 USD

Note: USDC amounts use 6 decimals. `150 USDC = 150_000000` in raw units.
