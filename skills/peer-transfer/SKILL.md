---
name: peer-transfer
description: Transfer USDC between agent wallets on Base chain. Direct on-chain settlement for agent-to-agent payments without ZKP2P escrow. Use when the user wants to send USDC to another agent, transfer tokens, or settle agent-to-agent payments.
---

# ZKP2P Transfer (Agent-to-Agent USDC)

Direct USDC transfer on Base for agent-to-agent payments. No ZKP2P escrow or proof generation needed -- this is a simple ERC-20 transfer for when both parties are on-chain.

## Overview

When both the sender and recipient are on-chain (e.g., two agents with wallets), there is no need for ZKP2P's fiat-to-crypto bridge. A direct USDC transfer is simpler, cheaper, and instant.

**Use this skill when**:
- Agent needs to pay another agent in USDC
- Agent needs to move USDC between its own wallets
- Agent needs to settle an agent-to-agent debt

**Use `zkp2p-onramp` or `zkp2p-offramp` instead when**:
- One party needs fiat (e.g., paying a human freelancer)
- Agent needs to convert between fiat and crypto

## Setup

Install `viem` for Base chain interaction:

```bash
npm install viem
```

Environment variables:

```bash
export PRIVATE_KEY="0x..."           # Agent wallet private key
export BASE_RPC_URL="https://mainnet.base.org"  # Optional: custom RPC
```

## Transfer USDC

### Full Code Example

```typescript
import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// --- Constants ---
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

// --- Setup ---
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

// --- Transfer Function ---
async function transferUSDC(
  recipientAddress: `0x${string}`,
  amountUsdc: number
): Promise<`0x${string}`> {
  const amountRaw = BigInt(Math.round(amountUsdc * 10 ** USDC_DECIMALS));

  // 1. Check balance
  const balance = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if (balance < amountRaw) {
    const balanceFormatted = formatUnits(balance, USDC_DECIMALS);
    throw new Error(
      `Insufficient USDC balance. Have: ${balanceFormatted}, Need: ${amountUsdc}`
    );
  }

  // 2. Validate recipient
  if (!recipientAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error(`Invalid recipient address: ${recipientAddress}`);
  }

  // 3. Execute transfer
  const txHash = await walletClient.writeContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipientAddress, amountRaw],
  });

  console.log(`Transfer sent: ${txHash}`);
  console.log(`  From: ${account.address}`);
  console.log(`  To: ${recipientAddress}`);
  console.log(`  Amount: ${amountUsdc} USDC`);

  // 4. Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  return txHash;
}

// --- Usage ---
const tx = await transferUSDC(
  '0xRecipientAddressHere' as `0x${string}`,
  50  // 50 USDC
);
```

## Check Balance

Read USDC balance before transferring:

```typescript
async function getUsdcBalance(address: `0x${string}`): Promise<{
  raw: bigint;
  formatted: string;
}> {
  const balance = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  });

  return {
    raw: balance,
    formatted: formatUnits(balance, USDC_DECIMALS),
  };
}

// Check agent's balance
const balance = await getUsdcBalance(account.address);
console.log(`USDC Balance: ${balance.formatted}`);

// Check ETH balance (for gas)
const ethBalance = await publicClient.getBalance({ address: account.address });
console.log(`ETH Balance: ${formatUnits(ethBalance, 18)}`);
```

**Important**: The agent needs ETH on Base for gas fees. Base L2 gas costs are typically <$0.01 per transfer.

## Batch Transfers

Send USDC to multiple recipients in one session:

```typescript
interface TransferRecipient {
  address: `0x${string}`;
  amountUsdc: number;
  label?: string;
}

async function batchTransferUSDC(
  recipients: TransferRecipient[]
): Promise<{ address: string; amount: number; txHash: string; status: string }[]> {
  // Pre-flight: check total balance
  const totalAmount = recipients.reduce((sum, r) => sum + r.amountUsdc, 0);
  const balance = await getUsdcBalance(account.address);
  const totalRaw = BigInt(Math.round(totalAmount * 10 ** USDC_DECIMALS));

  if (balance.raw < totalRaw) {
    throw new Error(
      `Insufficient balance for batch. Have: ${balance.formatted} USDC, Need: ${totalAmount} USDC`
    );
  }

  console.log(`Batch transfer: ${recipients.length} recipients, ${totalAmount} USDC total`);

  const results = [];
  for (const recipient of recipients) {
    try {
      const txHash = await transferUSDC(recipient.address, recipient.amountUsdc);
      results.push({
        address: recipient.address,
        amount: recipient.amountUsdc,
        txHash,
        status: 'success',
      });
      console.log(`  [OK] ${recipient.label || recipient.address}: ${recipient.amountUsdc} USDC`);
    } catch (error) {
      results.push({
        address: recipient.address,
        amount: recipient.amountUsdc,
        txHash: '',
        status: `failed: ${(error as Error).message}`,
      });
      console.log(`  [FAIL] ${recipient.label || recipient.address}: ${(error as Error).message}`);
    }
  }

  return results;
}

// Example: Pay three agents
const results = await batchTransferUSDC([
  { address: '0xAgent1...', amountUsdc: 100, label: 'Agent Alpha' },
  { address: '0xAgent2...', amountUsdc: 75,  label: 'Agent Beta' },
  { address: '0xAgent3...', amountUsdc: 25,  label: 'Agent Gamma' },
]);

console.log(`\nResults: ${results.filter(r => r.status === 'success').length}/${results.length} succeeded`);
```

**Note**: Batch transfers are sequential (one tx at a time). For truly atomic batch transfers, use a multicall contract or build a custom batch transfer contract.

## When to Use ZKP2P Instead

| Scenario | Use This Skill | Use ZKP2P |
|----------|----------------|-----------|
| Agent pays another agent in USDC | Yes | No |
| Agent pays a human in fiat | No | Yes (zkp2p-offramp) |
| Agent converts fiat to USDC | No | Yes (zkp2p-onramp) |
| Agent moves USDC between own wallets | Yes | No |
| Agent pays a merchant (fiat invoice) | No | Yes (zkp2p-checkout) |
| Agent splits payment: part crypto, part fiat | Yes (crypto part) | Yes (fiat part) |

## Security

### Pre-Transfer Checklist

1. **Validate recipient address**: Ensure it is a valid checksummed Ethereum address. Never send to `address(0)` or known burn addresses.

```typescript
import { getAddress, isAddress } from 'viem';

function validateRecipient(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return getAddress(address); // Returns checksummed address
}
```

2. **Check balance before transfer**: Always verify sufficient USDC balance.

3. **Verify recipient is not a contract** (optional, for extra safety):

```typescript
async function isEOA(address: `0x${string}`): Promise<boolean> {
  const code = await publicClient.getCode({ address });
  return code === undefined || code === '0x';
}
```

4. **Use checksummed addresses**: Always use `getAddress()` to normalize addresses.

5. **Gas estimation**: Base L2 gas is cheap (~$0.001-$0.01 per transfer), but ensure the agent has ETH for gas.

```typescript
// Check ETH balance for gas
const ethBalance = await publicClient.getBalance({ address: account.address });
if (ethBalance < 100_000_000_000_000n) { // < 0.0001 ETH
  console.warn('Low ETH balance for gas. Top up before transfers.');
}
```

### Private Key Management

- Never hardcode private keys in source code
- Use environment variables or a secrets manager
- Consider using a hardware wallet or MPC wallet for production agents
- Rotate keys periodically

### Amount Validation

```typescript
function validateAmount(amountUsdc: number): bigint {
  if (amountUsdc <= 0) throw new Error('Amount must be positive');
  if (amountUsdc > 1_000_000) throw new Error('Amount exceeds safety limit (1M USDC)');
  if (!Number.isFinite(amountUsdc)) throw new Error('Amount must be finite');

  // Convert to raw units (6 decimals)
  return BigInt(Math.round(amountUsdc * 1_000_000));
}
```

## Chain Constants

| Field | Value |
|-------|-------|
| Chain | Base Mainnet |
| Chain ID | `8453` |
| RPC URL | `https://mainnet.base.org` |
| Block Explorer | `https://basescan.org` |
| USDC Address | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC Decimals | 6 |
| Native Token | ETH (for gas) |
| Avg Gas Cost | ~$0.001-$0.01 per transfer |

## Verifying Transfers

After a transfer, verify on-chain:

```typescript
// Get transaction receipt
const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
console.log(`Status: ${receipt.status}`);  // 'success' or 'reverted'
console.log(`Block: ${receipt.blockNumber}`);
console.log(`Gas used: ${receipt.gasUsed}`);

// View on Basescan
console.log(`Explorer: https://basescan.org/tx/${txHash}`);
```
