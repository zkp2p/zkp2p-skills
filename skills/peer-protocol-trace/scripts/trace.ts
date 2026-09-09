import type { Zkp2pClient } from "@zkp2p/sdk";
import type { Hex } from "viem";

export function indexedIntent(client: Zkp2pClient, intentHash: Hex) {
  return client.indexer.getIntentByHash(intentHash); // null is not proof of failed broadcast.
}

export function indexedDeposit(client: Zkp2pClient, returnedDepositId: string) {
  return client.indexer.getDepositById(returnedDepositId, { includeIntents: true });
}

export function activeOnchainIntent(client: Zkp2pClient, intentHash: Hex) {
  return client.getIntent(intentHash); // Reconcile with receipt history after prune/fulfillment.
}
