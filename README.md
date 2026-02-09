# ZKP2P Agent Skills

Agent Skills for AI agents to interact with the [ZKP2P (Peer)](https://peer.xyz) protocol — permissionless fiat-to-crypto exchange on Base.

These skills follow the [AgentSkills](https://agentskills.io) open standard and work with Claude Code, OpenClaw, Cursor, Gemini CLI, and any AgentSkills-compatible runtime.

## Why ZKP2P for Agents

ZKP2P is the only payment protocol where agents can transact without KYC. No identity verification. No bank account. Just a wallet on Base.

| Capability | Status | Skill |
|-----------|:------:|-------|
| Provide USDC liquidity, earn fees | Ready | `zkp2p-lp` |
| Accept fiat payments as USDC | Ready | `zkp2p-checkout` |
| Create & manage rate vaults | Ready (staging) | `zkp2p-vault` |
| Query market intelligence | Ready | `zkp2p-market` |
| Optimize vault rates with LLM | Ready | `zkp2p-rate-optimizer` |
| On-ramp fiat to USDC (Wise: fully autonomous) | Ready | `zkp2p-onramp` |
| Off-ramp USDC to fiat | Partial | `zkp2p-offramp` |
| Agent-to-agent USDC transfer | Ready | `zkp2p-transfer` |

## Quick Start

### Install a skill (Claude Code)

Copy any skill directory into your project:

```bash
cp -r skills/zkp2p-lp .claude/skills/zkp2p-lp
```

Or into your personal skills directory for all projects:

```bash
cp -r skills/zkp2p-lp ~/.claude/skills/zkp2p-lp
```

### Install a skill (OpenClaw / ClawHub)

```bash
# Coming soon — once published to ClawHub
npx clawhub@latest install zkp2p-lp
```

### Use a skill

Once installed, skills are automatically triggered when your request matches the skill description. You can also invoke them directly:

```
/zkp2p-lp
/zkp2p-vault
/zkp2p-checkout
```

## Skill Catalog

### zkp2p-lp — LP Deposit Management

Manage USDC liquidity deposits on ZKP2P. Create deposits, add/remove funds, set conversion rates, monitor intents, and earn fees from fiat-to-crypto exchanges.

**Key operations:**
- `createDeposit()` — deposit USDC with configurable rates and payment methods
- `addFunds()` / `removeFunds()` — rebalance liquidity
- `setCurrencyMinRate()` — adjust pricing per payment method and currency
- `getIntents()` — monitor incoming buyer intents
- `pruneExpiredIntents()` — clean up stale intents

**SDK:** `@zkp2p/offramp-sdk`

---

### zkp2p-vault — Vault (DRM) Operator

Create and manage ZKP2P vaults (Delegated Rate Management). Set rates across pooled LP deposits, earn fees on fulfilled intents.

**Key operations:**
- `createRateManager()` — create a new vault with fee structure
- `setMinRate()` / `setMinRatesBatch()` — set rates per payment method x currency pair
- `setFee()` — adjust vault fee (capped at 5%)
- `setDepositRateManager()` — delegate a deposit to a vault
- GraphQL queries for vault performance analytics

**Contracts:** `DepositRateManagerRegistryV1`, `DepositRateManagerController`

---

### zkp2p-checkout — Pay Checkout

Generate ZKP2P Pay checkout links for receiving fiat payments as USDC. Send payment links to users via any channel (Telegram, WhatsApp, Discord).

**Key operations:**
- `createCheckoutSession()` — generate a checkout URL
- Webhook handling for 8 event types (HMAC-SHA256 signed)
- Order status tracking

**SDK:** `@zkp2p-pay/sdk`

---

### zkp2p-market — Market Intelligence

Query ZKP2P market data — spreads, volume, liquidity depth, LP rankings, and orderbook data via Peerlytics API and protocol indexer.

**Data sources:**
- **Peerlytics API** — market analytics with x402 pay-per-request access
- **ZKP2P Indexer** — on-chain state via GraphQL
- **Quote API** — best available rates

---

### zkp2p-rate-optimizer — Rate Optimization

LLM-powered rate optimization for vault operators and LPs. Analyzes market spreads, volume trends, and PnL feedback to recommend rate adjustments.

**Algorithm:**
- Negative PnL → widen spread +20bps
- Low market share (<5%) → tighten spread -10bps
- Zero volume for 7 days → disable pair
- Safety: max 50bps change per iteration, 10bps minimum floor

**Includes:** Python script (`scripts/optimize.py`) for standalone analysis

---

### zkp2p-onramp — Fiat to USDC On-Ramp

Agent autonomous on-ramp: send fiat payment, generate headless Reclaim proof, receive USDC on Base. Uses `@reclaimprotocol/attestor-core` for proof generation — the same library the PeerAuth browser extension uses, running headlessly in Node.js.

**Platform readiness:**

| Platform | Agent Readiness | Notes |
|----------|:--------------:|-------|
| Wise | 100% | API token, no 2FA, long-lived |
| PayPal Business | 100% | OAuth, REST API |
| Venmo | 80% | Needs cookie export once |
| Revolut Business | 70% | Device trust setup |
| CashApp / Zelle | 20% | Human-in-the-loop |

**Dependencies:** `@reclaimprotocol/attestor-core` ^4.0.3, `@zkp2p/providers`

---

### zkp2p-offramp — USDC to Fiat Off-Ramp

Pay humans in their local fiat currency. Agent signals intent to sell USDC, LP sends fiat to recipient, LP proves payment, USDC transfers to LP.

**Current approach:** Agent finds LP deposit → signals intent with recipient's hashed payee details → LP handles fiat delivery and proof.

**Future:** `POST /v1/agent/checkout` API for simplified agent-initiated off-ramp.

---

### zkp2p-transfer — Agent-to-Agent USDC Transfer

Direct USDC transfer on Base for agent-to-agent payments. No escrow, no proof — pure on-chain ERC-20 transfer via viem.

## Repository Structure

```
zkp2p-skills/
├── README.md
├── LICENSE
├── skills/
│   ├── zkp2p-lp/
│   │   ├── SKILL.md
│   │   └── references/sdk-api.md
│   ├── zkp2p-vault/
│   │   ├── SKILL.md
│   │   └── references/vault-contracts.md
│   ├── zkp2p-checkout/
│   │   ├── SKILL.md
│   │   └── references/pay-api.md
│   ├── zkp2p-market/
│   │   ├── SKILL.md
│   │   └── references/data-sources.md
│   ├── zkp2p-rate-optimizer/
│   │   ├── SKILL.md
│   │   └── scripts/optimize.py
│   ├── zkp2p-onramp/
│   │   ├── SKILL.md
│   │   └── references/proof-flow.md
│   ├── zkp2p-offramp/
│   │   └── SKILL.md
│   └── zkp2p-transfer/
│       └── SKILL.md
└── shared/
    └── references/
        ├── contracts.md
        ├── constants.md
        └── providers.md
```

## Protocol Overview

ZKP2P is a permissionless fiat-to-crypto exchange protocol on Base. It uses an escrow + intent system:

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
| `@zkp2p/offramp-sdk` | LP management, intents, quotes |
| `@zkp2p-pay/sdk` | Pay checkout sessions |
| `@zkp2p/providers` | Payment platform templates (18 platforms) |
| `@reclaimprotocol/attestor-core` | Headless proof generation |
| `@peerlytics/sdk` | Market analytics |

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
| `PAY_API_KEY` | Checkout | ZKP2P Pay merchant API key |

## Publishing to ClawHub

```bash
# Install ClawHub CLI
npm install -g clawhub

# Authenticate
clawhub login

# Publish a skill
clawhub publish skills/zkp2p-lp --slug zkp2p-lp
clawhub publish skills/zkp2p-vault --slug zkp2p-vault
clawhub publish skills/zkp2p-checkout --slug zkp2p-checkout
clawhub publish skills/zkp2p-market --slug zkp2p-market
clawhub publish skills/zkp2p-rate-optimizer --slug zkp2p-rate-optimizer
clawhub publish skills/zkp2p-onramp --slug zkp2p-onramp
clawhub publish skills/zkp2p-offramp --slug zkp2p-offramp
clawhub publish skills/zkp2p-transfer --slug zkp2p-transfer
```

## Contributing

1. Fork this repository
2. Create a feature branch
3. Write or modify a skill in `skills/`
4. Test with Claude Code: `cp -r skills/your-skill .claude/skills/`
5. Open a pull request

## License

MIT
