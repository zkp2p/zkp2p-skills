# Peer skills

Nine agent skills for using and building on [Peer](https://peer.xyz): create cash-outs, signal and fulfill intents, create checkout orders, request quotes, manage deposits and rate managers, trace transactions, query analytics, and build provider templates.

Each skill is a complete use case with its own instructions and supporting files. Install only the workflows you need. Examples use published SDKs and the host's existing wallet or credentials; importing an example does not send a transaction.

## Install

With Node.js 22.20+ and the [Skills CLI](https://skills.sh/docs):

```sh
npx skills add zkp2p/zkp2p-skills --list
npx skills add zkp2p/zkp2p-skills --skill peer-cashout
```

Choose your agent and project/global scope in the installer. List first instead of installing every skill. To check existing installations:

```sh
npx skills check
npx skills update
```

## Choose a workflow

| Skill | Use it when | Result |
| --- | --- | --- |
| [peer-cashout](skills/peer-cashout/SKILL.md) | Create or resume a cash-out through Peer Cash | Deposit-backed fiat delivery, fill tracking, and recovery |
| [peer-intents](skills/peer-intents/SKILL.md) | Signal or fulfill a buyer intent in the onramp flow | Confirmed intent, Buyer TEE proof, and settlement evidence |
| [peer-checkout](skills/peer-checkout/SKILL.md) | Create a Peer Pay merchant checkout order | Payment link and authenticated, idempotent order fulfillment |
| [peer-quotes](skills/peer-quotes/SKILL.md) | Request or compare quotes for a buyer wallet | Executable pricing, fees, expiry, and eligibility; read-only |
| [peer-deposits](skills/peer-deposits/SKILL.md) | Create or manage an escrow deposit directly | Payees, payment methods, rates, fill limits, and withdrawals |
| [peer-rate-managers](skills/peer-rate-managers/SKILL.md) | Create or manage a rate manager (pricing vault) | Rates, fees, and deposit delegation |
| [peer-protocol-trace](skills/peer-protocol-trace/SKILL.md) | Investigate a specific intent, deposit, or transaction | Indexed and on-chain lifecycle reconciliation; read-only |
| [peer-analytics](skills/peer-analytics/SKILL.md) | Query protocol metrics and activity over a period | Aggregate reports with explicit attribution and coverage; read-only |
| [peer-provider-templates](skills/peer-provider-templates/SKILL.md) | Build or update a provider capture template | Request matching, metadata extraction, and verified attestations |

Choose `peer-cashout` for the Cash SDK's complete cash-out lifecycle; choose `peer-deposits` for direct escrow configuration and management. `peer-quotes` only requests pricing, while `peer-intents` covers buyer execution. `peer-protocol-trace` investigates individual records; `peer-analytics` measures activity across a defined scope and period.

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

## Upgrade from earlier names

The nine workflows now use protocol and SDK terms. Earlier names such as `pay-humans-fiat`, `provide-peer-liquidity`, and `check-fx-rates` are retired. The workflows and bundled examples are preserved; directories, descriptions, and discovery headings have changed.

Install the replacement you use, then inspect the agent's installed skills. A repository update may not remove old local names. Remove retired entries with `npx skills remove <old-name>` in the same project/global scope. Review the CLI's selection before removal.

| Retired name(s) | Current skill |
| --- | --- |
| `pay-humans-fiat`, `peer-offramp`, `peer-transfer` | `peer-cashout` |
| `fiat-to-crypto`, `peer-onramp` | `peer-intents` |
| `accept-fiat-payments` | `peer-checkout` |
| `provide-peer-liquidity`, `peer-lp`, `earn-on-idle-usdc` | `peer-deposits` |
| `manage-peer-vault`, `peer-vault`, `earn-as-defi-manager`, `peer-rate-optimizer` | `peer-rate-managers` |
| `check-fx-rates`, `peer-market` | `peer-quotes` |
| `look-up-peer-data`, `peer-explorer` | `peer-protocol-trace` |
| `analyze-peer-protocol`, `peer-activity`, `monitor-peer-activity` | `peer-analytics` |
| `create-zkp2p-provider` | `peer-provider-templates` |
| `send-usdc` | Use your wallet's ordinary transfer tooling |

`peer-checkout` and `peer-analytics` also appeared in the original 22-entry catalog. If those names are already installed from that version, update or reinstall them from this repository to receive the current workflows. They are active names, not entries to remove.

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
