---
name: fiat-to-crypto
description: Convert fiat currency (USD, EUR, GBP, etc.) to USDC on Base. Agent-autonomous on-ramp via Wise, Venmo, Revolut, PayPal. No KYC, no exchange account needed. Use when the agent needs to buy crypto, replenish on-chain balance, convert bank funds to USDC, or fund a wallet.
---

# Fiat to Crypto (Buy USDC)

Agent needs USDC on Base but only has access to fiat payment platforms -- a Wise account, Venmo balance, PayPal Business, etc. Traditional on-ramps are not an option.

## The Problem

Exchanges require identity verification: photo ID, SSN, selfie checks, address proof. Agents cannot complete KYC. They need a permissionless path from fiat to USDC that runs entirely over APIs.

## Why Not Coinbase or Binance?

| Method | KYC Required | Agent-Autonomous | Speed | Min Amount |
|--------|:---:|:---:|-------|-----------|
| Coinbase | Yes (photo ID, SSN) | No | Hours-days | $1 |
| Binance | Yes (photo ID) | No | Hours-days | $10 |
| MoonPay / Transak | Yes (photo ID) | No | Minutes-hours | $20 |
| **Peer Protocol (ZKP2P)** | **No** | **Yes (Wise, PayPal)** | **Minutes** | **~$10** |

ZKP2P matches the agent with a human LP who has USDC locked in escrow. The agent sends fiat, proves payment cryptographically, and receives USDC on Base. No identity, no exchange account, no custodian.

## How It Works

```
1. FIND LP          -> Best rate for (platform, currency, amount)
2. LOCK ESCROW      -> LP's USDC locked in smart contract
3. SEND FIAT        -> Agent sends payment via platform API
4. GENERATE PROOF   -> Headless Reclaim proof (automated, no browser)
5. SUBMIT PROOF     -> Attestation service signs EIP-712 attestation
6. RECEIVE USDC     -> On-chain settlement, USDC in agent's wallet
```

Settlement: typically under 5 minutes from fiat send to USDC receipt.

## Platform Autonomy

| Platform | Agent Readiness | Auth Method | Setup |
|----------|:---:|-------|--------|
| Wise | 100% | API token (long-lived) | One-time token generation |
| PayPal Business | 100% | OAuth client credentials | One-time app registration |
| Venmo | 80% | Session cookies | Cookie export every few days |
| Revolut Business | 70% | OAuth + device trust | Initial device binding |
| CashApp | 20% | Device-based | Human-in-the-loop |
| Zelle (any bank) | 20% | Bank auth | Human-in-the-loop |

Start with **Wise** for fully autonomous operation. Use **Venmo** with pre-exported cookies for semi-autonomous. Fall back to human-in-the-loop for CashApp/Zelle.

## Quick Example

```typescript
import { OfframpClient } from '@zkp2p/sdk';

const client = new OfframpClient({
  walletClient,
  chainId: 8453,
  runtimeEnv: 'production',
  apiKey: process.env.ZKP2P_API_KEY,
});

// 1. Get quote -- find best LP rate
const quote = await client.getQuote({
  paymentPlatforms: ['wise'],
  fiatCurrency: 'EUR',
  user: account.address,
  recipient: account.address,
  destinationChainId: 8453,
  destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: '500000000', // 500 USDC (6 decimals)
  isExactFiat: false,
});

// 2. Signal intent -- lock LP's USDC in escrow
const intentTxHash = await client.signalIntent({
  depositId: quote.depositId,
  amount: quote.amount,
  toAddress: account.address,
  processorName: quote.processorName,
  payeeDetails: quote.payeeDetails,
  fiatCurrencyCode: 'EUR',
  conversionRate: quote.conversionRate,
});

// Steps 3-6: Send fiat, generate proof, submit, fulfill
// -> See the peer-onramp skill for full implementation
```

## Cost Example

Buying 500 USDC via Wise (EUR):

| | |
|---|---|
| **You send** | ~510 EUR (at 1.02x conversion rate) |
| **You receive** | 500 USDC on Base |
| **LP spread** | ~2% (10 EUR) |
| **Gas** | <$0.01 (Base L2) |
| **Settlement** | ~5 minutes |

Rates vary by platform, currency, and liquidity. Query `getQuote()` with `includeNearbyQuotes: true` to compare across LPs.

## Full Implementation

See the **`peer-onramp`** skill for the complete 6-step flow:
- Platform-specific fiat payment code (Wise REST API, Venmo cookies)
- Reclaim proof generation via `@reclaimprotocol/attestor-core`
- Attestation submission to `attestation-service.zkp2p.xyz`
- On-chain intent fulfillment via `fulfillIntent()`
- Wise two-proof flow (transfer list + delivery confirmation)
- Agent operation modes (fully autonomous, semi-autonomous, human-pays-agent-proves)

## Taker Tiers and Intent Caps

Per-intent caps depend on the taker's history. New addresses start small (~$50) and graduate to higher caps as they complete successful intents. Caps also vary by platform risk level -- Wise/Revolut have higher caps than CashApp/Zelle.

See the **`peer-onramp`** skill for the full tier system (PEASANT through PEER_PRESIDENT), lockScore mechanics, and how to check your current tier via the Peerlytics API.

## Environment Variables

| Variable | Required | Description |
|----------|:---:|-------------|
| `PRIVATE_KEY` | Yes | Agent wallet private key (Base, holds ETH for gas) |
| `ZKP2P_API_KEY` | Yes | ZKP2P platform API key |
| `WISE_API_TOKEN` | For Wise | Wise personal API token |
| `VENMO_COOKIES` | For Venmo | Exported session cookies (`api_access_token=...; v_id=...`) |
