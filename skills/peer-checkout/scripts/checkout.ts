import { createCheckout, type CheckoutClientOptions } from "@zkp2p/pay-sdk";
import type { Address } from "viem";

// Call on the merchant server only, for an authorized order. Never embed opts.apiKey in a page.
export function createUsdcCheckout(input: { amount: string; destinationAddress: Address }, opts: CheckoutClientOptions) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(input.amount) || !/[1-9]/.test(input.amount)) {
    throw new Error("USDC amount must be positive with at most 6 decimals");
  }
  return createCheckout({
    requestedUsdcAmount: input.amount,
    destinationAddress: input.destinationAddress,
  }, { ...opts, signal: opts.signal ?? AbortSignal.timeout(15_000) });
}
