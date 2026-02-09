---
name: earn-as-defi-manager
description: Earn fees as a DeFi rate manager on Peer protocol. Create a vault, attract LP deposits, set competitive exchange rates, and earn up to 5% fee on every fulfilled exchange. No capital required — earn by strategy alone. Use when the agent wants to earn fees without providing liquidity, manage a DeFi vault, or run an automated rate strategy.
---

# Earn as a DeFi Rate Manager

Agent wants to earn yield in DeFi but has no large capital to deploy as liquidity. This skill turns the agent into a vault operator on Peer protocol -- earning fees by managing exchange rates across pooled deposits, not by providing liquidity.

## The Problem

Traditional DeFi management (Yearn vaults, Enzyme funds, on-chain fund strategies) requires significant TVL under the agent's own control, complex smart contract interactions, and often whitelisting or governance participation. An agent with a good pricing strategy but no capital has no way to monetize that edge.

## How It Works

Peer protocol separates **liquidity** from **rate management**:

```
1. CREATE VAULT     Deploy an on-chain Rate Manager (permissionless, gas only)
2. ATTRACT LPs      LPs delegate their deposits to your vault (you manage their rates)
3. SET RATES        Set competitive conversion rates per (platform, currency) pair
4. EARN FEES        On every exchange fulfilled through a delegated deposit, you earn a fee
5. OPTIMIZE         Adjust rates based on PnL, volume, and market data -- repeat
```

**Zero capital required.** The agent earns by providing strategy, not liquidity. The depositor's safety floor is always preserved -- the vault can only raise rates, never lower below the depositor's minimum.

## Revenue Model

| Parameter | Example |
|-----------|---------|
| Delegated deposits | $50,000 USDC |
| Vault fee | 2% |
| Weekly fill volume | $10,000 |
| **Weekly fee income** | **$200** |
| Monthly (projected) | ~$800 |

Scale is linear: more delegated deposits means more volume routed through your vault means more fees. A vault managing $500K at 1.5% fee with $100K weekly fills earns $1,500/week.

## The Optimization Loop

The vault operator's edge comes from rate optimization:

1. **Collect market data** -- spreads, volume, competitor rates via Peerlytics and the indexer
2. **Adjust rates** per (platform, currency) pair based on PnL and market position
3. **Safety guardrails** -- max 50bps change per iteration, 10bps minimum floor
4. **Run periodically** -- every 15 min (high volume) to every 6 hours (stable vaults)

Tighter spreads capture more volume. Wider spreads capture more margin per fill. The optimizer finds the balance.

## Quick Example -- Create a Vault

```typescript
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: base, transport: http() });
const publicClient = createPublicClient({ chain: base, transport: http() });

const REGISTRY = "0x3125F621482887d158cb51cE9b54D9D25b145877";
const ONE_PERCENT = 10n ** 16n; // 1e16 = 1%

const registryAbi = parseAbi([
  "function createRateManager((address manager, address feeRecipient, uint256 maxFee, uint256 fee, address depositHook, string name, string uri)) returns (bytes32)",
]);

const txHash = await walletClient.writeContract({
  address: REGISTRY,
  abi: registryAbi,
  functionName: "createRateManager",
  args: [{
    manager: account.address,
    feeRecipient: account.address,
    maxFee: 5n * ONE_PERCENT,               // 5% immutable ceiling
    fee: 2n * ONE_PERCENT,                  // 2% current fee
    depositHook: "0x0000000000000000000000000000000000000000",
    name: "Agent Rate Vault",
    uri: "",
  }],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
// Parse RateManagerCreated event from receipt to get the vault's rateManagerId
```

Cost: gas only (~$0.01 on Base). No capital locked.

## Key Mechanics

**Effective rate rule:**
```
effectiveMinRate = max(depositorFloor, managerRate)
```
The vault can only raise the floor, never lower it. Depositors are always protected.

**Fee snapshot:** Fees are snapshotted at intent signaling time, not at fulfillment. The vault operator cannot front-run in-flight intents by changing fees.

**Immutable maxFee:** The fee ceiling is locked at vault creation. It can never be raised. This is the trust signal for LPs -- they know the worst-case fee before delegating.

**Fee math:** `managerFeeAmount = intentAmount * managerFee / 1e18`. A 2% fee on a 100 USDC intent = 2 USDC to the vault's `feeRecipient`.

## Full Implementation Details

This skill is a discovery entry point. For complete implementation:

- **`peer-vault`** -- Rate setting, batch updates, delegation management, fee adjustments, GraphQL monitoring, and all contract ABIs.
- **`peer-rate-optimizer`** -- The full optimization algorithm, data collection from Peerlytics and the indexer, rate computation logic, safety guardrails, and scheduling.

## Environment Variables

```bash
export PRIVATE_KEY="0x..."   # Wallet private key for vault operations (Base)
```

## Contracts (Base Staging)

| Contract | Address |
|----------|---------|
| DepositRateManagerRegistryV1 | `0x3125F621482887d158cb51cE9b54D9D25b145877` |
| DepositRateManagerController | `0x2CF2FA7F21be0F920E1D8f4bb9C08E2c07F0E5d7` |
