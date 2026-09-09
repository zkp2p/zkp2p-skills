import type { Zkp2pClient } from "@zkp2p/sdk";
import type { Hex } from "viem";

export function prepareMakerDeposit(client: Zkp2pClient, input: {
  amount: bigint; minFill: bigint; maxFill: bigint; platform: string;
  currency: string; fiatPerUsdc18: bigint; verifiedPayeeHash: Hex;
}) {
  if (input.amount <= 0n || input.minFill <= 0n || input.minFill > input.maxFill
    || input.maxFill > input.amount || input.fiatPerUsdc18 <= 0n) {
    throw new Error("Require 0 < minFill <= maxFill <= amount and a positive 18-decimal rate");
  }
  const usdc = client.getUsdcAddress();
  if (!usdc) throw new Error("No USDC address in the configured deployment");
  return client.prepareCreateDeposit({
    token: usdc, amount: input.amount,
    intentAmountRange: { min: input.minFill, max: input.maxFill },
    processorNames: [input.platform], payeeDetailsHashes: [input.verifiedPayeeHash],
    conversionRates: [[{ currency: input.currency, conversionRate: input.fiatPerUsdc18.toString() }]],
  });
}
