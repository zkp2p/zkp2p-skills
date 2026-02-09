# ZKP2P Contract Reference

## Base Mainnet (Chain ID: 8453)

| Contract | Address | Purpose |
|----------|---------|---------|
| Escrow | `0x2f121CDDCA6d652f35e8B3E560f9760898888888` | Token custody |
| Orchestrator | `0x88888883Ed048FF0a415271B28b2F52d431810D0` | Intent lifecycle |
| UnifiedPaymentVerifier | `0x16b3e4a3CA36D3A4bCA281767f15C7ADeF4ab163` | Proof verification |
| SimpleAttestationVerifier | `0xED6C0C34c3964D239e7a315C55E620fafE5Ae3AC` | Witness verification |
| PaymentVerifierRegistry | `0x2b82D24437ff66Fb173eabDfD67ee2ACeb8bEb1e` | Method to verifier map |
| EscrowRegistry | `0xeD0e847B101abc96E796260AC358e12BAa2f5B21` | Approved escrows |
| PostIntentHookRegistry | `0x9B128EBAD4d874199A2Dc57E93186796c5EcAdE9` | Post-settlement hooks |
| NullifierRegistry | `0x8d8e1A0e5345a5cc9AA206c3ca76D6d28c514608` | Double-spend prevention |
| ProtocolViewer | `0x30B03De22328074Fbe8447C425ae988797146606` | Batch read helper |
| AcrossBridgeHook | `0x72C10b838Cf46649691949c285E0b468b363b9f0` | Cross-chain bridge |
| GatingService | `0x396D31055Db28C0C6f36e8b36f18FE7227248a97` | Intent validation |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Base USDC token |

## Vault Contracts (Base Staging)

| Contract | Address | Purpose |
|----------|---------|---------|
| DepositRateManagerRegistryV1 | `0x3125F621482887d158cb51cE9b54D9D25b145877` | Vault creation & rate mgmt |
| DepositRateManagerController | `0x2CF2FA7F21be0F920E1D8f4bb9C08E2c07F0E5d7` | Delegation & rate computation |

## Key Function Signatures

### Escrow

```solidity
// Create a new deposit with liquidity
createDeposit(
    address token,
    uint256 amount,
    uint256[2] intentAmountRange,   // [min, max] intent size
    bytes32[] processorNames,        // payment method identifiers
    bytes[] depositData,             // processor-specific config
    uint256[][] conversionRates      // rates per processor per currency
) returns (uint256 depositId)

// Add more funds to an existing deposit
addFunds(uint256 depositId, uint256 amount)

// Withdraw funds from deposit (only unlocked portion)
removeFunds(uint256 depositId, uint256 amount)

// Lock funds when an intent is signaled (called by Orchestrator)
lockFunds(bytes32 intentHash, uint256 depositId, uint256 amount)

// Unlock and transfer funds to buyer after proof verification
unlockAndTransferFunds(bytes32 intentHash, address to, uint256 amount)
```

### Orchestrator

```solidity
// Signal intent to buy crypto with fiat payment
signalIntent(
    uint256 depositId,
    uint256 amount,                  // USDC amount (6 decimals)
    address toAddress,               // recipient of USDC
    bytes32 processorName,           // payment method hash
    bytes payeeDetails,              // encrypted payment details
    bytes32 fiatCurrencyCode,        // currency hash
    uint256 conversionRate,          // rate from deposit
    address referrer,                // referral address (or address(0))
    address postIntentHook           // hook contract (or address(0))
) returns (bytes32 intentHash)

// Fulfill intent by submitting payment proof
fulfillIntent(bytes32 intentHash, bytes proof)

// Cancel intent (buyer-initiated, after expiry)
cancelIntent(bytes32 intentHash)

// Release funds back to payer/depositor (after intent expiry)
releaseFundsToPayer(bytes32 intentHash)
```

### DepositRateManagerRegistryV1 (Vault)

```solidity
// Create a new rate manager (vault)
createRateManager(
    RateManagerConfig config         // name, description, metadata
) returns (bytes32 rateManagerId)

// Set minimum conversion rate for a specific payment method + currency
setMinRate(
    bytes32 rateManagerId,
    bytes32 paymentMethodHash,       // keccak256(platformName)
    bytes32 currencyHash,            // keccak256(currencyCode)
    uint256 rate                     // 1e18 precision
)

// Batch set rates across multiple methods and currencies
setMinRatesBatch(
    bytes32 rateManagerId,
    bytes32[][] paymentMethods,      // per-group method hashes
    bytes32[][] currencies,          // per-group currency hashes
    uint256[][] rates                // per-group rates
)

// Set vault fee (max 5%, snapshotted at intent signal time)
setFee(bytes32 rateManagerId, uint256 newFee)
```

### DepositRateManagerController (Vault)

```solidity
// Delegate deposit rate management to a vault
setDepositRateManager(
    address escrow,
    uint256 depositId,
    address registry,
    bytes32 rateManagerId
)

// Remove vault delegation from a deposit
clearDepositRateManager(
    address escrow,
    uint256 depositId
)
```

### ProtocolViewer (Read Helpers)

```solidity
// Batch read deposit details
getDeposits(address escrow, uint256[] depositIds) returns (Deposit[])

// Get all intents for a deposit
getIntentsForDeposit(address orchestrator, uint256 depositId) returns (Intent[])

// Get intent details
getIntent(address orchestrator, bytes32 intentHash) returns (Intent)
```

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `https://api.zkp2p.xyz` | Core API (quotes, gating, deposits) |
| `https://attestation-service.zkp2p.xyz` | Production attestation service |
| `https://attestation-service-staging.zkp2p.xyz` | Staging attestation service |
| `https://api.pay.zkp2p.xyz` | Pay checkout API |
| `https://merchant.pay.zkp2p.xyz` | Merchant dashboard |
| `https://api-staging.zkp2p.xyz` | Staging core API |
| `https://indexer.hyperindex.xyz/00be13d/v1/graphql` | Staging indexer (GraphQL) |

## ABI Sources

ABIs can be obtained from:
- Basescan verified contracts (paste address into basescan.org)
- `@zkp2p/offramp-sdk` package (bundled ABIs)
- ZKP2P GitHub repositories

## Common Patterns

### Deposit Lifecycle
1. LP approves USDC to Escrow contract
2. LP calls `createDeposit()` with rates and payment methods
3. Buyer calls `signalIntent()` on Orchestrator (locks funds in Escrow)
4. Buyer sends fiat payment off-chain
5. Buyer generates proof of payment
6. Buyer (or relayer) calls `fulfillIntent()` with proof
7. Escrow releases USDC to buyer

### Vault Delegation Flow
1. Manager calls `createRateManager()` on Registry
2. Manager sets rates via `setMinRate()` or `setMinRatesBatch()`
3. Manager sets fee via `setFee()` (up to 5%)
4. Depositor calls `setDepositRateManager()` on Controller to delegate
5. Effective rate = `max(depositorFloor, managerRate)`
6. Fee is snapshotted when intent is signaled, not when fulfilled
