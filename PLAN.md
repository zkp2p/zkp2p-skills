# Peer Agent Skills — Implementation Plan

## Goal

Build a comprehensive set of AgentSkills (SKILL.md format) that enable AI agents (via Claude Code, OpenClaw, or any AgentSkills-compatible runtime) to interact with every part of the Peer (ZKP2P) protocol. Publish to GitHub (zkp2p org) and ClawHub.

## Skill Inventory

### Action Skills (Discovery Layer)

| # | Skill Name | Purpose | Implementation Skill |
|---|-----------|---------|---------------------|
| 1 | `pay-humans-fiat` | Pay a human in fiat from USDC balance | `peer-offramp` |
| 2 | `accept-fiat-payments` | Accept fiat payments, receive USDC | `peer-checkout` |
| 3 | `fiat-to-crypto` | Buy USDC with fiat (no KYC) | `peer-onramp` |
| 4 | `earn-on-idle-usdc` | Earn yield providing USDC liquidity | `peer-lp` |
| 5 | `earn-as-defi-manager` | Earn fees as a vault rate manager | `peer-vault` + `peer-rate-optimizer` |
| 6 | `check-fx-rates` | Query live rates, spreads, liquidity | `peer-market` |
| 7 | `send-usdc` | Send USDC to another agent/wallet | `peer-transfer` |
| 8 | `analyze-peer-protocol` | Protocol health, volume, leaderboards | `peer-analytics` |
| 9 | `look-up-peer-data` | Search deposits, intents, addresses | `peer-explorer` |
| 10 | `monitor-peer-activity` | Watch real-time protocol events | `peer-activity` |

### Implementation Skills (Full Reference)

| # | Skill Name | Purpose | Key Dependencies |
|---|-----------|---------|-----------------|
| 1 | `peer-lp` | LP deposit management | `@zkp2p/sdk` |
| 2 | `peer-vault` | Vault (DRM) operator | Direct contract interaction |
| 3 | `peer-checkout` | Pay checkout links + webhooks | REST API (`api.pay.zkp2p.xyz`) |
| 4 | `peer-market` | Market intelligence (rates, orderbook) | `@peerlytics/sdk`, indexer GraphQL |
| 5 | `peer-analytics` | Protocol analytics (volume, leaderboards) | `@peerlytics/sdk` |
| 6 | `peer-explorer` | Entity lookup (deposits, intents, addresses) | `@peerlytics/sdk` |
| 7 | `peer-activity` | Real-time event monitoring (polling + SSE) | `@peerlytics/sdk` |
| 8 | `peer-rate-optimizer` | LLM-powered rate optimization | `@peerlytics/sdk`, Python |
| 9 | `peer-onramp` | Fiat → USDC on-ramp | `@zkp2p/sdk`, `@reclaimprotocol/attestor-core` |
| 10 | `peer-offramp` | USDC → fiat off-ramp | `@zkp2p/sdk` |
| 11 | `peer-transfer` | Agent-to-agent USDC transfer | `viem` |

## Repository Structure

```
zkp2p-skills/
├── README.md
├── PLAN.md
├── LICENSE
│
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
│
└── shared/
    └── references/
        ├── contracts.md           # Contract addresses (production + staging)
        ├── constants.md           # Protocol constants, taker tiers, precision
        └── providers.md           # Payment platform catalog
```

## Key SDKs

| Package | Version | Purpose |
|---------|---------|---------|
| `@zkp2p/sdk` | 0.0.11 | LP management, intents, quotes, taker tiers (`OfframpClient`) |
| `@peerlytics/sdk` | 0.0.2 | Protocol analytics, explorer, market data (`Peerlytics` class) |
| `@zkp2p/providers` | - | Payment platform templates (18 platforms) |
| `@reclaimprotocol/attestor-core` | ^4.0.3 | Headless proof generation |

## Environments

| | Production | Staging |
|--|-----------|---------|
| Chain | Base (8453) | Base Sepolia (84532) |
| Escrow | `0x2f121CDDCA6d652f35e8B3E560f9760898888888` | `0x5C2a8B9246777eE4501B6C426a8B8C7635C7b5b5` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | (Sepolia USDC) |
| ZKP2P API | `https://api.zkp2p.xyz` | `https://api-staging.zkp2p.xyz` |
| Peerlytics | `https://peerlytics.xyz` | - |
| Indexer | `https://indexer.hyperindex.xyz/.../v1/graphql` | Staging slug differs |

## Skill Design Principles

1. **Under 500 lines** per SKILL.md body (per AgentSkills best practices)
2. **Progressive disclosure** — Core instructions in SKILL.md, details in references/
3. **Concrete code examples** — Every operation gets a working TypeScript snippet
4. **Contract addresses inline** — Agents need them immediately, no lookups
5. **Environment clarity** — Label production vs staging addresses explicitly
6. **Security guardrails** — Private key handling, amount validation, slippage checks
