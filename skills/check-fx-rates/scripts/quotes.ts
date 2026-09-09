import type { Zkp2pClient } from "@zkp2p/sdk";
import { parseUnits, type Address } from "viem";

export function fiatQuoteUnits(amount: string): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(amount)) {
    throw new Error("Fiat amount must be a positive decimal with at most 6 decimal places");
  }
  const units = parseUnits(amount, 6);
  if (units <= 0n) throw new Error("Fiat amount must be greater than zero");
  return units.toString();
}

export async function quoteBaseUsdc(client: Zkp2pClient, input: {
  amount: string; currency: string; platforms: string[]; buyer: Address; recipient: Address;
}) {
  const usdc = client.getUsdcAddress();
  if (!usdc) throw new Error("No USDC address in the configured deployment");
  const result = await client.getQuote({
    amount: fiatQuoteUnits(input.amount), isExactFiat: true, fiatCurrency: input.currency,
    paymentPlatforms: input.platforms, user: input.buyer, recipient: input.recipient,
    destinationChainId: 8453, destinationToken: usdc, mode: "eligible",
  });
  if (!result.success) throw new Error(`Quote rejected: ${result.message}`);
  return result.responseObject; // Preserve expiry, fees, and all eligibility fields.
}
