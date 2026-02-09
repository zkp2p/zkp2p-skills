# ZKP2P Skills — Implementation Plan

## Goal

Build a comprehensive set of AgentSkills (SKILL.md format) that enable AI agents (via Claude Code, OpenClaw, or any AgentSkills-compatible runtime) to interact with every part of the ZKP2P protocol. Publish to GitHub (zkp2p org) and ClawHub.

## Skill Inventory

| # | Skill Name | Purpose | Strategy Doc Reference |
|---|-----------|---------|----------------------|
| 1 | `zkp2p-lp` | LP deposit management — create, fund, withdraw, rate-set, intent monitor | V1 Story 1 |
| 2 | `zkp2p-vault` | Vault (DRM) creation & rate management | V2 Story: Agent-as-Vault-Operator |
| 3 | `zkp2p-checkout` | Pay checkout — generate payment links, handle webhooks | V1 Story 2 |
| 4 | `zkp2p-market` | Market intelligence — Peerlytics + indexer queries | V2 Peerlytics Integration |
| 5 | `zkp2p-rate-optimizer` | LLM-powered rate optimization using market + PnL data | V2 Rate Optimization Algorithm |
| 6 | `zkp2p-onramp` | Agent autonomous on-ramp (fiat → USDC) | V1 Story 4 |
| 7 | `zkp2p-offramp` | Agent pays human (USDC → fiat) | V1 Story 3 |
| 8 | `zkp2p-transfer` | Agent-to-agent USDC settlement | V1 Story 5 |

## Repository Structure

```
zkp2p-skills/
├── README.md                          # Thorough overview + quick start
├── PLAN.md                            # This file
├── LICENSE                            # MIT
│
├── skills/
│   ├── zkp2p-lp/
│   │   ├── SKILL.md                   # LP management instructions
│   │   └── references/
│   │       └── sdk-api.md             # Offramp SDK method reference
│   │
│   ├── zkp2p-vault/
│   │   ├── SKILL.md                   # Vault operator instructions
│   │   └── references/
│   │       └── vault-contracts.md     # Contract ABIs + indexer queries
│   │
│   ├── zkp2p-checkout/
│   │   ├── SKILL.md                   # Pay checkout instructions
│   │   └── references/
│   │       └── pay-api.md             # Pay SDK + webhook spec
│   │
│   ├── zkp2p-market/
│   │   ├── SKILL.md                   # Market intelligence instructions
│   │   └── references/
│   │       └── data-sources.md        # Peerlytics + indexer schemas
│   │
│   ├── zkp2p-rate-optimizer/
│   │   ├── SKILL.md                   # Rate optimization instructions
│   │   └── scripts/
│   │       └── optimize.py            # Rate optimization algorithm
│   │
│   ├── zkp2p-onramp/
│   │   ├── SKILL.md                   # On-ramp instructions
│   │   └── references/
│   │       └── proof-flow.md          # Headless proof generation guide
│   │
│   ├── zkp2p-offramp/
│   │   └── SKILL.md                   # Off-ramp instructions
│   │
│   └── zkp2p-transfer/
│       └── SKILL.md                   # A2A transfer instructions
│
└── shared/
    └── references/
        ├── contracts.md               # All contract addresses + key ABIs
        ├── constants.md               # Protocol constants, precision values
        └── providers.md               # Payment platform catalog
```

## Implementation Order

1. **shared/references/** — Common reference material used by multiple skills
2. **zkp2p-lp** — Most important, fully buildable today
3. **zkp2p-checkout** — Second most important, fully buildable today
4. **zkp2p-vault** — Buildable on staging today
5. **zkp2p-market** — Data layer, supports rate-optimizer
6. **zkp2p-rate-optimizer** — LLM-powered, depends on market + vault
7. **zkp2p-transfer** — Simple USDC transfer
8. **zkp2p-onramp** — Future (needs headless prover)
9. **zkp2p-offramp** — Future (needs agent checkout API)
10. **README.md** — After all skills are written
11. **Push to GitHub** — Private repo on zkp2p org

## Skill Design Principles

1. **Under 500 lines** per SKILL.md body (per AgentSkills best practices)
2. **Progressive disclosure** — Core instructions in SKILL.md, details in references/
3. **Concrete code examples** — Every operation gets a working TypeScript snippet
4. **Contract addresses inline** — Agents need them immediately, no lookups
5. **Error handling** — Common failure modes documented
6. **Security guardrails** — Private key handling, amount validation, slippage checks
