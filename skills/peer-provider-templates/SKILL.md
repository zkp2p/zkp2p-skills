---
name: peer-provider-templates
description: "Create or update Peer provider capture templates for payment and identity attestations. Use for request matching, metadata selectors, and TEE verification."
license: MIT
compatibility: "Authenticated browser and provider fixtures; Peer developer portal; access to the owning attestation integration."
metadata:
  author: zkp2p
  reviewed: "2026-09-09"
---

# Peer provider capture templates

Turn an authenticated website request into a provider template that PeerAuth can
capture safely and the attestation service can verify.

## Protect the boundary

- Treat browser requests, responses, cookies, tokens, and customer data as
  sensitive. Never paste them into a public issue, skill, commit, or PR.
- Keep raw captures local and short-lived. Share only sanitized field shapes,
  selectors, and synthetic examples.
- Use browser/network access already authorized for this exact integration.
  Ask only if access to the required account or capture is not authorized.
- Never persist secrets in `paramNames`, metadata rows, logs, fixtures, or
  screenshots.

## Use the current TEE model

A provider template is a capture and metadata contract. It tells PeerAuth which
request to observe or replay and which non-secret values to expose. PeerAuth
encrypts the authenticated session material; the attestation service owns the
verification policy and signed result.

Do not add retired Reclaim-only fields to a new template:

- `proofEngine`
- `skipRequestHeaders`
- `secretHeaders`
- `responseMatches`
- `responseRedactions`
- `additionalProofs`

The public provider service removes these keys. If a legacy consumer still
needs one, stop and identify that exact consumer before changing the template.

Read [runtime-contract.md](references/runtime-contract.md) before changing a
provider that spans PeerAuth, mobile, or the attestation service.

## Workflow

### 1. Define the proof statement

Record:

- platform and region;
- flow: buyer payment, identity, or seller capture;
- stable `actionType`;
- exact values the verifier must establish;
- where each value appears in the website;
- affected provider, client catalog, and attestation transformer owners.

For payment verification, start with recipient identifier, amount, timestamp,
settlement status, currency when applicable, and the intent-binding inputs.
Prefer stable platform IDs over mutable display names or handles.

### 2. Capture the smallest useful request set

Prefer a browser debugging tool attached to the user's existing authenticated
Chrome profile. If browser control is unavailable, request a sanitized HAR or
request/response sample.

Capture one request first. Add a list, detail, profile, or settings request only
when the first response cannot supply the metadata and public parameters.
Re-trigger the website action rather than replaying stale CSRF or nonce values.

Read [network-capture.md](references/network-capture.md) for the capture loop
and sanitization checklist.

### 3. Choose the context request

Select the request whose URL, method, and optional body can be matched
reliably. Use:

- `metadata.urlRegex` and `metadata.method` for the primary match;
- `metadata.bodyRegex` when several requests share an endpoint;
- `fallbackUrlRegex`, `fallbackBodyRegex`, and `fallbackMethod` only for a
  proven alternate;
- `metadataUrl` for a separate same-origin HTTPS request used to build the
  selection list;
- `shouldReplayRequestInPage` when replay needs page context.

Do not use `metadataUrl` as a substitute for a second independently verified
response. Cross-response proof semantics belong in the attestation transformer.

### 4. Map metadata and public parameters

For a selectable transaction list:

- make the list selector resolve to the array or repeated element set;
- run each field selector relative to one item;
- include only consistently present fields;
- use JSONPath for JSON and XPath for HTML.

Map placeholders in `url` or `body` with positional `paramNames` and
`paramSelectors`. Keep both arrays aligned. A selector may read from
`responseBody`, `requestBody`, `requestHeaders`, `responseHeaders`, or `url`.

PeerAuth excludes request-body selectors from public parameters. Use that
property for sensitive request values; never expose them merely to make
debugging easier.

### 5. Assemble the template

Use [provider-template.md](references/provider-template.md). At minimum align:

- file path `{platform}/{actionType}.json`;
- `actionType`;
- `metadata.platform`;
- `authLink`;
- request URL, method, and body;
- matcher and metadata extraction;
- public parameter names and selectors.

Add the file to the matching stable or mobile manifest. Keep action type and
platform routing aligned in every client catalog that invokes the verifier.

### 6. Verify the companion attestation path

The provider template alone does not make a secure proof.

Confirm the attestation transformer independently:

- reconstructs or constrains the authenticated request;
- validates the required response fields;
- binds the payment to the intended recipient, amount, currency, time, and
  status;
- rejects reversible, ambiguous, stale, or cross-account results;
- emits the expected platform and action type.

If the transformer does not exist or cannot enforce the proof statement, stop
and route the implementation to the attestation owner.

### 7. Test end to end

Test the draft config through `https://developer.peer.xyz`:

1. Install and connect PeerAuth in the same authenticated browser profile.
2. Paste the draft provider JSON into **Advanced Settings → Provider Config
   JSON**.
3. Select the correct flow, platform, and action type.
4. Authenticate and confirm the expected metadata rows appear.
5. Select a row and prepare the buyer or identity TEE request.
6. Send it to the intended attestation environment.
7. Inspect the signed attestation fields, not only the metadata preview.

Also fetch the exact stable and mobile provider URLs after integration. A
successful metadata capture without a successful attestation is not a pass.

### 8. Hand off

Report:

- proof statement and threat assumptions;
- source request shape and selectors;
- provider and manifest files;
- client routing changes;
- attestation transformer and tests;
- developer-portal result;
- stable/mobile URL checks;
- redacted gaps and follow-ups.

## References

- [network-capture.md](references/network-capture.md) — authenticated capture
  and sanitization.
- [provider-template.md](references/provider-template.md) — current template
  shape.
- [runtime-contract.md](references/runtime-contract.md) — producer and
  consumer responsibilities.
- [provider-examples.md](references/provider-examples.md) — compact current
  patterns.

Published provider baseline: [@zkp2p/providers 7.9.2](https://www.npmjs.com/package/@zkp2p/providers).
Verify the active service manifest and matching consumer before promoting a template.
