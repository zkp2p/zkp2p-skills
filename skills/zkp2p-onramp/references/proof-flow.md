# On-Ramp Proof Generation Reference

## Proof Generation via Reclaim Protocol (Primary Approach)

The PeerAuth browser extension generates proofs via `@reclaimprotocol/attestor-core`. This same library works in Node.js, enabling headless agent proof generation.

### Core Function

```typescript
import { createClaimOnAttestor } from '@reclaimprotocol/attestor-core';
// Version: ^4.0.3
// Compatible with: Browser & Node.js

const proof = await createClaimOnAttestor(witnessClaimRequest);
// Returns: { claim, signatures } or { error }
```

### WitnessClaimRequest Schema

```typescript
type WitnessClaimRequest = {
  // Provider name — always "http" for ZKP2P payment proofs
  name: 'http';

  // Links proof to an on-chain intent
  context: {
    contextAddress: string;   // '0x0' (unused in ZKP2P)
    contextMessage: string;   // intentHash (e.g., '0xabc123...')
  };

  // HTTP request the attestor will fetch & verify
  params: {
    url: string;              // Target API URL (from provider template, params filled)
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    body: string;             // Request body (empty for GET)
    headers: Record<string, string>;  // Non-secret request headers
    paramValues: Record<string, string>; // Extracted parameter values

    // What to verify in the response
    responseMatches: Array<{
      type: 'regex' | 'jsonPath';
      value: string;
      hash?: boolean;
    }>;

    // What to selectively reveal (everything else is redacted)
    responseRedactions: Array<{
      jsonPath?: string;
      regex?: string;
      xPath?: string;
    }>;

    additionalClientOptions?: {
      cipherSuites?: string[];
    };
    geoLocation?: string;
  };

  // Authentication credentials — hidden from attestor via TLS key-update
  secretParams: {
    cookieStr?: string;                    // For Cookie header (Venmo, CashApp, banks)
    headers?: Record<string, string>;      // For Authorization header (Wise, Revolut)
  };

  ownerPrivateKey: string;    // Hex private key for signing claims
  client: {
    url: string;              // Attestor WebSocket endpoint
  };
  zkProofConcurrency?: number;
};
```

### How It Works

1. Agent builds `WitnessClaimRequest` from provider template + auth credentials
2. `createClaimOnAttestor` establishes WebSocket connection to attestor
3. Attestor establishes TLS tunnel to payment platform API
4. Agent's auth credentials are sent via TLS (attestor cannot read them due to key-update)
5. Attestor verifies the response matches `responseMatches` patterns
6. Attestor signs the claim (attesting to the verified response content)
7. Returns `{ claim, signatures }` — the Reclaim proof

---

## Attestation Service API

### Endpoint

```
POST {attestationServiceUrl}/verify/{platform}/{actionType}
```

**Production**: `https://attestation-service.zkp2p.xyz`
**Staging**: `https://attestation-service-staging.zkp2p.xyz`

### Platform / ActionType Combinations

| Platform | ActionType | Proofs Required | Auth Type |
|----------|-----------|:---------------:|-----------|
| venmo | `transfer_venmo` | 1 | Cookie |
| wise | `transfer_wise` | 2 | Bearer token |
| revolut | `transfer_revolut` | 1 | Bearer token |
| cashapp | `transfer_cashapp` | 1 | Cookie |
| mercadopago | `transfer_mercadopago` | 1 | Cookie |
| paypal | `transfer_paypal` | 1 | OAuth/Cookie |
| monzo | `transfer_monzo` | 1 | Cookie |
| chase | `transfer_zelle` | 1 | Cookie |
| bankofamerica | `transfer_zelle` | 1 | Cookie |
| citi | `transfer_zelle` | 1 | Cookie |

Wise requires 2 proofs because transfer list and delivery confirmation are separate API calls.

### Request Schema

```json
{
  "proofType": "reclaim",
  "proof": "<stringified Reclaim proof JSON>",
  "chainId": 8453,
  "verifyingContract": "0x16b3e4a3CA36D3A4bCA281767f15C7ADeF4ab163",
  "intent": {
    "intentHash": "0x...",
    "amount": "100000000",
    "timestampMs": "1707000000000",
    "paymentMethod": "0x...",
    "fiatCurrency": "0x...",
    "conversionRate": "1020000000000000000",
    "payeeDetails": "0x...",
    "timestampBufferMs": "300000"
  }
}
```

### Response Schema

```json
{
  "attestation": {
    "intentHash": "0x...",
    "releaseAmount": "100000000",
    "dataHash": "0x...",
    "signatures": ["0x..."],
    "data": "0x...",
    "metadata": "0x..."
  }
}
```

---

## On-Chain Attestation Structures

```solidity
struct PaymentAttestation {
    bytes32 intentHash;
    uint256 releaseAmount;
    bytes32 dataHash;        // keccak256(data)
    bytes[] signatures;      // Witness signatures (EIP-712)
    bytes data;              // abi.encode(PaymentDetails, IntentSnapshot)
    bytes metadata;
}

struct PaymentDetails {
    bytes32 method;          // keccak256("venmo"), keccak256("wise"), etc.
    bytes32 payeeId;         // Hashed payee identifier
    uint256 amount;          // Fiat amount in smallest unit (cents)
    bytes32 currency;        // keccak256("USD"), keccak256("EUR"), etc.
    uint256 timestamp;       // Payment timestamp (UTC ms)
    bytes32 paymentId;       // Hashed payment ID (nullifier)
}

struct IntentSnapshot {
    bytes32 intentHash;
    uint256 amount;          // USDC (6 decimals)
    bytes32 paymentMethod;
    bytes32 fiatCurrency;
    bytes32 payeeDetails;
    uint256 conversionRate;  // 1e18 precision
    uint256 signalTimestamp;
    uint256 timestampBuffer;
}
```

### EIP-712 Domain

```solidity
EIP712Domain {
    name: "UnifiedPaymentVerifier",
    version: "1",
    chainId: 8453,
    verifyingContract: 0x16b3e4a3CA36D3A4bCA281767f15C7ADeF4ab163
}
```

TypeHash: `PaymentAttestation(bytes32 intentHash,uint256 releaseAmount,bytes32 dataHash)`

### Verification Logic (On-Chain)

1. `UnifiedPaymentVerifier` decodes `attestation.data` into `(PaymentDetails, IntentSnapshot)`
2. Verifies `keccak256(attestation.data) == attestation.dataHash`
3. Validates intent snapshot matches on-chain state
4. Checks payment timestamp within `timestampBuffer` of signal time (max 48h)
5. `SimpleAttestationVerifier` validates EIP-712 signatures against registered witness
6. Nullifier `keccak256(paymentMethod, paymentId)` registered to prevent double-spend
7. Escrow releases USDC to `intent.to` address

---

## Platform-Specific Proof Details

### Venmo

```typescript
// Provider: @zkp2p/providers/venmo/transfer_venmo.json
// Auth: Cookie (api_access_token, v_id, login)
// Transaction API: GET /api/stories?feedType=me&externalId={{SENDER_ID}}
// paramNames: ["SENDER_ID"]
// responseMatches: amount, date, paymentId, receiverId, subType
// secretHeaders: ["Cookie"]
// additionalClientOptions.cipherSuites: ["TLS_AES_128_GCM_SHA256", ...]

// Nuances:
// - Amount format: "- $50.00" (negative = outgoing)
// - subType must be "none" or "business_profile"
// - Rate limits on API access; cache sessions
// - SENDER_ID extracted from $.stories[INDEX].title.sender.id
```

### Wise

```typescript
// Provider: @zkp2p/providers/wise/transfer_wise.json
// Auth: Bearer token (personal API token)
// Transaction API: GET /gateway/v3/profiles/{{PROFILE_ID}}/transfers?status=outgoing_payment_sent
// requiredProofs: 2 (unique among all providers)
// First proof: transfer list endpoint
// Second proof: transfer detail endpoint (via additionalProofs[0])

// Nuances:
// - Most agent-friendly: proper OAuth, no 2FA on API
// - Personal tokens never expire until revoked
// - 35+ currencies supported
// - Profile ID resolved via GET /v1/profiles
```

### Revolut

```typescript
// Provider: @zkp2p/providers/revolut/transfer_revolut.json
// Auth: Bearer token
// Transaction API: GET /api/retail/user/current/transactions/last?count=20
// authLink: https://app.revolut.com

// Nuances:
// - Aggressive anti-automation detection
// - Short token expiry
// - Revolut Business API better for programmatic access
```

---

## Provider Template Usage

Provider templates from `@zkp2p/providers` define the HTTP requests to make:

### URL Interpolation

```typescript
// Template: "https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}"
// Replace {{PARAM}} with actual values from paramValues
let url = provider.url;
for (const [key, value] of Object.entries(paramValues)) {
  url = url.replace(`{{${key}}}`, value);
}
```

### Response Matching ({{INDEX}} replacement)

```typescript
// Templates use {{INDEX}} for the transaction position in the list
const responseMatches = provider.responseMatches.map(m => ({
  ...m,
  value: m.value.replace(/\{\{INDEX\}\}/g, String(transactionIndex)),
}));

const responseRedactions = provider.responseRedactions.map(r => ({
  jsonPath: r.jsonPath?.replace(/\{\{INDEX\}\}/g, String(transactionIndex)),
  xPath: r.xPath?.replace(/\{\{INDEX\}\}/g, String(transactionIndex)),
}));
```

### Transaction Selection

```json
{
  "transactionsExtraction": {
    "transactionJsonPathListSelector": "$.stories",
    "transactionJsonPathSelectors": {
      "recipient": "$.title.receiver.username",
      "amount": "$.amount",
      "date": "$.date",
      "paymentId": "$.paymentId"
    }
  }
}
```

The agent must fetch the transaction feed, identify the correct transaction, and use its index.

---

## Flow Diagram

```
Agent                     Attestor Service           Payment Platform
  |                            |                          |
  |-- createClaimOnAttestor -->|                          |
  |   (WitnessClaimRequest)   |                          |
  |                            |-- TLS tunnel ----------->|
  |                            |   (agent's auth via      |
  |                            |    key-update, hidden)   |
  |                            |                          |
  |                            |<-- API response ---------|
  |                            |                          |
  |                            |-- verify responseMatches |
  |                            |-- apply redactions       |
  |                            |-- sign claim             |
  |                            |                          |
  |<-- { claim, signatures } --|                          |
  |                            |                          |
  |-- POST /verify/platform/action -->                    |
  |   (to attestation-service.zkp2p.xyz)                  |
  |<-- PaymentAttestation ---                             |
  |                                                       |
  |-- fulfillIntent() on-chain                            |
  |<-- USDC received                                      |
```

---

## Error Codes

| Error | Cause | Resolution |
|-------|-------|------------|
| `INVALID_PROOF` | Proof failed verification | Re-generate with correct credentials |
| `INTENT_NOT_FOUND` | Intent hash does not exist | Verify intent was signaled |
| `INTENT_EXPIRED` | Expiration time passed | Signal new intent |
| `TIMESTAMP_OUT_OF_RANGE` | Payment too old/new | Payment must be within timestampBuffer |
| `NULLIFIER_ALREADY_USED` | Payment ID reused | Each payment fulfills one intent only |
| `AMOUNT_MISMATCH` | Payment amount wrong | Verify correct fiat amount |
| `PAYEE_MISMATCH` | Wrong recipient | Verify payment went to LP's address |

## Timing Constraints

| Constraint | Value | Description |
|-----------|-------|-------------|
| Intent expiration | Up to 5 days (432000s) | Configurable per deposit |
| Timestamp buffer | Up to 48 hours (172800000ms) | Max age of payment proof |
| Gating signature | Variable | Must be valid at block.timestamp |

## Failure Recovery

| Failure | Recovery |
|---------|----------|
| Intent expires before proof | Signal new intent + send new fiat |
| Proof generation fails | Retry with fresh credentials |
| Attestation service rejects | Check format, re-generate |
| On-chain fulfillment reverts | Check intent state, verify data |
| Agent goes offline after payment | Resume — intent valid until expiration |
