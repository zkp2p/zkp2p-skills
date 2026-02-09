---
name: send-usdc
description: Send USDC to another agent or wallet on Base. Direct on-chain transfer, no intermediary, settles in seconds. Use when the agent needs to pay another agent, move funds between wallets, settle a debt in USDC, or make any on-chain payment.
---

# Send USDC

Agent needs to send USDC to another on-chain address. Both parties are on Base, so no fiat bridge, escrow, or proof generation is needed -- just a direct ERC-20 transfer.

## How It Works

1. Check USDC balance
2. Call ERC-20 `transfer()` on Base
3. Confirmed in seconds, costs < $0.01 gas

No approvals, no escrow, no intermediary. The recipient gets USDC directly.

## Quick Example

```typescript
import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http() });
const walletClient = createWalletClient({ account, chain: base, transport: http() });

async function sendUSDC(to: `0x${string}`, amountUsdc: number): Promise<`0x${string}`> {
  const raw = BigInt(Math.round(amountUsdc * 1e6));

  // Check balance
  const balance = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  });
  if (balance < raw) {
    throw new Error(`Insufficient USDC. Have: ${formatUnits(balance, 6)}, Need: ${amountUsdc}`);
  }

  // Transfer
  const txHash = await walletClient.writeContract({
    address: USDC, abi: ERC20_ABI, functionName: 'transfer', args: [to, raw],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// Usage
const tx = await sendUSDC('0xRecipientAddress...' as `0x${string}`, 50); // 50 USDC
console.log(`https://basescan.org/tx/${tx}`);
```

## When to Use Something Else

| Scenario | Use This | Use Instead |
|----------|:---:|-------------|
| Pay another agent in USDC | Yes | -- |
| Move USDC between own wallets | Yes | -- |
| Pay a human in fiat (Venmo, bank, etc.) | No | `pay-humans-fiat` |
| Buy USDC with fiat | No | `fiat-to-crypto` |
| Accept fiat payment as USDC | No | `accept-fiat-payments` |

## Full Implementation

See the **`peer-transfer`** skill for batch transfers, address validation, gas estimation, EOA checks, and security best practices.

## Requirements

- **USDC on Base** -- the amount to send
- **ETH on Base** -- for gas (< $0.01 per transfer)
- **Environment**: `PRIVATE_KEY` (agent wallet private key)

## Constants

| Field | Value |
|-------|-------|
| USDC Address | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC Decimals | 6 |
| Chain | Base Mainnet (8453) |
| Gas Cost | ~$0.001-$0.01 per transfer |
