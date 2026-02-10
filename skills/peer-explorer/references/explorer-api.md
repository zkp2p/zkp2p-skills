# Peer Explorer API -- Response Schemas

Complete type definitions for the Peerlytics explorer endpoints.

## Common Types

```typescript
type Numeric = string | number;

type DepositStatus = 'ACTIVE' | 'CLOSED' | 'WITHDRAWN';
type IntentStatus = 'SIGNALED' | 'FULFILLED' | 'PRUNED' | 'MANUALLY_RELEASED';
type IntentStatusFilter = IntentStatus | 'COMPLETED';
type SearchQueryType = 'tx_or_hash' | 'address' | 'deposit_id' | 'unknown';
```

## Search

**Method:** `client.search(query, opts?)`
**Endpoint:** `GET /api/v1/explorer/search`

### SearchParams

```typescript
interface SearchParams {
  q: string;
  type?: 'address' | 'hash' | 'deposit';
  role?: 'owner' | 'recipient' | 'verifier';
  limit?: number;
  offset?: number;
}
```

### Response

```typescript
{
  query: { raw: string; type: SearchQueryType };
  intents: EnrichedIntent[];
  deposits: DepositWithUsd[];
  linked: SearchLinkedData;
}
```

### SearchLinkedData

```typescript
interface SearchLinkedData {
  activity?: {
    ownerIntents: EnrichedIntent[];
    takerIntents: EnrichedIntent[];
    recipientIntents: EnrichedIntent[];
    verifierIntents: EnrichedIntent[];
    makerDeposits: DepositWithUsd[];
    escrowContracts: DepositWithUsd[];
  };
  intentsByDeposit?: Record<string, Array<IntentEntity & { amountUsd: number }>>;
  paymentDetails?: Record<string, PaymentDetails>;
  expiredCounts?: Record<string, number>;
  expiringSoon?: ExpiringSoonIntent[];
}
```

### ExpiringSoonIntent

```typescript
interface ExpiringSoonIntent {
  intentHash: string;
  depositId: string;
  owner: string;
  toAddress: string;
  verifier: string;
  fiatCurrency: string | null;
  signalTimestamp: Numeric | null;
  expiryTime: Numeric | null;
  paymentMethodHash: string | null;
}
```

---

## Deposit Detail

**Method:** `client.getDeposit(id, params?)`
**Endpoint:** `GET /api/v1/explorer/deposit/{id}`

### Response

```typescript
{
  deposit: DepositWithUsd;
  intents: EnrichedIntent[];
  linked: DepositDetailLinked;
}
```

### DepositDetailLinked

```typescript
interface DepositDetailLinked {
  paymentDetails?: PaymentDetails;
  expiredIntents?: Array<{
    intentHash: string;
    owner: string;
    toAddress: string;
    verifier: string;
    fiatCurrency: string | null;
    signalTimestamp: Numeric | null;
    expiryTime: Numeric | null;
    paymentMethodHash: string | null;
  }>;
  alternates?: DepositEntity[];
  makerDeposits?: Array<{
    id: string;
    depositId: Numeric;
    escrowAddress: string;
    availableUsd: number;
    outstandingUsd: number;
    takenUsd: number;
    acceptingIntents: boolean;
    status: string;
    fulfilledIntents: number;
    totalIntents: number;
    successRateBps: number;
    updatedAt: Numeric | null;
  }>;
}
```

### PaymentDetails

```typescript
interface PaymentDetails {
  currencies: string[];
  verifiers: string[];
  platforms: string[];
  payeeByMethod?: Record<string, string>;
}
```

---

## Intent Detail

**Method:** `client.getIntent(hash)`
**Endpoint:** `GET /api/v1/explorer/intent/{hash}`

### Response

```typescript
{
  intent: EnrichedIntent;
  deposit: DepositWithUsd | null;
  linked: IntentDetailLinked;
}
```

### IntentDetailLinked

```typescript
interface IntentDetailLinked {
  paymentDetails?: PaymentDetails;
  relatedIntents?: {
    sameDeposit: Array<IntentEntity & { amountUsd: number }>;
    sameOwner: Array<IntentEntity & { amountUsd: number }>;
  };
}
```

---

## Address Profile

**Method:** `client.getAddress(address, params?)`
**Endpoint:** `GET /api/v1/explorer/address/{address}`

### Response

```typescript
{
  intents: IntentEntity[];
  deposits: DepositEntity[];
  linked: { activity: AddressActivity };
  stats: AddressStats;
}
```

### AddressStats

```typescript
interface AddressStats {
  intents_total: number;
  intents_fulfilled: number;
  intents_pruned: number;
  deposits_total: number;
  volume_total_usd: number;
  volume_as_taker_usd: number;
  volume_as_recipient_usd: number;
  volume_as_maker_usd: number;
}
```

### AddressActivity

```typescript
interface AddressActivity {
  ownerIntents: IntentEntity[];
  recipientIntents: IntentEntity[];
  verifierIntents: IntentEntity[];
  makerDeposits: DepositEntity[];
  escrowContracts: DepositEntity[];
}
```

---

## Maker Portfolio

**Method:** `client.getMaker(address)`
**Endpoint:** `GET /api/v1/explorer/maker/{address}`

### Response: MakerPortfolioData

```typescript
interface MakerPortfolioData {
  summary: PortfolioSummary;
  deposits: PortfolioDeposit[];
  currencyAllocations: CurrencyAllocation[];
  platformAllocations: PlatformAllocation[];
}
```

### PortfolioSummary

```typescript
interface PortfolioSummary {
  address: string;
  totalDeposits: number;
  activeDeposits: number;
  totalLiquidityUsd: number;
  availableLiquidityUsd: number;
  lockedLiquidityUsd: number;
  totalFillVolumeUsd: number;
  totalProfitUsd: number;
  weightedAvgApr: number | null;
  capitalEfficiencyScore: number | null;
  successRate: number;
  fulfilledIntents: number;
  prunedIntents: number;
  totalIntents: number;
  firstSeenAt: string | null;
}
```

### PortfolioDeposit

```typescript
interface PortfolioDeposit {
  depositId: string;
  escrowAddress: string;
  status: 'active' | 'closed' | 'paused' | 'depleted';
  availableUsd: number;
  totalUsd: number;
  outstandingUsd: number;
  currencies: string[];
  platforms: string[];
  fillVolumeUsd: number;
  turnover: number | null;
  apr: number | null;
  successRate: number;
  fulfilledIntents: number;
  prunedIntents: number;
  totalIntents: number;
  openedAt: string | null;
  lastActivityAt: string | null;
}
```

### CurrencyAllocation

```typescript
interface CurrencyAllocation {
  currency: string;
  label: string;
  volumeUsd: number;
  percentage: number;
  fulfilledIntents: number;
}
```

### PlatformAllocation

```typescript
interface PlatformAllocation {
  platform: string;
  label: string;
  volumeUsd: number;
  percentage: number;
  fulfilledIntents: number;
  profitUsd: number;
}
```

---

## Verifier Stats

**Method:** `client.getVerifier(address, params?)`
**Endpoint:** `GET /api/v1/explorer/verifier/{address}`

### Response: VerifierResponse

```typescript
interface VerifierResponse {
  verifier: string;
  intents: IntentEntity[];
  stats: VerifierStats;
  breakdown: {
    currencies: CurrencyBreakdown[];
    topTakers: TopTaker[];
    topMakers: TopMaker[];
  };
  recentActivity: Array<{
    intentHash: string;
    status: string;
    amountUsd: number;
    currency: string;
    timestamp: Numeric;
    taker: string;
  }>;
}
```

### VerifierStats

```typescript
interface VerifierStats {
  totalIntents: number;
  fulfilledIntents: number;
  prunedIntents: number;
  signaledIntents: number;
  totalVolumeUsd: number;
  successRateBps: number | null;
  activeDeposits: number;
}
```

### CurrencyBreakdown / TopTaker / TopMaker

```typescript
interface CurrencyBreakdown { code: string; count: number; volume: number; }
interface TopTaker { address: string; count: number; volume: number; }
interface TopMaker { address: string; deposits: number; volume: number; liquidity: number; }
```

---

## List Deposits

**Method:** `client.getDeposits(filters)`
**Endpoint:** `GET /api/v1/deposits`

### DepositFilters

```typescript
interface DepositFilters {
  depositor?: string;
  delegate?: string;
  status?: DepositStatus;
  accepting?: boolean;
  platform?: string | string[];
  currency?: string | string[];
  limit?: number;
  offset?: number;
}
```

### Response: DepositsResponse

```typescript
interface DepositsResponse {
  deposits: EnrichedDeposit[];
  count: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  filters: {
    depositor: string | null;
    delegate: string | null;
    status: string | null;
    accepting: boolean | null;
    platforms: string[];
    currencies: string[];
  };
  matchedMarkets?: number;
}
```

---

## List Intents

**Method:** `client.getIntents(filters)`
**Endpoint:** `GET /api/v1/intents`

### IntentFilters

```typescript
interface IntentFilters {
  owner?: string;
  recipient?: string;
  verifier?: string;
  depositId?: string | string[];
  status?: IntentStatusFilter | IntentStatusFilter[];
  limit?: number;
  offset?: number;
}
```

### Response: IntentsResponse

```typescript
interface IntentsResponse {
  intents: EnrichedIntent[];
  count: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  filters: {
    owner: string | null;
    recipient: string | null;
    verifier: string | null;
    depositIds: string[];
    statuses: string[];
    includePrunedLike: boolean;
  };
}
```

---

## Maker History

**Method:** `client.getMakerHistory(address)`
**Endpoint:** `GET /api/v1/makers/{address}/history`

### Response: MakerHistoryData

```typescript
interface MakerHistoryData {
  deposits: {
    total: number;
    active: number;
    volumeUsd: number;
    platforms: Array<{ id: string; label: string; count: number }>;
    currencies: Array<{ code: string; label: string; count: number }>;
    recent: Array<{
      id: number;
      status: string;
      availableUsd: number;
      outstandingUsd: number;
      totalUsd: number;
      verifiers: string[];
      currencies: string[];
      updatedAt: string | null;
    }>;
  };
  intents: {
    total: number;
    fulfilled: number;
    pruned: number;
    successRate: number;
    volumeUsd: number;
    averageFulfillmentSeconds: number | null;
    medianFulfillmentSeconds: number | null;
    byCurrency: Array<{ code: string; label: string; volumeUsd: number; count: number }>;
    byPlatform: Array<{ platform: string; label: string; volumeUsd: number; count: number }>;
    recent: Array<{
      id: number;
      hash: string;
      status: string;
      amountUsd: number;
      currency: string;
      signalTimestamp: string;
      fulfillTimestamp: string | null;
      verifier: string;
    }>;
  };
  takerIntents: {
    total: number;
    volumeUsd: number;
  };
}
```

---

## Taker History

**Method:** `client.getTakerHistory(address)`
**Endpoint:** `GET /api/v1/takers/{address}/history`

### Response: TakerHistoryData

```typescript
interface TakerHistoryData {
  intents: {
    total: number;
    fulfilled: number;
    pruned: number;
    successRate: number;
    volumeUsd: number;
    averageFulfillmentSeconds: number | null;
    medianFulfillmentSeconds: number | null;
    byCurrency: Array<{ code: string; label: string; volumeUsd: number; count: number }>;
    byPlatform: Array<{ platform: string; label: string; volumeUsd: number; count: number }>;
    recent: Array<{
      id: number;
      hash: string;
      status: string;
      amountUsd: number;
      currency: string;
      signalTimestamp: string | null;
      fulfillTimestamp: string | null;
      verifier: string;
      depositId: string;
    }>;
  };
  stats: {
    lockScore: number;
    tier: string;
    tierProgress: {
      currentTier: string;
      nextTier: string | null;
      progress: number;
      volumeNeeded: number;
    };
    firstSeenAt: string | null;
    lastIntentAt: string | null;
  };
}
```

---

## Shared Entity Types

### DepositEntity

```typescript
interface DepositEntity {
  id: string;
  chainId: number;
  escrowAddress: string;
  depositId: Numeric;
  depositor: string;
  delegate?: string | null;
  token: string;
  remainingDeposits: string;
  intentAmountMin: string;
  intentAmountMax: string;
  acceptingIntents: boolean;
  status: DepositStatus;
  outstandingIntentAmount: string;
  totalAmountTaken: string;
  totalWithdrawn: string;
  totalIntents: number;
  signaledIntents: number;
  fulfilledIntents: number;
  prunedIntents: number;
  successRateBps: number | null;
  updatedAt: string | null;
  timestamp: string | null;
  blockNumber: Numeric | null;
  txHash: string | null;
}
```

### DepositWithUsd

```typescript
type DepositWithUsd = DepositEntity & {
  availableUsd: number;
  outstandingUsd: number;
  totalUsd: number;
  takenUsd: number;
  withdrawnUsd: number;
};
```

### EnrichedDeposit

```typescript
interface EnrichedDeposit extends DepositWithUsd {
  paymentMethods: DepositPaymentMethod[];
  currencies: MethodCurrency[];
  markets: DepositMarket[];
}
```

### DepositPaymentMethod

```typescript
interface DepositPaymentMethod {
  id: string;
  chainId: number;
  depositIdOnContract: Numeric;
  depositId: string;             // composite: escrowAddress_depositId
  paymentMethodHash: string;
  verifierAddress: string;
  intentGatingService: string;
  payeeDetailsHash: string | null;
  active?: boolean;
}
```

### MethodCurrency

```typescript
interface MethodCurrency {
  id: string;
  chainId: number;
  depositIdOnContract: Numeric;
  depositId: string;
  paymentMethodHash: string;
  currencyCode: string;
  minConversionRate: string;
}
```

### DepositMarket

```typescript
interface DepositMarket {
  platform: string;
  currency: string;
  rate: number;
  paymentMethodHash: string;
  currencyCode: string;
  minConversionRate: string;
}
```

### IntentEntity

```typescript
interface IntentEntity {
  id: string;
  intentHash: string;
  depositId: string;
  verifier: string;
  owner: string;
  toAddress: string;
  amount: string;
  fiatCurrency: string | null;
  conversionRate: string | null;
  status: IntentStatus;
  signalTimestamp: Numeric | null;
  signalTxHash: string | null;
  fulfillTxHash: string | null;
  pruneTxHash: string | null;
  paymentMethodHash: string | null;
  releasedAmount?: string | null;
  isExpired?: boolean;
  fulfillTimestamp?: Numeric | null;
  pruneTimestamp?: Numeric | null;
  expiryTime?: Numeric | null;
  paymentAmount?: string | null;
  paymentCurrency?: string | null;
  paymentTimestamp?: Numeric | null;
  paymentId?: string | null;
  takerAmountNetFees?: string | null;
}
```

### EnrichedIntent

```typescript
interface EnrichedIntent extends IntentEntity {
  amountUsd: number;
  signaledAmountUsd?: number;
  exchangeRate?: number | null;
  fiatAmount?: number | null;
  platform?: string | null;
  currency?: string | null;
  payeeDetailsHash?: string;
  paymentMethodName?: string | null;
  lifecycle?: {
    signalTimestamp: number | null;
    fulfillTimestamp: number | null;
    pruneTimestamp: number | null;
    expiryTimestamp: number | null;
    durationSeconds: number | null;
    outcome: 'pending' | 'fulfilled' | 'pruned' | 'expired';
  };
}
```

---

## Pagination

```typescript
interface PaginationParams {
  limit?: number;   // default varies by endpoint
  offset?: number;  // default 0
}
```

All list responses include:

```typescript
{
  count: number;     // total matching records
  hasMore: boolean;  // true if more pages exist
  limit: number;     // applied limit
  offset: number;    // applied offset
}
```
