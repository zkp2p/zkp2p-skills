# Runtime contract

## Provider service

The provider service publishes:

- `/providers/providers.json`
- `/providers/{platform}/{actionType}.json`
- `/providers/mobile/providers.json`
- `/providers/mobile/{platform}/{actionType}.json`

It may serve a reviewed repository snapshot or a controlled configuration
override. Treat the served response as the deployment truth.

The service removes retired Reclaim-only keys recursively before serving a
template. Do not judge a draft solely by its source file; fetch the served
stable and mobile URLs.

## PeerAuth

PeerAuth:

1. resolves the provider config;
2. finds the context request using URL, body, and method matchers;
3. extracts selectable metadata;
4. derives public parameter values;
5. packages request headers and body as encrypted session material;
6. sends the selected public parameters with that encrypted material to the
   buyer-TEE or identity path.

Request-body selectors are not exposed as public parameters. Keep sensitive
request values inside encrypted session material.

## Attestation service

The attestation service owns proof semantics. A platform/action transformer
must validate the authenticated exchange and emit a signed attestation.

The transformer—not the provider template—must defend against:

- mutable or ambiguous recipient identifiers;
- pending, reversible, canceled, or refunded payments;
- amount and currency mismatches;
- stale timestamps;
- cross-account or cross-intent substitution;
- untrusted client-provided metadata.

## Developer portal

The developer portal accepts an inline provider config. For a buyer flow it
opens PeerAuth, stages an encrypted TEE capture, shows extracted metadata, and
prepares the buyer TEE request. It can then send the request to the selected
attestation environment.

Metadata display proves only that capture and selectors worked. The pass signal
is a successful attestation with the expected signed fields.

## Cross-repository completion

A new provider may require coordinated changes in:

- the provider data and manifest owner;
- PeerAuth when a new matcher or extraction feature is needed;
- mobile provider routing or native action metadata;
- client platform/action catalogs;
- the attestation transformer and its fixtures/tests.

Record the producer/consumer order and do not merge a provider that routes to a
missing or weaker verifier.
