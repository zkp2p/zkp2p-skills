# Peer skills

Nine agent skills for using and building on [Peer](https://peer.xyz): move between fiat and crypto, accept customer payments, provide liquidity, manage pricing, investigate orders, and measure activity.

Each skill is a complete use case with its own instructions and supporting files. Install only the workflows you need. Examples use published SDKs and the host's existing wallet or credentials; importing an example does not send a transaction.

## Install

With Node.js 22.20+ and the [Skills CLI](https://skills.sh/docs):

```sh
npx skills add zkp2p/zkp2p-skills --list
npx skills add zkp2p/zkp2p-skills --skill pay-humans-fiat
```

Choose your agent and project/global scope in the installer. List first instead of installing every skill. To check existing installations:

```sh
npx skills check
npx skills update
```

## Choose a workflow

| Skill | Use it when | Result |
| --- | --- | --- |
| [pay-humans-fiat](skills/pay-humans-fiat/SKILL.md) | Cash out crypto to a bank or payment app | A resumable cash-out with verified delivery and recovery steps |
| [fiat-to-crypto](skills/fiat-to-crypto/SKILL.md) | Buy crypto or integrate the buyer journey | Quote, confirmed intent, Buyer TEE proof, settlement evidence |
| [accept-fiat-payments](skills/accept-fiat-payments/SKILL.md) | Collect customer payments | Merchant checkout and authenticated, idempotent fulfillment |
| [check-fx-rates](skills/check-fx-rates/SKILL.md) | Compare what a wallet can actually execute | Comparable live quotes with fees, expiry, and eligibility |
| [provide-peer-liquidity](skills/provide-peer-liquidity/SKILL.md) | Sell USDC as a maker | Verified payees, deposit terms, inventory, and safe unwind |
| [manage-peer-vault](skills/manage-peer-vault/SKILL.md) | Operate or delegate a pricing vault | Correct rate/fee changes and verified delegation |
| [look-up-peer-data](skills/look-up-peer-data/SKILL.md) | Explain a stuck or completed order | A bounded trace across indexed records and chain receipts |
| [analyze-peer-protocol](skills/analyze-peer-protocol/SKILL.md) | Measure volume, participants, or activity | A report with explicit periods, attribution, and coverage |
| [create-zkp2p-provider](skills/create-zkp2p-provider/SKILL.md) | Add a payment or identity capture flow | A provider template and a tested attestation path |

No generic token-transfer skill, duplicate API-reference skills, or unattended rate optimizer is bundled. A Peer pricing vault is not an ERC-4626 yield vault. A fiat payout, payment proof, and token settlement are distinct states.

## Runtime and version baseline

Reviewed September 9, 2026 against the current contracts, curator/indexer behavior, Peer Cash, merchant SDK, and public documentation. Exact packages used to typecheck the examples:

| Package | Version |
| --- | --- |
| `@zkp2p/cash` | 0.5.2 |
| `@zkp2p/sdk` | 0.14.0 |
| `@zkp2p/pay-sdk` | 4.0.1 |
| `@peerlytics/sdk` | 4.0.0 |
| `@zkp2p/indexer-schema` | 0.22.0 |
| `@zkp2p/contracts-v2` | 0.4.1 |
| `@zkp2p/providers` (provider reference baseline) | 7.9.2 |

The SDK currently depends on contracts `0.4.1-rc.9`; a newer package tag is not proof of a deployed contract change. Resolve the environment and live deployment before acting. Public site hosts have moved to `peer.xyz`; some supported service origins still use `zkp2p.xyz`. Keep the SDK/environment defaults instead of performing a global domain substitution.

For consuming projects, install the dependencies named by the selected skill with that project's package manager. Skills are instructions, not managed wallet services. Use existing task authorization and secret storage; do not ask the user to paste private keys into a conversation. Examples prepare or perform the documented work only when called explicitly by the host. Preparation can still register a payee or request an attestation, as noted in the relevant skill.

## Upgrade from the old catalog

The old 22-entry catalog has been replaced. Update the workflows you use, then inspect your agent's installed skills: updating the repository may not remove locally installed retired names. Remove retired entries with `npx skills remove <old-name>` in the same project/global scope, and install the replacement. Review the CLI's selection before removal.

| Retired name(s) | Replacement |
| --- | --- |
| `peer-offramp`, `peer-transfer` | `pay-humans-fiat` |
| `peer-onramp` | `fiat-to-crypto` |
| `peer-checkout` | `accept-fiat-payments` |
| `peer-lp`, `earn-on-idle-usdc` | `provide-peer-liquidity` |
| `peer-vault`, `earn-as-defi-manager`, `peer-rate-optimizer` | `manage-peer-vault` |
| `peer-market` | `check-fx-rates` |
| `peer-explorer` | `look-up-peer-data` |
| `peer-analytics`, `peer-activity`, `monitor-peer-activity` | `analyze-peer-protocol` |
| `send-usdc` | Use your wallet's ordinary transfer tooling |

## Validation and maintenance

```sh
bun install --frozen-lockfile
bun run check
bun run check:links
bun run check:upstream
```

`check` validates Agent Skills metadata, body budgets, self-contained local links/imports, and catalog completeness; typechecks every TypeScript example against the lockfile; and tests amount precision, payment selection/proof indexing, rate behavior, and merchant request construction. Tests use synthetic data and do not broadcast, log in to payment accounts, or create live orders.

The scheduled source check reports changed npm versions and broken linked documentation. It does not automatically rewrite financial workflows. `tests/scenarios.md` contains realistic agent evaluation tasks and the review rubric. After changing behavior, rerun those tasks with an independent agent and inspect its actual decisions; keyword matches are not a behavioral evaluation.

To release: finish the checks and review, merge into the default branch, and verify an isolated Skills CLI installation from GitHub. There is no separate npm package to publish for these skills. [skills.sh](https://skills.sh/docs/faq) discovers installation activity; its cached directory/leaderboard can lag a repository update. Official Creator status is a separate directory process.

Authoring follows [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices) and the [format specification](https://agentskills.io/specification): task-focused triggers, concise instructions, progressive references, and verification of real outcomes.

MIT licensed. Provider references use synthetic examples; no authenticated captures or customer data belong in this repository.
