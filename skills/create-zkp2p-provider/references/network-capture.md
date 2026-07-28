# Network capture

## Safety

- Get permission before controlling an authenticated browser or reading
  network data.
- Reuse the user's chosen browser profile so the captured flow matches the
  real session.
- Never copy cookies, authorization headers, CSRF tokens, account numbers,
  payment identifiers, or raw response bodies into public artifacts.
- Keep only the endpoint shape, method, synthetic body shape, field names, and
  selectors needed to author the template.

## Capture loop

1. Navigate to the page that naturally exposes the target data.
2. Start network recording.
3. Trigger exactly one UI action.
4. Filter requests by host, path, method, and initiator.
5. Inspect the smallest candidate response.
6. Record a sanitized shape and candidate selectors.
7. Repeat with a second account item or transaction to test selector stability.

Prefer DOM snapshots for navigation and the browser's network request detail
for request/response analysis. Screenshots are not authoritative evidence for
headers, payloads, or selectors.

## Choose requests deliberately

For each candidate, record:

- URL shape and whether path/query values are dynamic;
- method and body content type;
- whether the request requires page-context replay;
- whether the response is JSON, HTML, or wrapped JSON;
- the list selector;
- stable recipient, amount, timestamp, status, currency, and payment ID fields;
- which values must remain encrypted session material;
- whether list and detail data come from different requests.

Use `metadataUrl` only for a same-origin HTTPS request that builds metadata.
When two responses must both be trusted, the attestation transformer must
verify that relationship; the provider template does not create a second proof.

## Avoid false matches

- Escape regex punctuation in URLs.
- Add `bodyRegex` when an endpoint handles multiple operations.
- Prefer a narrow deterministic match over broad fallbacks.
- Re-trigger one-time requests instead of replaying stale tokens.
- Test at least two rows so `{{INDEX}}` and relative selectors are not
  accidentally bound to the first item.

## Sanitized evidence format

```text
platform: example
actionType: transfer_example
request:
  method: POST
  url: https://api.example.com/activity
  body shape: {"page": <number>, "filter": <string>}
response shape:
  items[]:
    id: <synthetic>
    recipient.id: <synthetic>
    amount.value: <synthetic>
    amount.currency: <synthetic>
    createdAt: <synthetic>
    status: <synthetic>
selectors:
  list: $.items
  paymentId: $.id
  recipient: $.recipient.id
  amount: $.amount.value
  currency: $.amount.currency
  date: $.createdAt
  status: $.status
```

Do not store the original values beside this summary.
