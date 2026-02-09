---
name: peer-lp
description: Manage USDC liquidity deposits on ZKP2P protocol (Base chain). Create deposits, add/remove funds, set conversion rates, monitor intents, and earn fees from fiat-to-crypto exchanges. Use when the user wants to provide liquidity, manage LP positions, or earn yield on ZKP2P.
---

# ZKP2P Liquidity Provider Skill

Manage USDC liquidity on ZKP2P (Peer) protocol. Earn fees when buyers convert fiat to USDC through your deposits.

## How It Works

You deposit USDC into an on-chain escrow on Base. Buyers signal intents against your deposit, send fiat payment to your specified payee account (Venmo, Wise, Revolut, etc.), prove the payment via zkTLS, and your USDC is released to them. You keep the fiat plus any conversion rate markup.

## Setup

### Install Dependencies

```bash
npm install @zkp2p/offramp-sdk viem
```

### Initialize Client

```typescript
import { OfframpClient } from '@zkp2p/offramp-sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const client = new OfframpClient({
  walletClient,
  chainId: 8453,
  runtimeEnv: 'production',
  apiKey: process.env.ZKP2P_API_KEY,
  baseApiUrl: 'https://api.zkp2p.xyz',
});
```

### Key Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Escrow | `0x2f121CDDCA6d652f35e8B3E560f9760898888888` |
| Orchestrator | `0x88888883Ed048FF0a415271B28b2F52d431810D0` |
| ProtocolViewer | `0x30B03De22328074Fbe8447C425ae988797146606` |

## Create a Deposit

Creating a deposit requires: token address, amount, intent range, payment methods, payee data, and conversion rates.

### Step 1: Approve USDC

```typescript
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
const amount = 1000_000000n; // 1000 USDC (6 decimals)

const { hadAllowance, hash: approvalHash } = await client.ensureAllowance({
  token: USDC,
  amount,
  maxApprove: true, // Approve MaxUint256 to avoid repeated approvals
});

if (!hadAllowance) {
  console.log('Approval tx:', approvalHash);
}
```

### Step 2: Resolve Payment Method Hashes

```typescript
import {
  resolvePaymentMethodHash,
  resolveFiatCurrencyBytes32,
} from '@zkp2p/offramp-sdk';

// Payment method hashes are keccak256 of lowercase name
const wiseHash = resolvePaymentMethodHash('wise');
const revolutHash = resolvePaymentMethodHash('revolut');

// Currency hashes are keccak256 of uppercase code
const usdHash = resolveFiatCurrencyBytes32('USD');
const eurHash = resolveFiatCurrencyBytes32('EUR');
```

### Step 3: Create Deposit

```typescript
const { depositDetails, hash } = await client.createDeposit({
  token: USDC,
  amount: 1000_000000n,                       // 1000 USDC
  intentAmountRange: {
    min: 10_000000n,                           // Min 10 USDC per intent
    max: 500_000000n,                          // Max 500 USDC per intent
  },
  processorNames: ['wise'],                    // Payment platforms
  depositData: [{                              // One entry per processor
    payeeDetails: 'your-wise-email@example.com',
    // Additional fields as required by processor
  }],
  conversionRates: [[                          // One array per processor
    { currency: 'USD', conversionRate: '1020000000000000000' }, // 1.02x (2% markup)
    { currency: 'EUR', conversionRate: '1080000000000000000' }, // 1.08x (accounts for EUR/USD + markup)
  ]],
});

console.log('Deposit created, tx:', hash);
// depositDetails contains the on-chain deposit ID after confirmation
```

### Conversion Rate Format

Rates use 18-decimal precision where `1e18 = 1.00x` (no markup).

| Desired Markup | Rate Value | BigInt |
|---------------|------------|--------|
| 0% (par) | 1.00 | `1000000000000000000n` |
| 1% | 1.01 | `1010000000000000000n` |
| 2% | 1.02 | `1020000000000000000n` |
| 3% | 1.03 | `1030000000000000000n` |
| 5% | 1.05 | `1050000000000000000n` |

For cross-currency deposits (e.g., USDC deposit with EUR payments), the rate must also account for the FX spread. If EUR/USD is 1.08 and you want a 2% markup: `1.08 * 1.02 = 1.1016`, so use `1101600000000000000n`.

## Manage Funds

### Add Funds to Existing Deposit

```typescript
await client.addFunds({
  depositId: 42n,
  amount: 500_000000n, // Add 500 USDC
});
```

Note: `addFunds` is permissionless -- anyone can add funds to any deposit. The USDC is still controlled by the deposit owner.

### Remove Available Funds

```typescript
await client.removeFunds({
  depositId: 42n,
  amount: 200_000000n, // Remove 200 USDC
});
```

Only removes from `remainingDeposits` (unlocked funds). Funds locked in active intents cannot be removed.

### Withdraw Entire Deposit

```typescript
await client.withdrawDeposit({
  depositId: 42n,
});
```

Withdraws all available funds and marks the deposit inactive. Fails if there are outstanding (locked) intents -- prune expired intents first.

## Set Conversion Rates

Update the minimum conversion rate for a specific payment method + currency pair on your deposit.

```typescript
import {
  resolvePaymentMethodHash,
  resolveFiatCurrencyBytes32,
} from '@zkp2p/offramp-sdk';

await client.setCurrencyMinRate({
  depositId: 42n,
  paymentMethod: resolvePaymentMethodHash('wise'),
  fiatCurrency: resolveFiatCurrencyBytes32('USD'),
  minConversionRate: 1015000000000000000n, // 1.5% markup
});
```

The `minConversionRate` is a floor. Buyers can offer a higher rate (more fiat per USDC) but never lower. Setting to `0n` effectively deactivates that currency.

### Rate Update Examples

```typescript
// Tighten spread during high volume
await client.setCurrencyMinRate({
  depositId: 42n,
  paymentMethod: resolvePaymentMethodHash('revolut'),
  fiatCurrency: resolveFiatCurrencyBytes32('EUR'),
  minConversionRate: 1085000000000000000n, // ~0.5% markup over spot
});

// Widen spread during low volume or high risk
await client.setCurrencyMinRate({
  depositId: 42n,
  paymentMethod: resolvePaymentMethodHash('revolut'),
  fiatCurrency: resolveFiatCurrencyBytes32('EUR'),
  minConversionRate: 1120000000000000000n, // ~3.7% markup over spot
});
```

## Toggle Intent Acceptance

Pause or resume your deposit from accepting new intents. Existing intents are not affected.

```typescript
// Stop accepting new intents (e.g., going offline, rebalancing)
await client.setAcceptingIntents({
  depositId: 42n,
  accepting: false,
});

// Resume accepting intents
await client.setAcceptingIntents({
  depositId: 42n,
  accepting: true,
});
```

### Set Intent Amount Range

Update the min/max USDC per intent.

```typescript
await client.setIntentRange({
  depositId: 42n,
  min: 50_000000n,   // Min 50 USDC
  max: 1000_000000n, // Max 1000 USDC
});
```

## Monitor Intents

### Get All Your Intents

```typescript
const intents = await client.getIntents();

for (const intent of intents) {
  console.log(`Intent ${intent.intentHash}:`);
  console.log(`  Amount: ${intent.amount} USDC`);
  console.log(`  Status: ${intent.status}`);
  console.log(`  Deposit ID: ${intent.depositId}`);
  console.log(`  Created: ${new Date(Number(intent.timestamp) * 1000)}`);
}
```

### Get Single Intent

```typescript
const intent = await client.getIntent('0xabc123...' as `0x${string}`);
```

### Polling Loop for Active Monitoring

```typescript
async function monitorIntents(client: OfframpClient, intervalMs = 30_000) {
  setInterval(async () => {
    try {
      const intents = await client.getIntents();
      const active = intents.filter(i => i.status === 'active');

      if (active.length > 0) {
        console.log(`${active.length} active intent(s):`);
        for (const intent of active) {
          const expiresIn = Number(intent.expiryTime) - Math.floor(Date.now() / 1000);
          console.log(`  ${intent.intentHash} - ${intent.amount} USDC - expires in ${expiresIn}s`);
        }
      }
    } catch (err) {
      console.error('Intent monitoring error:', err);
    }
  }, intervalMs);
}
```

### Intent Lifecycle

| State | Meaning |
|-------|---------|
| Active | Buyer has signaled intent, funds locked in escrow |
| Fulfilled | Buyer proved payment, USDC released to buyer |
| Cancelled | Buyer cancelled, funds unlocked back to deposit |
| Expired | Intent passed expiration period, can be pruned |

## Prune Expired Intents

Expired intents lock funds unnecessarily. Pruning is permissionless -- anyone can prune any deposit.

```typescript
await client.pruneExpiredIntents({
  depositId: 42n,
});
```

This unlocks all expired intent amounts back to `remainingDeposits`.

## View Deposit Status

### Get All Your Deposits

```typescript
const deposits = await client.getDeposits();

for (const d of deposits) {
  console.log(`Deposit #${d.depositId}:`);
  console.log(`  Available: ${d.remainingDeposits} (raw units)`);
  console.log(`  Locked: ${d.outstandingIntentAmount}`);
  console.log(`  Accepting: ${d.acceptingIntents}`);
  console.log(`  Payment Methods: ${d.paymentMethods?.join(', ')}`);
}
```

### Get Single Deposit

```typescript
const deposit = await client.getDeposit(42n);
console.log('Remaining USDC:', Number(deposit.remainingDeposits) / 1e6);
console.log('Locked in intents:', Number(deposit.outstandingIntentAmount) / 1e6);
```

### Get Deposits for Any Address

```typescript
const deposits = await client.getAccountDeposits('0x1234...');
```

## Advanced Deposit Management

### Set Delegate

Allow another address to manage your deposit (set rates, toggle acceptance, etc.) without transferring ownership.

```typescript
await client.setDelegate({
  depositId: 42n,
  delegate: '0xDelegateAddress...' as `0x${string}`,
});
```

### Remove Delegate

```typescript
await client.removeDelegate({
  depositId: 42n,
});
```

### Retain on Empty

Keep deposit configuration alive when balance reaches zero. Useful if you plan to refill later without re-creating the deposit.

```typescript
await client.setRetainOnEmpty({
  depositId: 42n,
  retain: true,
});
```

### Add Payment Methods to Existing Deposit

```typescript
await client.addPaymentMethods({
  depositId: 42n,
  paymentMethods: [resolvePaymentMethodHash('revolut')],
  paymentMethodData: [{
    payeeDetails: 'your-revolut-tag',
    // processor-specific fields
  }],
});
```

### Toggle Payment Method

```typescript
await client.setPaymentMethodActive({
  depositId: 42n,
  paymentMethod: resolvePaymentMethodHash('wise'),
  isActive: false, // Temporarily disable Wise
});
```

### Release Funds to Payer

As a depositor, you can manually release locked funds back to the buyer (e.g., if the buyer's payment was reversed or disputed).

```typescript
await client.releaseFundsToPayer({
  intentHash: '0xabc123...' as `0x${string}`,
});
```

## Contract Resolution

```typescript
import { getContracts, getPaymentMethodsCatalog } from '@zkp2p/offramp-sdk';

// Get all contract addresses and ABIs
const { addresses, abis } = getContracts(8453, 'production');
// addresses.escrow, addresses.orchestrator, addresses.usdc, etc.

// Get payment method catalog
const catalog = getPaymentMethodsCatalog(8453, 'production');
// catalog.wise.paymentMethodHash -> "0x..."
// catalog.wise.currencies -> ["0x...", "0x..."]
```

## Security Rules

1. **Never expose private keys** in code, logs, or responses. Use environment variables or secure key management.
2. **Validate amounts before transactions.** Always confirm deposit amounts, withdrawal amounts, and rates with the user before executing.
3. **Check balances before operations.** Verify the wallet has sufficient USDC before `createDeposit` or `addFunds`. Verify `remainingDeposits` before `removeFunds`.
4. **Monitor intent expiry.** Prune expired intents regularly to avoid funds being locked unnecessarily.
5. **Use appropriate gas settings.** Base L2 gas is cheap but spikes happen. Consider setting `maxFeePerGas` in `txOverrides` for time-sensitive operations.
6. **Never set rates to zero unintentionally.** A `minConversionRate` of `0n` deactivates that currency pair.
7. **Confirm before withdrawDeposit.** This removes all available funds. If intents are active, those funds remain locked until fulfilled/cancelled/expired.
8. **Rate precision matters.** All conversion rates use 18 decimals. Double-check calculations. `1% markup = 1.01 * 1e18 = 1010000000000000000`.

## Common Patterns

### Pattern: Conservative LP Setup

Create a deposit with moderate markup, single payment method, and tight intent range.

```typescript
await client.ensureAllowance({ token: USDC, amount: 500_000000n, maxApprove: true });

const { hash } = await client.createDeposit({
  token: USDC,
  amount: 500_000000n,
  intentAmountRange: { min: 20_000000n, max: 200_000000n },
  processorNames: ['wise'],
  depositData: [{ payeeDetails: 'user@email.com' }],
  conversionRates: [[
    { currency: 'USD', conversionRate: '1030000000000000000' }, // 3% markup
  ]],
});
```

### Pattern: Multi-Platform LP

Accept payments via multiple platforms to maximize fill rate.

```typescript
const { hash } = await client.createDeposit({
  token: USDC,
  amount: 5000_000000n,
  intentAmountRange: { min: 10_000000n, max: 1000_000000n },
  processorNames: ['wise', 'revolut', 'venmo'],
  depositData: [
    { payeeDetails: 'wise-email@example.com' },
    { payeeDetails: '@revolut-tag' },
    { payeeDetails: '@venmo-username' },
  ],
  conversionRates: [
    [{ currency: 'USD', conversionRate: '1020000000000000000' }, { currency: 'EUR', conversionRate: '1100000000000000000' }],
    [{ currency: 'EUR', conversionRate: '1090000000000000000' }, { currency: 'GBP', conversionRate: '1270000000000000000' }],
    [{ currency: 'USD', conversionRate: '1025000000000000000' }],
  ],
});
```

### Pattern: Dynamic Rate Adjustment

Adjust rates based on utilization. When most of your deposit is locked in intents, widen the spread.

```typescript
async function adjustRates(client: OfframpClient, depositId: bigint) {
  const deposit = await client.getDeposit(depositId);
  const total = Number(deposit.remainingDeposits) + Number(deposit.outstandingIntentAmount);
  const utilization = Number(deposit.outstandingIntentAmount) / total;

  let markup: bigint;
  if (utilization > 0.8) {
    markup = 1050000000000000000n; // 5% at high utilization
  } else if (utilization > 0.5) {
    markup = 1030000000000000000n; // 3% at medium
  } else {
    markup = 1015000000000000000n; // 1.5% at low
  }

  await client.setCurrencyMinRate({
    depositId,
    paymentMethod: resolvePaymentMethodHash('wise'),
    fiatCurrency: resolveFiatCurrencyBytes32('USD'),
    minConversionRate: markup,
  });
}
```

### Pattern: Rebalancing Check

Monitor and rebalance deposits when utilization or balance drops.

```typescript
async function checkRebalance(client: OfframpClient) {
  const deposits = await client.getDeposits();

  for (const d of deposits) {
    const available = Number(d.remainingDeposits) / 1e6;
    const locked = Number(d.outstandingIntentAmount) / 1e6;

    if (available < 100) {
      console.log(`Deposit #${d.depositId}: Low balance (${available} USDC available). Consider adding funds.`);
    }

    if (locked > 0) {
      // Prune any expired intents to free up funds
      await client.pruneExpiredIntents({ depositId: BigInt(d.depositId) });
    }
  }
}
```

## Supported Payment Platforms

| Platform | Processor Name | Currencies |
|----------|---------------|------------|
| Wise | `wise` | USD, EUR, GBP, SGD, AUD, CAD, CHF, JPY, and more |
| Revolut | `revolut` | EUR, GBP, USD, CHF, and more |
| Venmo | `venmo` | USD |
| CashApp | `cashapp` | USD |
| PayPal | `paypal` | USD, EUR, GBP |
| Monzo | `monzo` | GBP |
| MercadoPago | `mercadopago` | ARS, BRL, MXN |
| Zelle (Chase) | `zelle-chase` | USD |
| Zelle (BofA) | `zelle-bofa` | USD |
| Zelle (Citi) | `zelle-citi` | USD |

Use `getPaymentMethodsCatalog(8453, 'production')` for the canonical list of supported methods and currencies.

## API Reference

See `references/sdk-api.md` for the complete method reference with parameter types and return types.
