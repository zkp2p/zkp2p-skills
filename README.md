# Peer Agent Skills

Agent Skills for AI agents to interact with the [Peer (ZKP2P)](https://peer.xyz) protocol — permissionless fiat-to-crypto exchange on Base.

These skills follow the [AgentSkills](https://agentskills.io) open standard and work with Claude Code, OpenClaw, Cursor, Gemini CLI, and any AgentSkills-compatible runtime.

## Why Peer for Agents

Peer is the only payment protocol where agents can transact without KYC. No identity verification. No bank account. Just a wallet on Base.

| What you want to do | Skill | Status |
|---------------------|-------|:------:|
| Pay a human in fiat (freelancer, worker, vendor) | [`pay-humans-fiat`](#pay-humans-fiat) | Ready |
| Accept fiat payments, receive USDC | [`accept-fiat-payments`](#accept-fiat-payments) | Ready |
| Buy USDC with fiat (no KYC exchange) | [`fiat-to-crypto`](#fiat-to-crypto) | Ready |
| Earn yield on idle USDC | [`earn-on-idle-usdc`](#earn-on-idle-usdc) | Ready |
| Earn fees as a DeFi rate manager | [`earn-as-defi-manager`](#earn-as-defi-manager) | Ready (staging) |
| Check exchange rates and spreads | [`check-fx-rates`](#check-fx-rates) | Ready |
| Send USDC to another agent | [`send-usdc`](#send-usdc) | Ready |
| Analyze protocol health and performance | [`analyze-peer-protocol`](#analyze-peer-protocol) | Ready |
| Look up deposits, intents, addresses | [`look-up-peer-data`](#look-up-peer-data) | Ready |
| Monitor real-time protocol events | [`monitor-peer-activity`](#monitor-peer-activity) | Ready |
| Create or update a payment provider | [`create-zkp2p-provider`](#create-zkp2p-provider) | Ready |

> **New to Peer?** Start with the action-oriented skills above. They explain what you can do and why. Each one links to a deeper `peer-*` implementation skill with full SDK references and code.

## Quick Start

### Install a skill (Claude Code)

Copy any skill directory into your project:

```bash
cp -r skills/pay-humans-fiat .claude/skills/pay-humans-fiat
```

Or into your personal skills directory for all projects:

```bash
cp -r skills/pay-humans-fiat ~/.claude/skills/pay-humans-fiat
```

Install the companion implementation skill too:

```bash
cp -r skills/peer-offramp .claude/skills/peer-offramp
```

### Install a skill (OpenClaw / ClawHub)

```bash
# Coming soon — once published to ClawHub
npx clawhub@latest install pay-humans-fiat
```

### Use a skill

Once installed, skills are automatically triggered when your request matches the skill description. You can also invoke them directly:

```
/pay-humans-fiat
/accept-fiat-payments
/fiat-to-crypto
/earn-on-idle-usdc
/create-zkp2p-provider
```

## Skill Catalog

This repo has three layers of skills:

- **Action skills** — Short, action-oriented skills for discovery. They explain *what* you can do, *why* Peer beats alternatives, and link to the implementation skill.
- **Implementation skills** (`peer-*`) — Full SDK references, code examples, contract ABIs, and GraphQL queries.
- **Authoring skills** — Workflows for extending Peer integrations safely.

### Action Skills (Start Here)

#### pay-humans-fiat

Pay a human in their local fiat currency from your USDC balance. Cheaper and faster than Stripe or PayPal. No KYC.

| Method | Fee | Settlement | KYC | Agent-Native |
|--------|-----|-----------|:---:|:---:|
| Stripe Connect | 2.9% + $0.30 | 2-3 days | Yes | No |
| **Peer Protocol** | **~1% spread** | **Minutes** | **No** | **Yes** |

**Implementation:** `peer-offramp`

---

#### accept-fiat-payments

Accept fiat payments from humans and receive USDC. Generate checkout links, share via any channel, get webhook notifications.

**Implementation:** `peer-checkout`

---

#### fiat-to-crypto

Convert fiat to USDC on Base. No KYC, no exchange account. Wise = 100% autonomous, Venmo = 80%.

**Implementation:** `peer-onramp`

---

#### earn-on-idle-usdc

Earn 1-5% per transaction on idle USDC by providing liquidity. Deposit USDC, set your spread, earn every time a buyer exchanges.

**Implementation:** `peer-lp`

---

#### earn-as-defi-manager

Earn fees by managing exchange rates across pooled LP deposits. Zero capital required — earn by strategy alone, up to 5% fee on every fill.

**Implementation:** `peer-vault` + `peer-rate-optimizer`

---

#### check-fx-rates

Query live fiat-to-USDC rates, spreads, and liquidity across Venmo/Wise/Revolut/PayPal. Find the cheapest way to move between fiat and crypto.

**Implementation:** `peer-market`

---

#### send-usdc

Send USDC to another agent or wallet on Base. Direct ERC-20 transfer, settles in seconds, < $0.01 gas.

**Implementation:** `peer-transfer`

---

#### analyze-peer-protocol

Analyze Peer protocol health and performance — volume trends, liquidity depth, spreads, maker/taker leaderboards, and market data. Understand what is happening across the protocol before deploying capital or adjusting strategy.

**Implementation:** `peer-analytics`

---

#### look-up-peer-data

Search and look up specific deposits, intents, addresses, maker portfolios, and verifier stats. Use when you need to inspect a specific entity rather than aggregate analytics.

**Implementation:** `peer-explorer`

---

#### monitor-peer-activity

Watch real-time protocol events — intents signaled, fulfilled, pruned, deposits created. Supports both polling and SSE streaming for continuous monitoring.

**Implementation:** `peer-activity`

---

### Authoring Skills

#### create-zkp2p-provider

Create and test a Peer provider capture template for buyer TEE, identity, or
payment flows. Covers authenticated browser capture, metadata and public
parameter selectors, provider manifests, attestation-transformer boundaries,
and end-to-end testing through PeerAuth and the developer portal.

---

### Implementation Skills (Full Reference)

#### peer-lp — LP Deposit Management

Manage USDC liquidity deposits on Peer. Create deposits, add/remove funds, set conversion rates, monitor intents, and earn fees from fiat-to-crypto exchanges.

**Key operations:** `createDeposit()`, `addFunds()` / `removeFunds()`, `setCurrencyMinRate()`, `getIntents()`, `pruneExpiredIntents()`

**SDK:** `@zkp2p/sdk`

---

#### peer-vault — Vault (DRM) Operator

Create and manage Peer vaults (Delegated Rate Management). Set rates across pooled LP deposits, earn fees on fulfilled intents.

**Key operations:** `createRateManager()`, `setMinRate()` / `setMinRatesBatch()`, `setFee()`, `setDepositRateManager()`

**Contracts:** `DepositRateManagerRegistryV1`, `DepositRateManagerController`

---

#### peer-checkout — Pay Checkout

Generate Peer Pay checkout links for receiving fiat payments as USDC. Webhook handling for 8 event types (HMAC-SHA256 signed).

**API:** REST (`https://api.pay.zkp2p.xyz`)

---

#### peer-market — Market Intelligence

Query Peer market data — spreads, volume, liquidity depth, LP rankings, and orderbook data via Peerlytics API and protocol indexer.

---

#### peer-analytics — Protocol Analytics

Analyze Peer protocol health — volume, liquidity, spreads, leaderboards, attribution, and market data via the Peerlytics SDK. Covers protocol-level metrics and period comparisons.

**SDK:** `@peerlytics/sdk`

---

#### peer-explorer — Entity Lookup

Search and inspect deposits, intents, addresses, maker portfolios, and verifier stats via Peerlytics explorer API.

**SDK:** `@peerlytics/sdk`

---

#### peer-activity — Real-Time Activity Monitor

Watch protocol events in real time via polling or SSE stream. Event types: `intent_signaled`, `intent_fulfilled`, `intent_pruned`, `deposit_created`, and more.

**SDK:** `@peerlytics/sdk`

---

#### peer-rate-optimizer — Rate Optimization

Closed-loop rate optimization for vaults and LPs. Analyzes spreads, volume, PnL to recommend rate adjustments. Includes Python script (`scripts/optimize.py`).

---

#### peer-onramp — Fiat to USDC On-Ramp

Agent autonomous on-ramp via headless Reclaim proof generation. Wise = 100% autonomous, Venmo = 80%, CashApp/Zelle = human-in-the-loop.

**Dependencies:** `@reclaimprotocol/attestor-core` ^4.0.3, `@zkp2p/providers`

---

#### peer-offramp — USDC to Fiat Off-Ramp

Pay humans in fiat. Agent signals intent → LP sends fiat → LP proves payment → USDC settles.

---

#### peer-transfer — Agent-to-Agent USDC Transfer

Direct USDC transfer on Base. No escrow, no proof — pure on-chain ERC-20 transfer via viem.

## Repository Structure

```
zkp2p-skills/
├── README.md
├── LICENSE
├── skills/
│   ├── pay-humans-fiat/           # Action skills (discovery layer)
│   │   └── SKILL.md
│   ├── accept-fiat-payments/
│   │   └── SKILL.md
│   ├── fiat-to-crypto/
│   │   └── SKILL.md
│   ├── earn-on-idle-usdc/
│   │   └── SKILL.md
│   ├── earn-as-defi-manager/
│   │   └── SKILL.md
│   ├── check-fx-rates/
│   │   └── SKILL.md
│   ├── send-usdc/
│   │   └── SKILL.md
│   ├── analyze-peer-protocol/
│   │   └── SKILL.md
│   ├── look-up-peer-data/
│   │   └── SKILL.md
│   ├── monitor-peer-activity/
│   │   └── SKILL.md
│   │
│   ├── create-zkp2p-provider/      # Provider authoring and TEE capture
│   │   ├── SKILL.md
│   │   └── references/
│   │
│   ├── peer-lp/                   # Implementation skills (full reference)
│   │   ├── SKILL.md
│   │   └── references/sdk-api.md
│   ├── peer-vault/
│   │   ├── SKILL.md
│   │   └── references/vault-contracts.md
│   ├── peer-checkout/
│   │   ├── SKILL.md
│   │   └── references/pay-api.md
│   ├── peer-market/
│   │   ├── SKILL.md
│   │   └── references/data-sources.md
│   ├── peer-analytics/
│   │   ├── SKILL.md
│   │   └── references/analytics-api.md
│   ├── peer-explorer/
│   │   ├── SKILL.md
│   │   └── references/explorer-api.md
│   ├── peer-activity/
│   │   └── SKILL.md
│   ├── peer-rate-optimizer/
│   │   ├── SKILL.md
│   │   └── scripts/optimize.py
│   ├── peer-onramp/
│   │   ├── SKILL.md
│   │   └── references/proof-flow.md
│   ├── peer-offramp/
│   │   └── SKILL.md
│   └── peer-transfer/
│       └── SKILL.md
└── shared/
    └── references/
        ├── contracts.md
        ├── constants.md
        └── providers.md
```

## Protocol Overview

Peer (ZKP2P) is a permissionless fiat-to-crypto exchange protocol on Base. It uses an escrow + intent system:

1. **LPs** deposit USDC into the escrow contract with configured rates and accepted payment methods
2. **Buyers** signal an intent (locking LP's USDC) and send fiat off-chain
3. **Proof generation** (via Reclaim Protocol / zkTLS) cryptographically proves the fiat payment occurred
4. **Settlement** — on-chain verification releases escrowed USDC to the buyer

No KYC. No custodial accounts. No identity verification. This is why it works for agents.

### Key Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| Escrow | `0x2f121CDDCA6d652f35e8B3E560f9760898888888` |
| Orchestrator | `0x88888883Ed048FF0a415271B28b2F52d431810D0` |
| UnifiedPaymentVerifier | `0x16b3e4a3CA36D3A4bCA281767f15C7ADeF4ab163` |
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### Key SDKs

| Package | Purpose |
|---------|---------|
| `@zkp2p/sdk` | LP management, intents, quotes, taker tiers |
| `@zkp2p/providers` | Payment platform templates (18 platforms) |
| `@reclaimprotocol/attestor-core` | Headless proof generation |
| `@peerlytics/sdk` | Protocol analytics, explorer, market data (Peerlytics class) |

### Supported Payment Platforms

Venmo, Wise, Revolut, CashApp, PayPal, Mercado Pago, Monzo, Zelle (Chase, BofA, Citi, US Bank), Chime, Mercury, N26, IDFC, Luxon, Alipay, Royal Bank Canada

### Supported Currencies

USD, EUR, GBP, SGD, AUD, CAD, CHF, JPY, ARS, MXN, BRL, INR, KRW, CNY, and more (35+ total)

## Environment Variables

Skills may require some or all of these:

| Variable | Required By | Purpose |
|----------|-------------|---------|
| `PRIVATE_KEY` | All write operations | Wallet private key (Base) |
| `ZKP2P_API_KEY` | LP operations, quotes | ZKP2P gating service API key |
| `WISE_API_TOKEN` | On-ramp (Wise) | Wise personal API token |
| `VENMO_COOKIES` | On-ramp (Venmo) | Venmo session cookies |
| `PEERLYTICS_API_KEY` | Market intelligence | Peerlytics API key (or use x402) |
| `PAY_API_KEY` | Checkout | Peer Pay merchant API key |

## Publishing to ClawHub

```bash
# Install ClawHub CLI
npm install -g clawhub

# Authenticate
clawhub login

# Publish action skills (discovery layer)
clawhub publish skills/pay-humans-fiat --slug pay-humans-fiat
clawhub publish skills/accept-fiat-payments --slug accept-fiat-payments
clawhub publish skills/fiat-to-crypto --slug fiat-to-crypto
clawhub publish skills/earn-on-idle-usdc --slug earn-on-idle-usdc
clawhub publish skills/earn-as-defi-manager --slug earn-as-defi-manager
clawhub publish skills/check-fx-rates --slug check-fx-rates
clawhub publish skills/send-usdc --slug send-usdc
clawhub publish skills/analyze-peer-protocol --slug analyze-peer-protocol
clawhub publish skills/look-up-peer-data --slug look-up-peer-data
clawhub publish skills/monitor-peer-activity --slug monitor-peer-activity

# Publish authoring skills
clawhub publish skills/create-zkp2p-provider --slug create-zkp2p-provider

# Publish implementation skills (full reference)
clawhub publish skills/peer-lp --slug peer-lp
clawhub publish skills/peer-vault --slug peer-vault
clawhub publish skills/peer-checkout --slug peer-checkout
clawhub publish skills/peer-market --slug peer-market
clawhub publish skills/peer-analytics --slug peer-analytics
clawhub publish skills/peer-explorer --slug peer-explorer
clawhub publish skills/peer-activity --slug peer-activity
clawhub publish skills/peer-rate-optimizer --slug peer-rate-optimizer
clawhub publish skills/peer-onramp --slug peer-onramp
clawhub publish skills/peer-offramp --slug peer-offramp
clawhub publish skills/peer-transfer --slug peer-transfer
```

## Contributing

1. Fork this repository
2. Create a feature branch
3. Write or modify a skill in `skills/`
4. Test with Claude Code: `cp -r skills/your-skill .claude/skills/`
5. Open a pull request

## License

MIT
