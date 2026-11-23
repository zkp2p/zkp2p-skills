import { createPeer, type PeerOptions, type PreparedSellReceipt, type SellInput } from "@zkp2p/sdk";

export function peerClient(environment: PeerOptions["environment"]) {
  return createPeer({ environment });
}

type Sell = ReturnType<typeof peerClient>["sell"];

// amount is Base USDC integer units (6 decimals), not a floating-point dollar value.
export function estimateCashout(sell: Sell, amount: bigint, currency: Parameters<Sell["estimate"]>[0]["currency"]) {
  return sell.estimate({ amount, currency }, { includeEta: false });
}

// This writes payee registration state. Call only for an authorized payout.
export function prepareCashout(sell: Sell, input: SellInput) {
  return sell.prepare(input);
}

// Use only the confirmed createDeposit receipt from the reviewed prepared plan.
export function resumeCreatedCashout(sell: Sell, receipt: PreparedSellReceipt) {
  if (receipt.status !== "success") throw new Error("createDeposit transaction reverted");
  return sell.finalizePrepared(receipt);
}
