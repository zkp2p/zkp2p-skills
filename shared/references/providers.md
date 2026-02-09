# ZKP2P Payment Providers

## Provider Package

```bash
npm install @zkp2p/providers
```

The `@zkp2p/providers` package contains JSON templates for all supported payment platforms. Each template defines how to extract and verify payment proof data from a specific platform's API.

## Loading Providers

```typescript
// Load a specific provider template
import venmo from '@zkp2p/providers/venmo/transfer_venmo.json' assert { type: 'json' };
import wise from '@zkp2p/providers/wise/transfer_wise.json' assert { type: 'json' };
import revolut from '@zkp2p/providers/revolut/transfer_revolut.json' assert { type: 'json' };

// Load the full manifest of all providers
import manifest from '@zkp2p/providers/providers.json' assert { type: 'json' };
```

## Provider Template Schema

Each provider JSON file follows this structure:

```typescript
interface ProviderTemplate {
  // Unique identifier for this provider action
  actionType: string;              // e.g., "transfer_venmo"

  // Proof generation engine
  proofEngine: string;             // e.g., "reclaim"

  // API endpoint with template placeholders
  url: string;                     // e.g., "https://api.venmo.com/v1/stories/{{TRANSACTION_ID}}"

  // HTTP method for the API call
  method: string;                  // "GET" or "POST"

  // Metadata about the platform
  metadata: {
    platform: string;              // e.g., "venmo"
    displayName: string;           // e.g., "Venmo"
    logoUrl: string;               // Platform logo
  };

  // Rules for extracting data from API responses
  paramSelectors: ParamSelector[];

  // Validation patterns for response matching
  responseMatches: ResponseMatch[];

  // Headers to exclude from the proof (auth tokens, etc.)
  secretHeaders: string[];
}

interface ParamSelector {
  // Name of the extracted parameter
  name: string;                    // e.g., "amount", "recipientId"

  // JSONPath or regex for extraction
  selector: string;                // e.g., "$.data.amount"

  // Type of selector
  type: "jsonpath" | "regex";
}

interface ResponseMatch {
  // Field to validate
  field: string;

  // Expected value or pattern
  value: string;

  // Match type
  type: "exact" | "regex" | "contains";
}
```

## Platform Catalog (18 Platforms)

### USD Platforms

| Platform | Action Type | Template Path |
|----------|-------------|---------------|
| Venmo | `transfer_venmo` | `venmo/transfer_venmo.json` |
| Cash App | `transfer_cashapp` | `cashapp/transfer_cashapp.json` |
| Zelle | `transfer_zelle` | `zelle/transfer_zelle.json` |
| Chase | `transfer_chase` | `chase/transfer_chase.json` |
| Bank of America | `transfer_bankofamerica` | `bankofamerica/transfer_bankofamerica.json` |
| Citi | `transfer_citi` | `citi/transfer_citi.json` |
| Chime | `transfer_chime` | `chime/transfer_chime.json` |
| US Bank | `transfer_usbank` | `usbank/transfer_usbank.json` |
| Mercury | `transfer_mercury` | `mercury/transfer_mercury.json` |

### Multi-Currency Platforms

| Platform | Action Type | Currencies |
|----------|-------------|------------|
| Wise | `transfer_wise` | USD, EUR, GBP, SGD, AUD, CAD, CHF, JPY, and more |
| Revolut | `transfer_revolut` | USD, EUR, GBP, CHF, and more |
| PayPal | `transfer_paypal` | USD, EUR, GBP |
| Mercado Pago | `transfer_mercadopago` | ARS, MXN, BRL |

### Regional Platforms

| Platform | Action Type | Currency | Region |
|----------|-------------|----------|--------|
| Monzo | `transfer_monzo` | GBP | UK |
| N26 | `transfer_n26` | EUR | Europe |
| IDFC First Bank | `transfer_idfc` | INR | India |
| Luxon Pay | `transfer_luxon` | KRW | South Korea |
| Alipay | `transfer_alipay` | CNY | China |
| Royal Bank of Canada | `transfer_royalbankcanada` | CAD | Canada |

## Using Provider Templates with SDK

### Via Offramp SDK (LP Operations)

```typescript
import { getPaymentMethodsCatalog } from '@zkp2p/offramp-sdk';

// Get all available payment methods for Base mainnet production
const catalog = getPaymentMethodsCatalog(8453, 'production');

// Access a specific platform's details
const wiseMethods = catalog.wise;
// wiseMethods.paymentMethodHash   — bytes32 hash for on-chain use
// wiseMethods.currencies          — supported currency list
// wiseMethods.displayName         — human-readable name
```

### Via Pay SDK (Checkout Operations)

```typescript
import { ZKP2PPay } from '@zkp2p-pay/sdk';

const pay = new ZKP2PPay({
  apiKey: 'your-api-key',
  environment: 'production',
});

// List supported payment methods for a checkout
const methods = await pay.getPaymentMethods();
```

### Direct Provider Template Usage

```typescript
import venmoTemplate from '@zkp2p/providers/venmo/transfer_venmo.json' assert { type: 'json' };

// Access template fields
console.log(venmoTemplate.actionType);      // "transfer_venmo"
console.log(venmoTemplate.proofEngine);     // "reclaim"
console.log(venmoTemplate.url);            // API URL with {{placeholders}}
console.log(venmoTemplate.method);          // "GET"

// Extract parameter selectors
for (const param of venmoTemplate.paramSelectors) {
  console.log(`${param.name}: ${param.selector} (${param.type})`);
}
```

## Provider Template Placeholders

Provider URLs contain `{{PARAM}}` placeholders that must be filled with actual values before making API calls:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{TRANSACTION_ID}}` | Platform-specific transaction ID | `"3847291058372"` |
| `{{USER_ID}}` | User's platform account ID | `"user_abc123"` |
| `{{PROFILE_ID}}` | Profile or account identifier | `"12345678"` |

## Proof Flow with Providers

1. **Select provider** -- Choose the template matching the buyer's payment platform
2. **Fill placeholders** -- Replace `{{PARAM}}` values with actual transaction data
3. **Generate proof** -- Use the proof engine (e.g., Reclaim, TLSNotary) to create a verifiable proof of the API response
4. **Extract parameters** -- Apply `paramSelectors` to extract amount, recipient, timestamp
5. **Validate response** -- Check `responseMatches` to verify the payment was successful
6. **Submit on-chain** -- Pass the proof to `fulfillIntent()` on the Orchestrator contract

## Adding New Providers

New provider templates follow the same JSON schema. The key requirements are:
- The platform must have an API endpoint that returns transaction details
- The response must contain verifiable amount, recipient, and timestamp fields
- The proof engine must be able to attest to the API response authenticity
- The template must define correct `paramSelectors` for data extraction
- The template must define `responseMatches` for payment status validation
