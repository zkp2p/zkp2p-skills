---
name: peer-vault
description: Create and manage ZKP2P vaults (Delegated Rate Management). Set rates across pooled LP deposits, earn fees on fulfilled intents, and optimize pricing strategy. Use when the user wants to create a vault, manage vault rates, delegate deposits, or operate as a vault manager on ZKP2P.
---

# ZKP2P Vault — Delegated Rate Management (DRM)

## Overview

A ZKP2P vault is a permissionless **Rate Manager** that controls conversion rates and fees across multiple delegated LP deposits. Any address can create a vault on-chain. Depositors opt in per-deposit, delegating their rate management to the vault operator. The vault operator earns a fee (up to 5%) on every fulfilled intent routed through delegated deposits.

All vault operations are pure on-chain calls. No browser extension, no proof generation, no KYC required.

**Contracts (Base Sepolia Staging — chain ID 84532):**

| Contract | Address | Environment |
|----------|---------|-------------|
| DepositRateManagerRegistryV1 | `0x3125F621482887d158cb51cE9b54D9D25b145877` | Staging |
| DepositRateManagerController | `0x2CF2FA7F21be0F920E1D8f4bb9C08E2c07F0E5d7` | Staging |
| Escrow | `0x5C2a8B9246777eE4501B6C426a8B8C7635C7b5b5` | Staging |

> **Note:** Vault contracts are currently staging-only. Production addresses not yet available. The staging Escrow (`0x5C2a8B...`) is different from the production Escrow (`0x2f121C...`).

**Staging Indexer:** `https://indexer.hyperindex.xyz/00be13d/v1/graphql`

---

## Setup

Install dependencies and configure a wallet for Base chain.

```typescript
import { createWalletClient, createPublicClient, http, parseAbi, keccak256, toHex, encodePacked } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const REGISTRY = "0x3125F621482887d158cb51cE9b54D9D25b145877";  // staging
const CONTROLLER = "0x2CF2FA7F21be0F920E1D8f4bb9C08E2c07F0E5d7"; // staging
const ESCROW = "0x5C2a8B9246777eE4501B6C426a8B8C7635C7b5b5";     // staging (NOT production 0x2f121C...)
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
```

---

## Create a Vault

Call `createRateManager()` on the registry. Returns a `bytes32` vault ID.

```typescript
const registryAbi = parseAbi([
  "function createRateManager((address manager, address feeRecipient, uint256 maxFee, uint256 fee, address depositHook, string name, string uri)) returns (bytes32)",
]);

const FEE_PRECISION = 10n ** 18n; // 1e18 = 100%
const ONE_PERCENT = 10n ** 16n;   // 1e16 = 1%

const config = {
  manager: account.address,                // Wallet that controls the vault
  feeRecipient: account.address,           // Where fees are sent
  maxFee: 5n * ONE_PERCENT,               // 5% immutable ceiling (maximum allowed)
  fee: 1n * ONE_PERCENT,                  // 1% current fee
  depositHook: ADDRESS_ZERO,              // No opt-in hook
  name: "My Agent Vault",
  uri: "",                                // Optional IPFS metadata URI
};

const txHash = await walletClient.writeContract({
  address: REGISTRY,
  abi: registryAbi,
  functionName: "createRateManager",
  args: [config],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
// Parse the RateManagerCreated event to get the rateManagerId
```

**Constraints:**
- `maxFee` is **immutable** after creation. Global hard cap is 5% (`5e16`). Choose carefully.
- `fee` must be `<= maxFee`.
- If `fee > 0`, `feeRecipient` must be non-zero.

---

## Set Rates

Set minimum conversion rates for payment method / currency pairs. Rate uses `1e18` precision where `1e18` = 1:1 parity.

### Payment Method and Currency Hashes

Rates are keyed by `keccak256` hashes:

```typescript
const venmoHash = keccak256(toHex("venmo"));
const wiseHash = keccak256(toHex("wise"));
const revolutHash = keccak256(toHex("revolut"));

const usdHash = keccak256(toHex("USD"));
const eurHash = keccak256(toHex("EUR"));
const gbpHash = keccak256(toHex("GBP"));
```

### Set a Single Rate

```typescript
const rateAbi = parseAbi([
  "function setMinRate(bytes32 rateManagerId, bytes32 paymentMethodHash, bytes32 currencyHash, uint256 rate)",
]);

// Set Venmo/USD rate to 1.005 (0.5% spread)
await walletClient.writeContract({
  address: REGISTRY,
  abi: rateAbi,
  functionName: "setMinRate",
  args: [
    rateManagerId,
    venmoHash,
    usdHash,
    1005000000000000000n, // 1.005 * 1e18
  ],
});
```

### Batch Set Rates

Set multiple payment method / currency rates in one transaction.

```typescript
const batchAbi = parseAbi([
  "function setMinRatesBatch(bytes32 rateManagerId, bytes32[] paymentMethods, bytes32[][] currencies, uint256[][] rates)",
]);

await walletClient.writeContract({
  address: REGISTRY,
  abi: batchAbi,
  functionName: "setMinRatesBatch",
  args: [
    rateManagerId,
    [venmoHash, wiseHash],                          // paymentMethods
    [[usdHash], [usdHash, eurHash]],                // currencies per method
    [[1005000000000000000n], [1005000000000000000n, 1100000000000000000n]], // rates
  ],
});
```

**Setting a rate to `0` disables quoting for that pair** across all delegated deposits.

---

## Adjust Fees

Update the vault's current fee. Cannot exceed the immutable `maxFee` set at creation.

```typescript
const feeAbi = parseAbi([
  "function setFee(bytes32 rateManagerId, uint256 newFee)",
]);

// Change fee to 2%
await walletClient.writeContract({
  address: REGISTRY,
  abi: feeAbi,
  functionName: "setFee",
  args: [rateManagerId, 2n * ONE_PERCENT],
});
```

**Fee precision:** `1e18` = 100%, `1e16` = 1%, `5e14` = 0.05%.

---

## Delegate Deposits

Depositors opt in by calling `setDepositRateManager()` on the controller. Only the depositor can call this.

### Delegate a Deposit to a Vault

```typescript
const controllerAbi = parseAbi([
  "function setDepositRateManager(address escrow, uint256 depositId, address registry, bytes32 rateManagerId)",
  "function clearDepositRateManager(address escrow, uint256 depositId)",
]);

// Delegate deposit #42 to this vault
await walletClient.writeContract({
  address: CONTROLLER,
  abi: controllerAbi,
  functionName: "setDepositRateManager",
  args: [ESCROW, 42n, REGISTRY, rateManagerId],
});
```

### Remove Delegation

```typescript
// Revert deposit to using its own floor rates
await walletClient.writeContract({
  address: CONTROLLER,
  abi: controllerAbi,
  functionName: "clearDepositRateManager",
  args: [ESCROW, 42n],
});
```

**Rules:**
- One vault per deposit. Call `clearDepositRateManager()` before switching.
- If the vault has a deposit hook, it runs on-chain and may revert (e.g., minimum liquidity check).

---

## Monitor Performance

Query the staging indexer for vault performance data.

### Vault Aggregate Stats

```graphql
query VaultPerformance($rateManagerId: String!) {
  ManagerAggregateStats(where: { rateManagerId: { _eq: $rateManagerId } }) {
    totalFilledVolume
    totalFeeAmount
    totalPnlUsdCents
    fulfilledIntents
    currentDelegatedBalance
    currentDelegatedDeposits
    updatedAt
  }
}
```

### Per-Intent Breakdown

```graphql
query IntentStats($rateManagerId: String!) {
  ManagerStats(
    where: { rateManagerId: { _eq: $rateManagerId } }
    order_by: { createdAt: desc }
    limit: 20
  ) {
    intentId
    depositId
    amount
    quoteConversionRate
    marketRate
    spreadBps
    pnlUsdCents
    managerFee
    managerFeeAmount
    createdAt
  }
}
```

### Fetch from TypeScript

```typescript
const INDEXER = "https://indexer.hyperindex.xyz/00be13d/v1/graphql";

async function queryIndexer(query: string, variables: Record<string, any> = {}) {
  const res = await fetch(INDEXER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return json.data;
}

const stats = await queryIndexer(
  `query($id: String!) {
    ManagerAggregateStats(where: { rateManagerId: { _eq: $id } }) {
      totalFilledVolume totalFeeAmount fulfilledIntents
      currentDelegatedBalance currentDelegatedDeposits
    }
  }`,
  { id: rateManagerId }
);
```

---

## Rate Mechanics

### Effective Rate

```
effectiveMinRate = max(depositorFloor, managerRate)
```

- The vault can only **raise** the floor, never lower it. The depositor's safety floor is always preserved.
- If `managerRate == 0`, the pair is **disabled** and returns 0.

### Fee-Adjusted Conversion Rate

The rate takers see includes the vault fee:

```
effectiveConversionRate = grossRate * 1e18 / (1e18 - managerFee)
```

Example: `1.0` gross rate + `1%` fee = `1.010101...` effective rate shown to takers.

### Fee Calculation on Fulfillment

```
managerFeeAmount = intentAmount * managerFee / 1e18
```

Example: `100 USDC` intent with `2%` fee = `2 USDC` fee to `feeRecipient`.

### Fee Snapshot

Fees are **snapshotted at intent signaling time**, not at fulfillment. If the vault manager changes the fee between signaling and fulfillment, the original snapshotted fee applies. This prevents front-running.

---

## Browse Vaults

### List All Vaults

```graphql
query AllVaults {
  RateManager(order_by: { createdAt: desc }) {
    id
    rateManagerId
    manager
    name
    fee
    maxFee
    feeRecipient
    uri
    createdAt
  }
}
```

### Get Vault Rates

```graphql
query VaultRates($rateManagerId: String!) {
  RateManagerRate(where: { rateManagerId: { _eq: $rateManagerId } }) {
    paymentMethodHash
    currencyCode
    managerRate
    updatedAt
  }
}
```

### Get Delegated Deposits

```graphql
query DelegatedDeposits($rateManagerId: String!) {
  RateManagerDelegation(where: { rateManagerId: { _eq: $rateManagerId } }) {
    depositId
    createdAt
    updatedAt
  }
}
```

---

## Security

1. **Immutable `maxFee`** -- Once set at vault creation, the fee ceiling can never be raised. Depositors can trust this cap when delegating.
2. **Fee snapshot** -- Fees are locked at intent signal time. Vault operators cannot increase fees on in-flight intents.
3. **Depositor floor preserved** -- `effectiveMinRate = max(depositorFloor, managerRate)`. The vault can never set a rate below the depositor's own minimum.
4. **One vault per deposit** -- Prevents conflicting rate management. Must explicitly clear before switching.
5. **Private key safety** -- Never hardcode private keys. Use environment variables or a secure key management system. Validate all amounts before submitting transactions.
6. **Hook validation** -- Vaults with deposit hooks can enforce custom opt-in requirements (e.g., minimum deposit size). Expect reverts if requirements are not met.
