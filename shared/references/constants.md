# ZKP2P Protocol Constants

## Precision and Limits

| Constant | Value | Usage |
|----------|-------|-------|
| PRECISE_UNIT | `1e18` (1000000000000000000) | Conversion rates, vault fees |
| USDC_DECIMALS | `6` | Token amounts (1 USDC = 1_000000) |
| MAX_PROTOCOL_FEE | `5e16` (5%) | Maximum vault manager fee |
| MAX_DUST_THRESHOLD | `1e6` (1 USDC) | Minimum for deposit cleanup |
| MAX_INTENT_EXPIRATION | `432000` (5 days in seconds) | Intent validity window |
| MAX_TIMESTAMP_BUFFER | `172800000` (48h in milliseconds) | Payment proof age limit |

## Rate Encoding

Rates use 18-decimal fixed-point encoding (PRECISE_UNIT = 1e18).

| Scenario | Encoded Value | Meaning |
|----------|---------------|---------|
| 1:1 (no markup) | `1000000000000000000` | 1 USDC = 1 USD fiat |
| 2% markup | `1020000000000000000` | 1 USDC costs 1.02 USD fiat |
| 5% markup | `1050000000000000000` | 1 USDC costs 1.05 USD fiat |
| 10% discount | `900000000000000000` | 1 USDC costs 0.90 USD fiat |

### Rate Computation with Vaults

```
effectiveMinRate = max(depositorFloor, managerRate)
```

The depositor always retains a floor rate. The vault manager can only set rates higher (worse for buyer, better for LP).

### Fee Math

When a vault manager charges a fee:

```
effectiveConversionRate = grossRate * 1e18 / (1e18 - managerFee)
```

The fee is snapshotted at intent signal time, not at fulfillment time. This prevents fee manipulation between signal and fulfill.

### Amount Calculations

```
fiatAmount = usdcAmount * conversionRate / 1e18
usdcAmount = fiatAmount * 1e18 / conversionRate
```

Note: USDC amounts use 6 decimals. A 100 USDC intent = `100_000000` in raw units.

## Payment Method Hashes

Computed as `keccak256(abi.encodePacked(platformName))`:

| Platform | Hash Input | Usage |
|----------|-----------|-------|
| venmo | `"venmo"` | Venmo transfers |
| wise | `"wise"` | Wise (TransferWise) |
| revolut | `"revolut"` | Revolut transfers |
| cashapp | `"cashapp"` | Cash App |
| mercadopago | `"mercadopago"` | Mercado Pago |
| paypal | `"paypal"` | PayPal transfers |
| monzo | `"monzo"` | Monzo bank |
| zelle | `"zelle"` | Zelle transfers |
| chase | `"chase"` | Chase bank |
| bankofamerica | `"bankofamerica"` | Bank of America |
| citi | `"citi"` | Citibank |
| chime | `"chime"` | Chime |
| usbank | `"usbank"` | US Bank |
| mercury | `"mercury"` | Mercury bank |
| n26 | `"n26"` | N26 bank |
| idfc | `"idfc"` | IDFC First Bank |
| luxon | `"luxon"` | Luxon Pay |
| alipay | `"alipay"` | Alipay |
| royalbankcanada | `"royalbankcanada"` | Royal Bank of Canada |

To compute in code:

```typescript
import { ethers } from 'ethers';
const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('venmo'));
```

```solidity
bytes32 methodHash = keccak256(abi.encodePacked("venmo"));
```

## Currency Hashes

Computed as `keccak256(abi.encodePacked(currencyCode))`:

| Currency | Code | Region |
|----------|------|--------|
| US Dollar | `USD` | United States |
| Euro | `EUR` | Eurozone |
| British Pound | `GBP` | United Kingdom |
| Singapore Dollar | `SGD` | Singapore |
| Australian Dollar | `AUD` | Australia |
| Canadian Dollar | `CAD` | Canada |
| Swiss Franc | `CHF` | Switzerland |
| Japanese Yen | `JPY` | Japan |
| Argentine Peso | `ARS` | Argentina |
| Mexican Peso | `MXN` | Mexico |
| Brazilian Real | `BRL` | Brazil |
| Indian Rupee | `INR` | India |
| South Korean Won | `KRW` | South Korea |
| Chinese Yuan | `CNY` | China |

To compute in code:

```typescript
const currencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('USD'));
```

## Builder Attribution (ERC-8021)

| Field | Value |
|-------|-------|
| Builder Code | `bc_nbn6qkni` |
| Purpose | Attribute on-chain actions to the integration builder |
| Encoding | Appended to transaction calldata |

Builder attribution allows ZKP2P to track which integrations drive volume. Include the builder code when constructing transactions.

## Supported Payment Platforms (Full List)

The following 18 platforms are supported with provider templates:

| Platform | Slug | Primary Currencies |
|----------|------|--------------------|
| Alipay | `alipay` | CNY |
| Bank of America | `bankofamerica` | USD |
| Cash App | `cashapp` | USD |
| Chase | `chase` | USD |
| Chime | `chime` | USD |
| Citi | `citi` | USD |
| IDFC First Bank | `idfc` | INR |
| Luxon Pay | `luxon` | KRW |
| Mercado Pago | `mercadopago` | ARS, MXN, BRL |
| Mercury | `mercury` | USD |
| Monzo | `monzo` | GBP |
| N26 | `n26` | EUR |
| PayPal | `paypal` | USD, EUR, GBP |
| Revolut | `revolut` | USD, EUR, GBP, CHF, + more |
| Royal Bank of Canada | `royalbankcanada` | CAD |
| US Bank | `usbank` | USD |
| Venmo | `venmo` | USD |
| Wise | `wise` | USD, EUR, GBP, SGD, AUD, CAD, CHF, JPY, + more |

## Chain Constants

| Field | Value |
|-------|-------|
| Chain ID | `8453` (Base Mainnet) |
| RPC URL | `https://mainnet.base.org` |
| Block Explorer | `https://basescan.org` |
| USDC Address | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Native Token | ETH (for gas) |

## Environment Labels

| Environment | API Base | Use For |
|-------------|----------|---------|
| `production` | `https://api.zkp2p.xyz` | Live transactions |
| `staging` | `https://api-staging.zkp2p.xyz` | Testing and development |
