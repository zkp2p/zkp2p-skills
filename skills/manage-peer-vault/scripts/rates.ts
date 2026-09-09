import type { Zkp2pClient } from "@zkp2p/sdk";
import type { Address, Hex } from "viem";

// Model the current EscrowV2 rule. `reverted` must mean an actual reverted manager call,
// not a transport timeout or a price feed's missing/stale observation.
export function effectiveRate(floor: bigint, manager:
  { kind: "none" } | { kind: "reverted" } | { kind: "returned"; rate: bigint },
): bigint {
  if (floor < 0n || (manager.kind === "returned" && manager.rate < 0n)) {
    throw new Error("Rates cannot be negative");
  }
  if (floor === 0n) return 0n;
  if (manager.kind !== "returned") return floor;
  if (manager.rate === 0n) return 0n;
  return manager.rate > floor ? manager.rate : floor;
}

export function preparePositiveRate(client: Zkp2pClient, input: {
  rateManagerId: Hex; paymentMethodHash: Hex; currencyHash: Hex; rate: bigint;
}) {
  if (input.rate <= 0n) throw new Error("Positive rate required; zero disables the pair and needs an explicit pause workflow");
  return client.setVaultMinRate.prepare(input);
}

// Choose the authority path from the deposit's live configuration, not by trial and error.
export function prepareFloorReset(client: Zkp2pClient, depositId: bigint, escrow: Address,
  path: "direct" | "controller") {
  return path === "direct"
    ? client.clearRateManager.prepare({ depositId, escrowAddress: escrow })
    : client.clearDepositRateManager.prepare({ escrow, depositId });
}
