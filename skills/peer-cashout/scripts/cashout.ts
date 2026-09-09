import { createCashClient, type CashClientOptions, type CashoutInput, type PreparedCashoutReceipt } from "@zkp2p/cash";

export function cashClient(environment: CashClientOptions["environment"]) {
  return createCashClient({ environment });
}

type Cash = ReturnType<typeof cashClient>;

// amount is Base USDC integer units (6 decimals), not a floating-point dollar value.
export function estimateCashout(cash: Cash, amount: bigint, currency: Parameters<Cash["estimate"]>[0]["currency"]) {
  return cash.estimate({ amount, currency }, { includeEta: false });
}

// This writes payee registration state. Call only for an authorized payout.
export function prepareCashout(cash: Cash, input: CashoutInput) {
  if (input.source) throw new Error("This example prepares Base USDC only; resolve source funding separately");
  return cash.prepare(input);
}

// Use only the confirmed createDeposit receipt from the reviewed prepared plan.
export function resumeCreatedCashout(cash: Cash, receipt: PreparedCashoutReceipt) {
  if (receipt.status !== "success") throw new Error("createDeposit transaction reverted");
  return cash.finalizePreparedCashout(receipt);
}
