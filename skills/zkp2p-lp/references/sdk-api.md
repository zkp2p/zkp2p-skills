# @zkp2p/offramp-sdk -- LP Method Reference

Complete API reference for all `@zkp2p/offramp-sdk` methods relevant to liquidity provider management.

## Installation

```bash
npm install @zkp2p/offramp-sdk viem
```

## Client Initialization

```typescript
import { OfframpClient } from '@zkp2p/offramp-sdk';
// Alias: import { Zkp2pClient } from '@zkp2p/offramp-sdk';

const client = new OfframpClient(options: Zkp2pClientOptions);
```

### Zkp2pClientOptions

```typescript
type Zkp2pClientOptions = {
  walletClient: WalletClient;          // viem WalletClient with account (required)
  chainId: number;                     // 8453 (Base) or 84532 (Base Sepolia) (required)
  runtimeEnv?: 'production' | 'staging'; // Default: 'production'
  rpcUrl?: string;                     // Override RPC endpoint
  indexerUrl?: string;                 // Override indexer endpoint
  baseApiUrl?: string;                 // Override API base (default: 'https://api.zkp2p.xyz')
  apiKey?: string;                     // Required for createDeposit, signalIntent
  authorizationToken?: string;         // Optional bearer token
  timeouts?: { api?: number };         // API timeout in ms (default: 15000)
};
```

---

## Deposit Creation

### ensureAllowance

Approve the Escrow contract to spend ERC20 tokens. No-ops if current allowance is sufficient.

```typescript
client.ensureAllowance(params: {
  token: Address;           // Token contract address (e.g., USDC)
  amount: bigint;           // Amount to approve
  spender?: Address;        // Defaults to Escrow contract
  maxApprove?: boolean;     // If true, approve MaxUint256
  txOverrides?: TxOverrides;
}): Promise<{
  hadAllowance: boolean;    // true if no approval was needed
  hash?: Hash;              // Approval tx hash (only if approval was sent)
}>
```

### createDeposit

Create a new liquidity deposit in the Escrow contract. Requires prior ERC20 approval.

```typescript
client.createDeposit(params: {
  token: Address;                                    // ERC20 token (USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
  amount: bigint;                                    // Deposit amount in token decimals (USDC = 6 decimals)
  intentAmountRange: { min: bigint; max: bigint };   // Min/max USDC per individual intent
  processorNames: string[];                          // Payment platforms: ['wise', 'revolut', 'venmo', ...]
  depositData: { [key: string]: string }[];          // Payee data, one entry per processorName
  conversionRates: {                                 // One array per processorName
    currency: string;                                // Fiat currency code: 'USD', 'EUR', 'GBP', etc.
    conversionRate: string;                          // 18-decimal string: '1020000000000000000' = 1.02x
  }[][];
  delegate?: Address;                                // Address authorized to manage this deposit
  intentGuardian?: Address;                          // Address that can extend intent expiry
  retainOnEmpty?: boolean;                           // Keep config when balance = 0 (default: false)
  txOverrides?: TxOverrides;
}): Promise<{
  depositDetails: PostDepositDetailsRequest[];       // Registered payee details (contains depositId after confirmation)
  hash: Hash;                                        // Transaction hash
}>
```

**Notes:**
- `processorNames`, `depositData`, and `conversionRates` arrays must have the same length (one entry per payment method).
- Conversion rates use 18-decimal precision: `1e18 = 1.00x` (par), `1.02e18 = 2% markup`.
- The SDK automatically registers payee details with the ZKP2P API and hashes them for on-chain storage.

---

## Deposit Management

### addFunds

Add USDC to an existing deposit. Permissionless -- any address can call this.

```typescript
client.addFunds(params: {
  depositId: bigint;
  amount: bigint;            // Amount in token decimals
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### removeFunds

Withdraw available (unlocked) USDC from a deposit. Restricted to depositor or delegate.

```typescript
client.removeFunds(params: {
  depositId: bigint;
  amount: bigint;            // Cannot exceed remainingDeposits
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### withdrawDeposit

Withdraw all available USDC and mark deposit inactive. Fails if outstanding intents exist.

```typescript
client.withdrawDeposit(params: {
  depositId: bigint;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### setAcceptingIntents

Toggle whether the deposit accepts new intents. Does not affect existing active intents.

```typescript
client.setAcceptingIntents(params: {
  depositId: bigint;
  accepting: boolean;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### setIntentRange

Update the minimum and maximum USDC amount per intent.

```typescript
client.setIntentRange(params: {
  depositId: bigint;
  min: bigint;               // Minimum USDC per intent (6 decimals)
  max: bigint;               // Maximum USDC per intent (6 decimals)
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### setCurrencyMinRate

Set the minimum conversion rate for a specific payment method + fiat currency pair.

```typescript
client.setCurrencyMinRate(params: {
  depositId: bigint;
  paymentMethod: `0x${string}`;      // keccak256 hash of payment method name
  fiatCurrency: `0x${string}`;       // keccak256 hash of currency code
  minConversionRate: bigint;          // 18-decimal precision (1e18 = 1.00x)
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

**Rate examples:**
- `1000000000000000000n` = 1.00x (no markup)
- `1010000000000000000n` = 1.01x (1% markup)
- `1050000000000000000n` = 1.05x (5% markup)
- `0n` = deactivates the currency pair

### setRetainOnEmpty

When true, deposit configuration persists even when balance reaches zero.

```typescript
client.setRetainOnEmpty(params: {
  depositId: bigint;
  retain: boolean;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### setDelegate

Assign a delegate address that can manage the deposit on behalf of the owner.

```typescript
client.setDelegate(params: {
  depositId: bigint;
  delegate: Address;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### removeDelegate

Remove the current delegate from the deposit.

```typescript
client.removeDelegate(params: {
  depositId: bigint;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### addPaymentMethods

Add one or more payment methods to an existing deposit.

```typescript
client.addPaymentMethods(params: {
  depositId: bigint;
  paymentMethods: `0x${string}`[];                // keccak256 hashes
  paymentMethodData: {
    intentGatingService?: Address;
    payeeDetails: `0x${string}`;
    data?: `0x${string}`;
  }[];
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### setPaymentMethodActive

Enable or disable a specific payment method on the deposit.

```typescript
client.setPaymentMethodActive(params: {
  depositId: bigint;
  paymentMethod: `0x${string}`;
  isActive: boolean;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### removePaymentMethod

Permanently remove a payment method from the deposit.

```typescript
client.removePaymentMethod(params: {
  depositId: bigint;
  paymentMethod: `0x${string}`;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### addCurrencies

Add supported currencies to a payment method on the deposit.

```typescript
client.addCurrencies(params: {
  depositId: bigint;
  paymentMethod: `0x${string}`;
  currencies: {
    code: `0x${string}`;           // keccak256 hash of currency code
    minConversionRate: bigint;      // 18-decimal precision
  }[];
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### deactivateCurrency

Deactivate a currency on a payment method (sets minConversionRate to 0).

```typescript
client.deactivateCurrency(params: {
  depositId: bigint;
  paymentMethod: `0x${string}`;
  currencyCode: `0x${string}`;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

### pruneExpiredIntents

Remove expired intents from a deposit, unlocking their funds back to `remainingDeposits`. Permissionless.

```typescript
client.pruneExpiredIntents(params: {
  depositId: bigint;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

---

## Deposit Queries

### getDeposits

Get all deposits owned by the connected wallet. Reads from ProtocolViewer contract (RPC).

```typescript
client.getDeposits(): Promise<PV_DepositView[]>
```

### getAccountDeposits

Get all deposits owned by any address.

```typescript
client.getAccountDeposits(owner: Address): Promise<PV_DepositView[]>
```

### getDeposit

Get a single deposit by ID.

```typescript
client.getDeposit(depositId: bigint | number | string): Promise<PV_DepositView>
```

### getDepositsById

Batch-fetch multiple deposits by their IDs.

```typescript
client.getDepositsById(depositIds: Array<bigint | number | string>): Promise<PV_DepositView[]>
```

### PV_DepositView Type

```typescript
type PV_DepositView = {
  depositId: bigint;
  depositor: Address;
  delegate: Address;
  token: Address;
  intentAmountRange: { min: bigint; max: bigint };
  acceptingIntents: boolean;
  remainingDeposits: bigint;          // Available (unlocked) balance
  outstandingIntentAmount: bigint;    // Locked in active intents
  intentGuardian: Address;
  retainOnEmpty: boolean;
  paymentMethods: `0x${string}`[];    // Active payment method hashes
  // Additional fields from ProtocolViewer batch reads
};
```

---

## Intent Queries

### getIntents

Get all intents associated with the connected wallet's deposits.

```typescript
client.getIntents(): Promise<PV_IntentView[]>
```

### getAccountIntents

Get all intents for any address.

```typescript
client.getAccountIntents(owner: Address): Promise<PV_IntentView[]>
```

### getIntent

Get a single intent by hash.

```typescript
client.getIntent(intentHash: `0x${string}`): Promise<PV_IntentView>
```

### PV_IntentView Type

```typescript
type PV_IntentView = {
  intentHash: `0x${string}`;
  depositId: bigint;
  amount: bigint;
  timestamp: bigint;
  expiryTime: bigint;
  status: string;                     // 'active' | 'fulfilled' | 'cancelled' | 'expired'
  owner: Address;
  to: Address;
  paymentMethod: `0x${string}`;
  fiatCurrency: `0x${string}`;
  conversionRate: bigint;
};
```

### resolvePayeeHash

Resolve the payee hash for a deposit's payment method (for verifying payee details).

```typescript
client.resolvePayeeHash(
  depositId: bigint,
  paymentMethodHash: string
): Promise<string | null>
```

---

## Intent Operations (Depositor-Side)

### releaseFundsToPayer

As a depositor, manually release locked funds back to the intent owner (buyer). Use when a fiat payment was reversed or disputed.

```typescript
client.releaseFundsToPayer(params: {
  intentHash: `0x${string}`;
  txOverrides?: TxOverrides;
}): Promise<Hash>
```

---

## Quote API

### getQuote

Fetch a quote for a fiat-to-crypto conversion. Returns available deposits and rates.

```typescript
client.getQuote(req: {
  paymentPlatforms: string[];        // e.g., ['wise', 'revolut']
  fiatCurrency: string;              // e.g., 'EUR'
  user: string;                      // Buyer address
  recipient: string;                 // Token recipient address
  destinationChainId: number;        // 8453 for Base
  destinationToken: string;          // Token address (e.g., USDC)
  amount: string;                    // Amount (in fiat or token units)
  isExactFiat?: boolean;             // true = amount is in fiat units
  escrowAddresses?: string[];        // Filter by specific escrow contracts
  includeNearbyQuotes?: boolean;     // Include slightly off-rate quotes
  nearbySearchRange?: number;        // Max % deviation (e.g., 10)
  nearbyQuotesCount?: number;        // 1-10, default 3
}, opts?: {
  baseApiUrl?: string;
  timeoutMs?: number;
}): Promise<QuoteResponse>
```

### QuoteResponse Type

```typescript
type QuoteResponse = {
  quotes: Array<{
    depositId: string;
    escrowAddress: string;
    amount: string;
    conversionRate: string;
    paymentMethod: string;
    fiatCurrency: string;
    payeeDetails: string;
  }>;
  nearbyQuotes?: Array<{...}>;
};
```

---

## Contract Resolution

### getContracts

Get deployed contract addresses and ABIs for a given chain and environment.

```typescript
import { getContracts } from '@zkp2p/offramp-sdk';

const { addresses, abis } = getContracts(
  chainId: number,           // 8453 or 84532
  env: 'production' | 'staging'
);
```

**Return type:**

```typescript
{
  addresses: {
    escrow: Address;                    // 0x2f121CDDCA6d652f35e8B3E560f9760898888888
    orchestrator: Address;              // 0x88888883Ed048FF0a415271B28b2F52d431810D0
    unifiedPaymentVerifier: Address;    // 0x16b3e4a3CA36D3A4bCA281767f15C7ADeF4ab163
    protocolViewer: Address;            // 0x30B03De22328074Fbe8447C425ae988797146606
    usdc: Address;                      // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  };
  abis: {
    escrow: Abi;
    orchestrator: Abi;
    // ...
  };
}
```

### getPaymentMethodsCatalog

Get the catalog of supported payment methods, their hashes, and supported currencies.

```typescript
import { getPaymentMethodsCatalog } from '@zkp2p/offramp-sdk';

const catalog = getPaymentMethodsCatalog(
  chainId: number,
  env: 'production' | 'staging'
);
```

**Return type:**

```typescript
{
  [processorName: string]: {
    paymentMethodHash: `0x${string}`;    // keccak256 of processor name
    currencies: `0x${string}`[];          // keccak256 hashes of currency codes
  };
}
```

**Example:**

```typescript
const catalog = getPaymentMethodsCatalog(8453, 'production');
// catalog.wise.paymentMethodHash  -> "0x..."
// catalog.wise.currencies         -> ["0x...", "0x..."]
// catalog.revolut.paymentMethodHash -> "0x..."
```

### getGatingServiceAddress

Get the gating service public address for intent signature validation.

```typescript
import { getGatingServiceAddress } from '@zkp2p/offramp-sdk';

const address = getGatingServiceAddress(
  chainId: number,
  env: 'production' | 'staging'
);
// Base mainnet: "0x396D31055Db28C0C6f36e8b36f18FE7227248a97"
```

---

## Payment Resolution Utilities

### resolvePaymentMethodHash

Convert a payment method name to its keccak256 bytes32 hash.

```typescript
import { resolvePaymentMethodHash } from '@zkp2p/offramp-sdk';

const hash = resolvePaymentMethodHash('wise');
// Returns keccak256("wise") as `0x${string}`
```

### resolveFiatCurrencyBytes32

Convert a fiat currency code to its keccak256 bytes32 hash.

```typescript
import { resolveFiatCurrencyBytes32 } from '@zkp2p/offramp-sdk';

const hash = resolveFiatCurrencyBytes32('USD');
// Returns keccak256("USD") as `0x${string}`
```

### resolvePaymentMethodHashFromCatalog

Resolve a payment method hash from the on-chain catalog.

```typescript
import { resolvePaymentMethodHashFromCatalog } from '@zkp2p/offramp-sdk';

const hash = resolvePaymentMethodHashFromCatalog('wise', 8453, 'production');
```

### resolvePaymentMethodNameFromHash

Reverse-resolve a payment method hash back to its name.

```typescript
import { resolvePaymentMethodNameFromHash } from '@zkp2p/offramp-sdk';

const name = resolvePaymentMethodNameFromHash('0x...', 8453, 'production');
// Returns 'wise' | 'revolut' | 'venmo' | etc.
```

---

## Currency Utilities

```typescript
import { Currency, currencyInfo, getCurrencyInfoFromHash } from '@zkp2p/offramp-sdk';

// Currency enum includes 35+ currencies:
// Currency.USD, Currency.EUR, Currency.GBP, Currency.SGD, Currency.AUD,
// Currency.CAD, Currency.CHF, Currency.JPY, Currency.INR, etc.

// Get currency metadata
const info = currencyInfo[Currency.USD];
// { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 }

// Reverse lookup from hash
const currency = getCurrencyInfoFromHash('0x...');
```

---

## Utility Methods

### getUsdcAddress

Get the USDC address for the configured chain.

```typescript
client.getUsdcAddress(): Address | undefined
```

### getDeployedAddresses

Get all deployed contract addresses for the configured chain and environment.

```typescript
client.getDeployedAddresses(): {
  escrow: Address;
  orchestrator?: Address;
  protocolViewer?: Address;
  unifiedPaymentVerifier?: Address;
  usdc?: Address;
}
```

### getFulfillIntentInputs

Get the parameters needed to fulfill an intent (primarily for takers, but useful for LP monitoring).

```typescript
client.getFulfillIntentInputs(intentHash: `0x${string}`): Promise<{
  amount: string;
  fiatCurrency: `0x${string}`;
  conversionRate: string;
  payeeDetails: `0x${string}`;
  intentTimestampMs: string;
  paymentMethodHash: `0x${string}`;
}>
```

---

## Indexer API

The SDK includes an optional indexer client for richer queries. Access via `client.indexer.*`.

### getDeposits (indexer)

```typescript
client.indexer.getDeposits(
  filter?: DepositFilter,
  pagination?: { first?: number; skip?: number }
): Promise<DepositEntity[]>
```

### getDepositsWithRelations

```typescript
client.indexer.getDepositsWithRelations(
  filter?: DepositFilter,
  pagination?: { first?: number; skip?: number },
  options?: { includeIntents?: boolean }
): Promise<DepositWithRelations[]>
```

### getDepositById

```typescript
client.indexer.getDepositById(
  compositeId: string,              // Format: "chainId_escrowAddress_depositId"
  options?: { includeIntents?: boolean }
): Promise<DepositWithRelations | null>
```

### getIntentsForDeposits

```typescript
client.indexer.getIntentsForDeposits(
  depositIds: string[],
  statuses?: string[]
): Promise<IntentEntity[]>
```

### getOwnerIntents

```typescript
client.indexer.getOwnerIntents(
  owner: string,
  statuses?: string[]
): Promise<IntentEntity[]>
```

### getExpiredIntents

```typescript
client.indexer.getExpiredIntents(params: {
  depositIds?: string[];
  beforeTimestamp?: number;
}): Promise<IntentEntity[]>
```

---

## TxOverrides Type

All write methods accept optional `txOverrides` for gas and nonce control.

```typescript
type TxOverrides = {
  gas?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  value?: bigint;
  accessList?: AccessList;
  authorizationList?: AuthorizationList;
  referrer?: string | string[];      // ERC-8021 referrer codes
};
```

---

## Platform Attestation Config

Maps SDK platform names to attestation service endpoint paths. Useful for understanding which proof endpoint handles which payment method.

```typescript
const PLATFORM_ATTESTATION_CONFIG = {
  wise:           { actionType: 'transfer_wise',        actionPlatform: 'wise' },
  venmo:          { actionType: 'transfer_venmo',       actionPlatform: 'venmo' },
  revolut:        { actionType: 'transfer_revolut',     actionPlatform: 'revolut' },
  cashapp:        { actionType: 'transfer_cashapp',     actionPlatform: 'cashapp' },
  mercadopago:    { actionType: 'transfer_mercadopago', actionPlatform: 'mercadopago' },
  paypal:         { actionType: 'transfer_paypal',      actionPlatform: 'paypal' },
  monzo:          { actionType: 'transfer_monzo',       actionPlatform: 'monzo' },
  'zelle-chase':  { actionType: 'transfer_zelle',       actionPlatform: 'chase' },
  'zelle-bofa':   { actionType: 'transfer_zelle',       actionPlatform: 'bankofamerica' },
  'zelle-citi':   { actionType: 'transfer_zelle',       actionPlatform: 'citi' },
};
```

Attestation endpoint pattern: `POST {attestationServiceUrl}/verify/{actionPlatform}/{actionType}`

Production attestation service: `https://attestation-service.zkp2p.xyz`

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | USDC token on Base mainnet |
| USDC decimals | 6 | 1 USDC = `1_000000` |
| Rate precision | 18 | 1.00x = `1_000000000000000000` |
| Max protocol fee | 5% | `5e16` in preciseUnits |
| Max referrer fee | 5% | `5e16` in preciseUnits |
| Max intent expiry | 5 days | 432000 seconds |
| Dust threshold | 1 USDC | `1e6` -- deposits below this can be swept |
| Chain ID (Base) | 8453 | Production mainnet |
| Chain ID (Base Sepolia) | 84532 | Testnet |

---

## Supported Networks

| Network | Chain ID | Environment | API Base |
|---------|----------|-------------|----------|
| Base Mainnet | 8453 | production | `https://api.zkp2p.xyz` |
| Base Sepolia | 84532 | production (testnet) | `https://api.zkp2p.xyz` |
| Hardhat | 31337 | development | localhost |
