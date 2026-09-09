import { describe, expect, test } from "bun:test";
import type { PeerMetadataRow } from "@zkp2p/sdk";
import { fiatQuoteUnits } from "../skills/check-fx-rates/scripts/quotes.ts";
import { buildPaymentProof, selectPayment } from "../skills/fiat-to-crypto/scripts/payment-proof.ts";
import { effectiveRate } from "../skills/manage-peer-vault/scripts/rates.ts";
import { createUsdcCheckout } from "../skills/accept-fiat-payments/scripts/checkout.ts";

const expected = { paymentId: "synthetic-payment", amount: "50.00", currency: "USD", recipient: "synthetic-payee" };
const row: PeerMetadataRow = { ...expected, hidden: false, originalIndex: 7, params: { paymentId: expected.paymentId, index: 99 } };
const capture = { encryptedSessionMaterial: "synthetic-ciphertext-not-a-real-session" };

describe("exact quote amounts", () => {
  test("preserves units beyond JavaScript safe integer", () => {
    expect(fiatQuoteUnits("9007199254.740993")).toBe("9007199254740993");
    expect(fiatQuoteUnits("0.000001")).toBe("1");
    expect(fiatQuoteUnits("12.50")).toBe("12500000");
  });
  test.each(["0", "0.000000", "12.0000001", "-1", "1e3", "NaN", "1,000", " 1", "01", ".5"])("rejects unsupported amount %s", amount => {
    expect(() => fiatQuoteUnits(amount)).toThrow();
  });
});

describe("payment identity and provider index", () => {
  test("selects the exact payment, not another recipient or hidden row", () => {
    const selected = selectPayment([{ ...row, recipient: "someone-else" }, { ...row, hidden: true }, row], expected);
    expect(selected).toBe(row);
  });
  test("rejects ambiguity and missing payment", () => {
    expect(() => selectPayment([row, { ...row }], expected)).toThrow("found 2");
    expect(() => selectPayment([{ ...row, paymentId: "wrong" }], expected)).toThrow("found 0");
  });
  test("uses original provider index, not params index or filtered position", () => {
    const proof = buildPaymentProof(row, capture, { actionPlatform: "venmo", actionType: "transfer_venmo", includeMetadataIndex: true });
    expect(proof.params).toEqual({ paymentId: "synthetic-payment", index: 7 });
    expect(proof.encryptedSessionMaterial).toBe(capture.encryptedSessionMaterial);
  });
  test("does not leak an index into providers that forbid it", () => {
    const proof = buildPaymentProof(row, capture, { actionPlatform: "wise", actionType: "transfer_wise", includeMetadataIndex: false });
    expect(proof.params).toEqual({ paymentId: "synthetic-payment" });
  });
  test("rejects invalid capture, index and params", () => {
    const config = { actionPlatform: "venmo", actionType: "transfer_venmo", includeMetadataIndex: true };
    expect(() => buildPaymentProof(row, { encryptedSessionMaterial: "" }, config)).toThrow("Missing encrypted");
    expect(() => buildPaymentProof({ ...row, originalIndex: -1 }, capture, config)).toThrow("metadata index");
    expect(() => buildPaymentProof({ ...row, params: undefined }, capture, config)).toThrow("invalid attestation params");
  });
});

describe("EscrowV2 rate semantics", () => {
  const floor = 950000000000000000n;
  test("zero manager rate disables instead of resetting to floor", () => {
    expect(effectiveRate(floor, { kind: "returned", rate: 0n })).toBe(0n);
  });
  test("positive manager rates respect floor", () => {
    expect(effectiveRate(floor, { kind: "returned", rate: 980000000000000000n })).toBe(980000000000000000n);
    expect(effectiveRate(floor, { kind: "returned", rate: 900000000000000000n })).toBe(floor);
  });
  test("a manager revert falls back, absent deposit pair stays disabled", () => {
    expect(effectiveRate(floor, { kind: "reverted" })).toBe(floor);
    expect(effectiveRate(floor, { kind: "none" })).toBe(floor);
    expect(effectiveRate(0n, { kind: "returned", rate: 980000000000000000n })).toBe(0n);
  });
});

describe("merchant API boundary using the real published SDK", () => {
  const destinationAddress = "0x1111111111111111111111111111111111111111" as const;
  test("preserves decimal strings and server key when constructing an order", async () => {
    let requestedBody: Record<string, unknown> | undefined;
    const captured: { key?: string | null } = {};
    let requestedUrl = "";
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = String(url);
      requestedBody = JSON.parse(String(init?.body));
      captured.key = new Headers(init?.headers).get("X-API-Key");
      return new Response(JSON.stringify({ success: true, responseObject: {
        order: { id: "synthetic-order" }, orderToken: "synthetic-token",
      } }), { status: 200 });
    }) as typeof fetch;
    const result = await createUsdcCheckout({ amount: "12.340001", destinationAddress }, {
      apiBaseUrl: "https://api.example.test", checkoutBaseUrl: "https://checkout.example.test", apiKey: "synthetic-key", fetcher,
    });
    expect(requestedUrl).toBe("https://api.example.test/api/v1/orders");
    expect(requestedBody?.requestedUsdcAmount).toBe("12.340001");
    expect(requestedBody?.destinationAddress).toBe(destinationAddress);
    expect(requestedBody?.requestedFiatAmount).toBeUndefined();
    expect(captured.key).toBe("synthetic-key");
    expect(result.order.id).toBe("synthetic-order");
  });
  test("rejects excess precision before an API call", () => {
    let called = false;
    const fetcher = (async () => { called = true; throw new Error("must not execute"); }) as unknown as typeof fetch;
    expect(() => createUsdcCheckout({ amount: "1.0000001", destinationAddress }, { apiBaseUrl: "https://example.test", fetcher })).toThrow();
    expect(called).toBe(false);
  });
  test("propagates merchant rejection; does not invent a checkout", async () => {
    const fetcher = (async () => new Response(JSON.stringify({ success: false, message: "Merchant unavailable" }), { status: 403 })) as unknown as typeof fetch;
    await expect(createUsdcCheckout({ amount: "12", destinationAddress }, { apiBaseUrl: "https://example.test", apiKey: "synthetic-key", fetcher })).rejects.toThrow();
  });
});
