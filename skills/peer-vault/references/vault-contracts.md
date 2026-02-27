# Vault Contract Reference

Complete ABI signatures, indexer schemas, and query examples for ZKP2P vault (DRM) contracts.

---

## Contract Addresses

### Staging (Base Sepolia — Chain ID 84532)

> **Vault contracts are currently staging-only.** Production vault addresses are not yet available.

| Contract | Address | Notes |
|----------|---------|-------|
| DepositRateManagerRegistryV1 | `0x3125F621482887d158cb51cE9b54D9D25b145877` | Staging |
| DepositRateManagerController | `0x2CF2FA7F21be0F920E1D8f4bb9C08E2c07F0E5d7` | Staging |
| Orchestrator | `0xd067Ade072a0F034E277BB26CdCE9F360A2a4127` | Staging |
| Escrow | `0x5C2a8B9246777eE4501B6C426a8B8C7635C7b5b5` | Staging (different from production `0x2f121C...`) |

### Production (Base Mainnet — Chain ID 8453)

Production vault contracts have not been deployed yet. The production Escrow is `0x2f121CDDCA6d652f35e8B3E560f9760898888888` (see `shared/references/contracts.md`).

---

## DepositRateManagerRegistryV1

### Structs

```solidity
struct RateManagerConfig {
    address manager;       // Address that controls this vault
    address feeRecipient;  // Where fees are sent
    uint256 maxFee;        // Immutable fee ceiling (max 5e16 = 5%)
    uint256 fee;           // Current fee (<= maxFee)
    address depositHook;   // Optional hook contract (address(0) for none)
    string name;           // Display name
    string uri;            // Metadata URI (e.g. IPFS)
}
```

### Write Functions

```solidity
// Create a new vault. Returns the unique rateManagerId (bytes32).
function createRateManager(RateManagerConfig calldata config) external returns (bytes32 rateManagerId);

// Set the minimum rate for a single payment method / currency pair.
// Rate uses 1e18 precision (1e18 = 1:1). Setting rate to 0 disables the pair.
// Only callable by the vault's manager address.
function setMinRate(
    bytes32 rateManagerId,
    bytes32 paymentMethodHash,
    bytes32 currencyHash,
    uint256 rate
) external;

// Batch set rates for multiple payment method / currency pairs in one tx.
// Arrays: paymentMethods[i] maps to currencies[i][j] and rates[i][j].
// Only callable by the vault's manager address.
function setMinRatesBatch(
    bytes32 rateManagerId,
    bytes32[] calldata paymentMethods,
    bytes32[][] calldata currencies,
    uint256[][] calldata rates
) external;

// Update the vault fee. Must be <= maxFee.
// Only callable by the vault's manager address.
function setFee(
    bytes32 rateManagerId,
    uint256 newFee
) external;

// Update vault configuration (manager, feeRecipient, hook, name, uri).
// maxFee is immutable and cannot be changed.
// Only callable by the current vault manager address.
function setRateManagerConfig(
    bytes32 rateManagerId,
    address newManager,
    address newFeeRecipient,
    address newHook,
    string calldata newName,
    string calldata newUri
) external;
```

### Read Functions

```solidity
// Get the full config for a vault.
function getRateManager(bytes32 rateManagerId) external view returns (RateManagerConfig memory);

// Get the minimum rate for a specific pair.
function getMinRate(
    bytes32 rateManagerId,
    bytes32 paymentMethodHash,
    bytes32 currencyHash
) external view returns (uint256);
```

### Events

```solidity
event RateManagerCreated(
    bytes32 indexed rateManagerId,
    address indexed manager,
    address feeRecipient,
    uint256 maxFee,
    uint256 fee,
    address depositHook,
    string name,
    string uri
);

event MinRateSet(
    bytes32 indexed rateManagerId,
    bytes32 indexed paymentMethodHash,
    bytes32 indexed currencyHash,
    uint256 rate
);

event FeeSet(
    bytes32 indexed rateManagerId,
    uint256 newFee
);

event RateManagerConfigUpdated(
    bytes32 indexed rateManagerId,
    address newManager,
    address newFeeRecipient,
    address newHook,
    string newName,
    string newUri
);
```

---

## DepositRateManagerController

### Write Functions

```solidity
// Delegate a deposit to a vault. Only callable by the depositor.
// Reverts if the deposit is already delegated (must clear first).
// If the vault has a depositHook, the hook runs and may revert.
function setDepositRateManager(
    address escrow,
    uint256 depositId,
    address registry,
    bytes32 rateManagerId
) external;

// Remove delegation. Deposit reverts to its own floor rates.
// Only callable by the depositor.
function clearDepositRateManager(
    address escrow,
    uint256 depositId
) external;
```

### Read Functions

```solidity
// Get the vault ID and registry for a delegated deposit.
// Returns (bytes32(0), address(0)) if not delegated.
function getDepositRateManager(
    address escrow,
    uint256 depositId
) external view returns (bytes32 rateManagerId, address registry);

// Compute the effective minimum rate for a deposit, accounting for delegation.
// Returns max(depositorFloor, managerRate), or 0 if managerRate == 0.
function getEffectiveMinRate(
    address escrow,
    uint256 depositId,
    bytes32 paymentMethodHash,
    bytes32 currencyHash
) external view returns (uint256);
```

### Events

```solidity
event DepositRateManagerSet(
    address indexed escrow,
    uint256 indexed depositId,
    address indexed registry,
    bytes32 rateManagerId
);

event DepositRateManagerCleared(
    address indexed escrow,
    uint256 indexed depositId
);
```

---

## Constants and Precision

| Constant | Value | Description |
|----------|-------|-------------|
| Fee precision base | `1e18` | `1e18` = 100% |
| 1% fee | `1e16` | `10000000000000000` |
| Maximum vault fee | `5e16` | 5% hard cap enforced by protocol |
| Rate precision | `1e18` | `1e18` = 1:1 conversion parity |
| Rate of 1.005 (0.5% spread) | `1005000000000000000` | `1.005 * 1e18` |
| Rate of 0 | `0` | Disables the pair |

### Common Payment Method Hashes

Compute with `keccak256(toHex("platform_name"))`:

| Platform | Hash Input |
|----------|-----------|
| Venmo | `"venmo"` |
| Wise | `"wise"` |
| Revolut | `"revolut"` |
| PayPal | `"paypal"` |
| Zelle | `"zelle"` |
| CashApp | `"cashapp"` |

### Common Currency Hashes

Compute with `keccak256(toHex("CODE"))`:

| Currency | Hash Input |
|----------|-----------|
| US Dollar | `"USD"` |
| Euro | `"EUR"` |
| British Pound | `"GBP"` |
| Singapore Dollar | `"SGD"` |
| Indian Rupee | `"INR"` |
| Brazilian Real | `"BRL"` |

---

## Rate Calculation Formulas

### Effective Minimum Rate

```
effectiveMinRate = max(depositorFloor, managerRate)
```

- If `managerRate == 0`: pair is disabled, returns `0`
- Manager can only raise the floor, never lower it

### Fee-Adjusted Conversion Rate (Taker-Facing)

```
effectiveConversionRate = grossRate * 1e18 / (1e18 - managerFee)
```

Example: grossRate = `1e18` (1:1), managerFee = `1e16` (1%)
```
effectiveConversionRate = 1e18 * 1e18 / (1e18 - 1e16)
                        = 1e36 / 990000000000000000
                        = 1010101010101010101  (~1.0101)
```

### Fee Amount on Fulfillment

```
managerFeeAmount = intentAmount * managerFee / 1e18
```

Example: 100 USDC intent, 2% fee
```
managerFeeAmount = 100e6 * 2e16 / 1e18 = 2e6 (2 USDC)
```

---

## Indexer GraphQL Schema

- **Production endpoint:** `https://indexer.zkp2p.xyz/v1/graphql`
- **Staging endpoint:** `https://indexer-staging.zkp2p.xyz/v1/graphql`

### RateManager

Vault configuration entity. One per vault.

```graphql
type RateManager {
  id: String!               # Format: {chainId}_{rateManagerId}
  chainId: Int!
  registry: String!          # Registry contract address
  rateManagerId: String!     # bytes32 hex identifier
  manager: String!           # Manager wallet address
  feeRecipient: String!
  maxFee: BigInt!            # Immutable cap (1e18 precision)
  fee: BigInt!               # Current fee
  depositHook: String!
  name: String!
  uri: String!
  createdAt: BigInt!
  updatedAt: BigInt!
}
```

### RateManagerRate

Per-pair minimum rates set by the vault manager. One per (vault, paymentMethod, currency).

```graphql
type RateManagerRate {
  id: String!                # Format: {chainId}_{rateManagerId}_{paymentMethodHash}_{currencyCode}
  rateManagerId: String!
  paymentMethodHash: String!
  currencyCode: String!
  managerRate: BigInt!       # 0 = disabled
  updatedAt: BigInt!
}
```

### RateManagerDelegation

Links a deposit to a vault. One per delegated deposit.

```graphql
type RateManagerDelegation {
  id: String!                # Format: {chainId}_{depositId}
  rateManagerId: String!
  registry: String!
  depositId: String!         # Format: {escrowAddress}_{depositId}
  createdAt: BigInt!
  updatedAt: BigInt!
}
```

### ManagerAggregateStats

Vault-level aggregate performance. One per vault.

```graphql
type ManagerAggregateStats {
  id: String!
  rateManagerId: String!
  manager: String!
  totalFilledVolume: BigInt!       # Sum of amounts across fulfilled intents (USDC)
  totalFeeAmount: BigInt!          # Sum of manager fees collected (USDC)
  totalPnlUsdCents: BigInt!        # Sum of PnL in USD cents
  fulfilledIntents: Int!           # Count of fulfilled intents
  currentDelegatedBalance: BigInt! # Current total liquidity delegated (USDC)
  currentDelegatedDeposits: Int!   # Count of active delegated deposits
  firstSeenAt: BigInt!
  updatedAt: BigInt!
}
```

### ManagerStats

Per-intent performance record. One per fulfilled intent routed through the vault.

```graphql
type ManagerStats {
  id: String!                      # intentId
  rateManagerId: String!
  manager: String!
  intentId: String!
  depositId: String!
  amount: BigInt!                  # USDC released
  quoteConversionRate: BigInt!     # Rate used for this intent
  marketRate: BigInt!              # Oracle fiat price at fulfillment
  spreadBps: Int!                  # Basis points spread vs market
  pnlUsdCents: BigInt!            # Profit/loss in USD cents
  managerFee: BigInt!              # Fee % at snapshot (1e18 precision)
  managerFeeAmount: BigInt!        # Actual fee collected (USDC)
  createdAt: BigInt!
}
```

### Modified Existing Entities

**Deposit** -- new nullable fields when delegated:

```graphql
# Added to existing Deposit type
rateManagerId: String          # Vault ID if delegated
rateManagerRegistry: String    # Registry contract address if delegated
```

**MethodCurrency** -- new fields reflecting vault overrides:

```graphql
# Added to existing MethodCurrency type
managerRate: BigInt             # Rate override from vault (0 = disabled)
conversionRate: BigInt!         # Effective gross rate: max(depositorFloor, managerRate) or 0
rateManagerId: String           # Which vault provides the rate
```

**Intent** -- new fields capturing fee snapshot:

```graphql
# Added to existing Intent type
rateManagerId: String           # Vault that controlled the rate
manager: String                 # Manager address at snapshot time
managerFee: BigInt              # Fee % snapshotted at intent signaling
managerFeeRecipient: String     # Where the fee was sent
managerFeeAmount: BigInt        # Actual fee amount (USDC)
```

**QuoteCandidate** -- new fields for taker-facing quotes:

```graphql
# Added to existing QuoteCandidate type
managerRate: BigInt             # Manager's minimum rate
rateManagerId: String           # Vault ID
managerFee: BigInt!             # Vault fee %
effectiveConversionRate: BigInt! # Fee-adjusted rate for taker-facing quotes
```

---

## Example GraphQL Queries

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
    depositHook
    uri
    createdAt
  }
}
```

### Get Vault by ID

```graphql
query VaultById($rateManagerId: String!) {
  RateManager(where: { rateManagerId: { _eq: $rateManagerId } }) {
    rateManagerId
    manager
    name
    fee
    maxFee
    feeRecipient
    depositHook
    uri
    createdAt
    updatedAt
  }
}
```

### Get Vault by Manager Address

```graphql
query VaultsByManager($manager: String!) {
  RateManager(where: { manager: { _eq: $manager } }) {
    rateManagerId
    name
    fee
    maxFee
    createdAt
  }
}
```

### Get All Rates for a Vault

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

### Get Active Rates Only (Non-Zero)

```graphql
query ActiveVaultRates($rateManagerId: String!) {
  RateManagerRate(where: {
    rateManagerId: { _eq: $rateManagerId }
    managerRate: { _gt: "0" }
  }) {
    paymentMethodHash
    currencyCode
    managerRate
  }
}
```

### Get Delegated Deposits for a Vault

```graphql
query DelegatedDeposits($rateManagerId: String!) {
  RateManagerDelegation(where: { rateManagerId: { _eq: $rateManagerId } }) {
    depositId
    createdAt
    updatedAt
  }
}
```

### Check If a Deposit Is Delegated

```graphql
query DepositDelegation($depositId: String!) {
  RateManagerDelegation(where: { depositId: { _eq: $depositId } }) {
    rateManagerId
    registry
    createdAt
  }
}
```

### Vault Aggregate Performance

```graphql
query VaultPerformance($rateManagerId: String!) {
  ManagerAggregateStats(where: { rateManagerId: { _eq: $rateManagerId } }) {
    totalFilledVolume
    totalFeeAmount
    totalPnlUsdCents
    fulfilledIntents
    currentDelegatedBalance
    currentDelegatedDeposits
    firstSeenAt
    updatedAt
  }
}
```

### Recent Intent-Level Stats

```graphql
query RecentIntentStats($rateManagerId: String!) {
  ManagerStats(
    where: { rateManagerId: { _eq: $rateManagerId } }
    order_by: { createdAt: desc }
    limit: 50
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

### Top Vaults by Volume

```graphql
query TopVaultsByVolume {
  ManagerAggregateStats(
    order_by: { totalFilledVolume: desc }
    limit: 10
  ) {
    rateManagerId
    manager
    totalFilledVolume
    totalFeeAmount
    fulfilledIntents
    currentDelegatedBalance
  }
}
```

### Vault Revenue Summary

```graphql
query VaultRevenue($rateManagerId: String!) {
  ManagerAggregateStats(where: { rateManagerId: { _eq: $rateManagerId } }) {
    totalFeeAmount
    totalFilledVolume
    fulfilledIntents
  }
  ManagerStats(
    where: { rateManagerId: { _eq: $rateManagerId } }
    order_by: { createdAt: desc }
    limit: 10
  ) {
    amount
    managerFeeAmount
    spreadBps
    pnlUsdCents
    createdAt
  }
}
```

### Deposits Managed by a Vault with Effective Rates

```graphql
query VaultDepositsWithRates($rateManagerId: String!) {
  RateManagerDelegation(where: { rateManagerId: { _eq: $rateManagerId } }) {
    depositId
  }
  RateManagerRate(where: { rateManagerId: { _eq: $rateManagerId } }) {
    paymentMethodHash
    currencyCode
    managerRate
  }
}
```

---

## Entity Relationship Diagram

```
RateManager (1)
    | rateManagerId
    |---> RateManagerRate (many: one per method/currency pair)
    |---> RateManagerDelegation (many: one per delegated deposit)
    |         | depositId
    |         +---> Deposit
    |                  |---> MethodCurrency (many, includes managerRate override)
    |                  |       +---> QuoteCandidate (denormalized, includes effectiveConversionRate)
    |                  +---> Intent (many, includes managerFee snapshot)
    |                           +---> ManagerStats (one per fulfilled intent)
    |
    +---> ManagerAggregateStats (one: rollup stats for this vault)
```
