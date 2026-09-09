import type { BuyerTeePaymentProofInput, PeerBuyerTeePaymentCapture, PeerMetadataRow } from "@zkp2p/sdk";

type ExpectedPayment = { paymentId: string; amount: string; currency: string; recipient: string };

export function selectPayment(rows: PeerMetadataRow[], expected: ExpectedPayment): PeerMetadataRow {
  const matches = rows.filter(row => !row.hidden
    && row.paymentId === expected.paymentId && row.amount === expected.amount
    && row.currency === expected.currency && row.recipient === expected.recipient);
  if (matches.length !== 1) throw new Error(`Expected one matching payment; found ${matches.length}`);
  return matches[0]!;
}

export function buildPaymentProof(
  row: PeerMetadataRow,
  capture: PeerBuyerTeePaymentCapture,
  config: { actionPlatform: string; actionType: string; includeMetadataIndex: boolean },
): BuyerTeePaymentProofInput {
  if (!capture.encryptedSessionMaterial) throw new Error("Missing encrypted Buyer TEE session material");
  const params = row.params;
  if (!params || typeof params !== "object" || Array.isArray(params)
    || !Object.values(params).every(v => ["string", "number", "boolean"].includes(typeof v))) {
    throw new Error("Selected payment has invalid attestation params");
  }
  if (config.includeMetadataIndex && (!Number.isInteger(row.originalIndex) || row.originalIndex < 0)) {
    throw new Error("Missing original provider metadata index");
  }
  const { index: _providerIndex, ...paymentParams } = params;
  return {
    proofType: "buyerTee",
    encryptedSessionMaterial: capture.encryptedSessionMaterial,
    params: { ...paymentParams, ...(config.includeMetadataIndex ? { index: row.originalIndex } : {}) },
    actionPlatform: config.actionPlatform,
    actionType: config.actionType,
  };
}
