---
name: pay-humans-fiat
description: Pay humans in their local fiat currency (USD, EUR, GBP, etc.) from your USDC balance. Cheaper and faster than Stripe or PayPal. No KYC required. Use when the agent needs to pay a freelancer, send a bank transfer, pay for a real-world service, or compensate a human worker.
---

# Pay Humans in Fiat

Agent has USDC. Human wants dollars, euros, or pounds in their bank account, Venmo, Wise, or Revolut. This skill bridges that gap -- the agent spends USDC, the human receives fiat. No bank account needed on the agent side.

## Why Not Stripe or PayPal?

| Method | Fee | Settlement | KYC Required | Agent-Native |
|--------|-----|------------|:---:|:---:|
| Stripe Connect | 2.9% + $0.30 | 2-3 business days | Yes | No |
| PayPal Payouts | 2% | 1-3 business days | Yes | No |
| Wire Transfer | $15-45 flat | 1-5 business days | Yes | No |
| **Peer Protocol** | **~1% spread** | **Minutes** | **No** | **Yes** |

Agents cannot complete KYC. They have no government ID, no SSN, no selfie. Peer Protocol requires none of that -- it is pure on-chain escrow with off-chain fiat settlement proven via zkTLS.

## How It Works

```
1. FIND LP        Agent queries for a liquidity provider offering the best rate
2. LOCK USDC      Agent locks USDC in an on-chain escrow contract
3. LP SENDS FIAT  LP sends fiat to the human's payment account (Venmo, Wise, bank, etc.)
4. PROOF + SETTLE LP proves payment via zkTLS, escrow releases USDC to LP
```

Result: the human gets fiat, the agent's USDC covers it. The agent never touches fiat rails and does not generate any proofs -- the LP handles that.

## Supported Payment Platforms

| Platform | Regions | Example Currencies |
|----------|---------|--------------------|
| Venmo | US | USD |
| CashApp | US | USD |
| Zelle | US | USD |
| PayPal | Global | USD, EUR, GBP, AUD |
| Wise | Global | USD, EUR, GBP, INR, BRL, 35+ |
| Revolut | EU/UK/US | EUR, GBP, USD |
| Monzo | UK | GBP |
| N26 | EU | EUR |
| MercadoPago | LATAM | BRL, ARS, MXN |

## Quick Example

```typescript
import { OfframpClient } from '@zkp2p/sdk';

const client = new OfframpClient({
  walletClient,           // viem wallet on Base
  chainId: 8453,
  runtimeEnv: 'production',
  apiKey: process.env.ZKP2P_API_KEY,
});

// 1. Find best LP for Venmo/USD
const quote = await client.getQuote({
  paymentPlatforms: ['venmo'],
  fiatCurrency: 'USD',
  user: agentAddress,
  recipient: agentAddress,
  destinationChainId: 8453,
  destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: '150000000',    // 150 USDC (6 decimals)
});

// 2. Approve USDC to escrow
await client.ensureAllowance({
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: 150_000000n,
});

// 3. Lock USDC and tell the LP who to pay
const intentTx = await client.signalIntent({
  depositId: quote.depositId,
  amount: '150000000',
  toAddress: agentAddress,
  processorName: 'venmo',
  payeeDetails: quote.payeeDetails,
  fiatCurrencyCode: 'USD',
  conversionRate: quote.conversionRate,
});
// Done. LP sends fiat to the human, proves it, and collects the escrowed USDC.
```

## Cost Example

To pay a freelancer **$150 via Venmo**:

- Agent spends: ~152 USDC (1.3% spread)
- Freelancer receives: $150 in their Venmo account
- Settlement time: minutes
- Gas cost: <$0.01 (Base L2)

## Full Implementation Details

See the **`peer-offramp`** skill for the complete SDK reference, including:

- Payee detail hashing and registration
- Intent monitoring and fulfillment polling
- Intent cancellation and USDC recovery
- Rate selection strategy
- Direct indexer queries (GraphQL)
- Error handling and edge cases

## Environment Variables

```bash
export PRIVATE_KEY="0x..."        # Agent wallet private key (Base)
export ZKP2P_API_KEY="..."        # ZKP2P API key for LP queries
```

## Key Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| Escrow | `0x2f121CDDCA6d652f35e8B3E560f9760898888888` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
