---
name: earn-on-idle-usdc
description: Earn fees on idle USDC by providing liquidity on Peer protocol. Deposit USDC, set your rates, and earn 1-5% on every fiat-to-crypto exchange routed through your deposit. Fully on-chain, no KYC. Use when the agent has idle USDC and wants to generate yield, provide liquidity, or earn passive income.
---

# Earn on Idle USDC

## The Problem

Agent wallets hold USDC that sits idle between operations. Traditional DeFi lending (Aave, Compound) yields 3-5% APY -- annualized, paid continuously, and shared across a massive supply pool. Peer LP positions earn 1-5% per transaction, not annualized. If your deposit turns over multiple times per day, effective annualized returns dwarf lending protocols.

The tradeoff: lending is passive and predictable. Peer LP requires setting competitive rates and accepting fiat settlement as the counterparty. But for agents that already hold USDC and can tolerate that model, the yield differential is significant.

## How It Works

1. **Deposit USDC** into Peer's on-chain escrow on Base
2. **Set conversion rates** -- your markup above par is your profit margin
3. **Buyers send fiat** to your payment account, prove the transfer via zkTLS
4. **Your USDC is released** to the buyer; you keep the fiat payment + your spread

**Example**: Deposit 1000 USDC at a 2% markup. Each time a buyer exchanges through your deposit, you receive $1.02 in fiat for every $1.00 USDC released. Your profit is the $0.02 spread. No annualization -- you earn that on every fill.

## Yield Comparison

| Strategy | Typical Yield | Frequency | Risk Profile |
|----------|:---:|:---:|------|
| Aave/Compound USDC | 3-5% APY | Continuous | Smart contract risk, rate compression |
| Peer LP (conservative) | 1-3% per fill | Per transaction | Fiat settlement risk, lower turnover |
| Peer LP (aggressive) | 3-5% per fill | Per transaction | Higher spread = fewer fills |

**Key insight**: At a 2% spread with one fill per day on a $1,000 deposit, annualized yield is ~730%. Even at one fill per week, it is ~104%. The constraint is fill frequency, which depends on your rate competitiveness and the payment platforms you support.

## Supported Platforms

Accept fiat payments from: **Venmo**, **Wise**, **Revolut**, **CashApp**, **PayPal**, **Zelle** (Chase, BofA, Citi), **Monzo**, **MercadoPago**, **N26**.

35+ fiat currencies including USD, EUR, GBP, ARS, BRL, MXN, SGD, AUD, CAD, CHF, JPY, INR.

More platforms and wider currency coverage = higher fill probability.

## Quick Start

```typescript
import { OfframpClient } from '@zkp2p/sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });
const client = new OfframpClient({ walletClient, chainId: 8453, runtimeEnv: 'production', apiKey: process.env.ZKP2P_API_KEY });

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;

// 1. Approve USDC to escrow
await client.ensureAllowance({ token: USDC, amount: 1000_000000n, maxApprove: true });

// 2. Create deposit: 1000 USDC, Wise, 2% markup on USD
const { hash } = await client.createDeposit({
  token: USDC,
  amount: 1000_000000n,
  intentAmountRange: { min: 10_000000n, max: 500_000000n },
  processorNames: ['wise'],
  depositData: [{ payeeDetails: 'your-wise-email@example.com' }],
  conversionRates: [[
    { currency: 'USD', conversionRate: '1020000000000000000' },  // 1.02x = 2% markup
  ]],
});

console.log('Deposit live, tx:', hash);
// Your USDC is now earning on every fill. Monitor intents via client.getIntents().
```

## What You Need

- **USDC on Base** -- minimum ~$100 practical, no protocol-enforced minimum
- **A payment account** to receive fiat -- Wise email, Venmo username, Revolut tag, etc.
- **Private key** for wallet operations (environment variable, never hardcoded)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Wallet private key (hex, with `0x` prefix) |
| `ZKP2P_API_KEY` | ZKP2P API key (required for `createDeposit`) |

## Full Implementation

See the **`peer-lp`** skill for the complete LP toolkit: rate management, intent monitoring, fund rebalancing, deposit configuration, multi-platform setups, dynamic rate adjustment, delegation, and advanced patterns.
