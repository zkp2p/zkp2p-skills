---
name: manage-peer-vault
description: Create or operate a Peer rate-manager vault and delegate maker pricing. Use for manager fees, deposit floors, rate updates, and delegation checks.
license: MIT
compatibility: "@zkp2p/sdk 0.14.0 and viem 2.x; configured Base deployment; authorized manager or depositor wallet."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Manage a Peer pricing vault

A Peer vault is a rate manager for maker deposits. It is not an ERC-4626 pooled asset vault: delegation does not mint shares or transfer custody of the maker's USDC to the manager. Keep deposit ownership, delegate/controller authority, manager identity, and fee recipient distinct.

## Read before changing a rate

Resolve environment, registry address, `rateManagerId`, authorized manager wallet, affected escrow/deposits, currency/method pairs, and requested pricing or fee policy. Read live configuration using `@zkp2p/sdk@0.14.0` and the relevant deployment's contract ABI. Never invent addresses from a marketing domain or copy a staging registry into production.

For an existing vault, read manager, fee recipient, current/max fee, configured rate pairs, and each target deposit's own floor and delegation. A requested percentage needs a declared unit conversion: rates and fees here use 18-decimal fixed-point values, not integer basis points passed directly to the contract.

## Create or delegate

1. Prepare `client.createRateManager.prepare({ config: { manager, feeRecipient, maxFee, fee, name, uri } })` for the authorized configuration. `maxFee` is the lifetime ceiling for that manager; select it deliberately and respect the deployed contract's cap. Do not choose example fee recipients or add an agent fee.
2. Simulate and submit through the configured signer; derive the new manager ID from the confirmed receipt, then read it back. A name/URI is metadata, not evidence of deployment.
3. Set explicit rates for supported method/currency pairs before attaching deposits. Use protocol payment-method and currency hashes from the configured SDK/contracts, not a guessed encoding or fiat symbol address.
4. Attach each deposit using the path that owns its delegation: direct `setRateManager` or the existing controller's `setDepositRateManager`. These are different authority paths. Read current ownership/controller configuration first; verify escrow, registry, and manager ID after confirmation.

## Rate semantics that matter

For the current EscrowV2 implementation:

- A zero deposit floor means the pair is unavailable.
- Without a manager, the deposit floor is effective.
- If the manager successfully returns **zero**, the pair is unavailable, even with a positive deposit floor.
- If the manager returns a positive rate, effective rate = `max(deposit floor, manager rate)`.
- If the manager call reverts, the deposit floor is used. A successful but stale rate does **not** trigger this fallback.

Therefore, do not write zero as “reset to floor.” To restore each deposit's own floor, prepare `client.clearRateManager.prepare({ depositId, escrowAddress })` for a direct assignment, or `client.clearDepositRateManager.prepare({ escrow, depositId })` for an assignment managed through the controller. Verify the authorized signer and read back each cleared assignment. This explicit reset uses the on-chain deposit floors and does not need an FX feed. If the available wallet only manages rates and cannot clear deposit delegation, report that authority gap; do not substitute a zero or guessed small rate. To pause a pair, use the explicit supported configuration. Existing intents retain their snapshotted rates and fees.

## Update with an inspectable policy

Use `setVaultMinRate.prepare` for a pair or `setVaultMinRatesBatch.prepare` for an intentional batch. [The checked example](scripts/rates.ts) prepares a positive rate and documents the effective-rate calculation. A price service failure should stop an automated update with the previous configuration reported; never turn missing FX data into a zero-rate transaction.

For automation, establish allowed pairs, minimum floors, update interval, maximum movement, a stale-data cutoff, and a human-selected response to stale inputs. Enforce these in the owning app before signing. Fetch current fees/rates immediately before writing, simulate, confirm, and read back the affected pairs. Do not promise automated maintenance unless an actual scheduler/service exists.

Return the registry/manager ID, affected deposit identities, previous and confirmed rates/fees with units, receipt hashes, and effective-rate consequences. A configured vault with no delegated liquidity is not deployed earning capital.

Sources: [vault guide](https://docs.peer.xyz/guides/for-vault-managers/run-a-vault), [SDK reference](https://docs.peer.xyz/developer/sdk/client-reference), [EscrowV2](https://github.com/zkp2p/zkp2p-contracts/blob/2e70f3cc8ce7364bd3f417acd83452880f4df330/contracts/EscrowV2.sol), [RateManagerV1](https://github.com/zkp2p/zkp2p-contracts/blob/2e70f3cc8ce7364bd3f417acd83452880f4df330/contracts/RateManagerV1.sol).
