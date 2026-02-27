---
name: peer-indexer-access
description: Query Peer (ZKP2P) on-chain indexer data through the indexer-proxy GraphQL endpoint (`/v1/graphql`) using an x402-enabled client. Use when requests need indexed protocol entities (deposits, intents, managers, vault stats) with x402 payment authorization.
---

# Peer Indexer Access

Use this skill to query Peer indexer data through this proxy with an x402-enabled client.

## Endpoint Contract

- `POST /v1/graphql` with JSON body `{ "query": "...", "variables": { ... } }`
- `GET /v1/graphql?query=<url-encoded-graphql>` for fallback
- Preserve the upstream GraphQL contract from `INDEXER_GRAPHQL_URL`; this proxy does not redefine schema fields.

## Deterministic Middleware Behavior

x402 behavior is also fixed:
1. Request under free quota: forward directly.
2. Request over free quota without x402 capability: return `429` with `Retry-After`.
3. Request over free quota with x402 capability: enter x402 path.
4. No payment proof yet: return `402 Payment Required` with `payment-required` and `Retry-After`.
5. Valid payment attempt: upgrade to `x402` and apply paid-tier limiter.

## x402 Activation Rules

x402 only activates when all of these are true:
- Client advertises capability: `x-client-capabilities: x402`
- Free-tier quota is exhausted
- Server is configured for x402 (`X402_PAY_TO_ADDRESS` is non-empty and middleware initializes)

Do not treat payment headers alone as x402 opt-in:
- `payment-signature` or `x-payment` without `x-client-capabilities: x402` must not trigger x402 flow.
- If `X402_PAY_TO_ADDRESS` is empty, overflow remains `429` (never `402`).

## Access Recipe

1. Send GraphQL request to `/v1/graphql`.
2. Add `x-client-capabilities: x402` if the client can pay.
3. Handle response:
- `200`: success (free or paid).
- `402`: run x402 payment flow and retry with payment proof.
- `429`: respect `Retry-After` and retry later.
4. For sustained traffic, keep capability header enabled so overflow can be upgraded automatically.

## TypeScript Example (Automatic x402 Retry)

```ts
import axios from "axios";
import { x402Client, wrapAxiosWithPayment } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY!);
const client = new x402Client();
registerExactEvmScheme(client, { signer });

const api = wrapAxiosWithPayment(
  axios.create({ baseURL: process.env.INDEXER_PROXY_BASE_URL! }),
  client,
);

const response = await api.post(
  "/v1/graphql",
  { query: "{ Deposit(limit: 1) { id } }" },
  {
    headers: {
      "content-type": "application/json",
      "x-client-capabilities": "x402",
    },
  },
);

console.log(response.status, response.data);
```

## cURL Example

```bash
curl -sS "$INDEXER_PROXY_BASE_URL/v1/graphql" \
  -H "content-type: application/json" \
  -H "x-client-capabilities: x402" \
  --data '{"query":"{ Deposit(limit: 1) { id depositor } }"}'
```

## Query Reference

Use [references/graphql-queries.md](references/graphql-queries.md) for ready-to-run query templates for:
- active deposits
- recent intents
- manager aggregate stats
- schema introspection bootstrap

## Local Verification Checklist

- Ensure test traffic can exercise free-tier overflow behavior for x402.
- Ensure proxy has `X402_PAY_TO_ADDRESS` configured for paid overflow tests.
- Confirm `Retry-After` is present on both `429` and `402` overflow responses.
