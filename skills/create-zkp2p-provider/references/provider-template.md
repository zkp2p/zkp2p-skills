# Provider template

Use this as a shape, not as a copy-paste source of selectors.

```json
{
  "actionType": "transfer_example",
  "authLink": "https://example.com/activity",
  "url": "https://api.example.com/payments/{{PAYMENT_ID}}",
  "method": "GET",
  "body": "",
  "metadata": {
    "platform": "example",
    "urlRegex": "https://api\\.example\\.com/payments\\?limit=20$",
    "bodyRegex": "",
    "method": "GET",
    "fallbackUrlRegex": "",
    "fallbackBodyRegex": "",
    "fallbackMethod": "",
    "preprocessRegex": "",
    "shouldReplayRequestInPage": false,
    "shouldSkipCloseTab": false,
    "transactionsExtraction": {
      "transactionJsonPathListSelector": "$.payments",
      "transactionJsonPathSelectors": {
        "recipient": "$.counterparty.id",
        "recipientName": "$.counterparty.name",
        "amount": "$.amount.value",
        "date": "$.createdAt",
        "paymentId": "$.id",
        "currency": "$.amount.currency",
        "status": "$.status"
      }
    }
  },
  "paramNames": ["PAYMENT_ID"],
  "paramSelectors": [
    {
      "type": "jsonPath",
      "value": "$.payments[{{INDEX}}].id",
      "source": "responseBody"
    }
  ],
  "mobile": {
    "includeAdditionalCookieDomains": [],
    "useExternalAction": true,
    "external": {
      "actionLink": "example://pay/{{RECIPIENT_ID}}?amount={{AMOUNT}}",
      "appStoreLink": "https://apps.apple.com/example",
      "playStoreLink": "https://play.google.com/store/apps/details?id=com.example"
    },
    "login": {
      "usernameSelector": "input[type=\"email\"]",
      "passwordSelector": "input[type=\"password\"]",
      "submitSelector": "button[type=\"submit\"]",
      "revealTimeoutMs": 5000
    }
  }
}
```

## Field rules

- `actionType`, file name, client route, and verifier route must agree.
- `metadata.platform` must match the provider directory and platform route.
- `metadataUrl`, when used, must be same-origin HTTPS. Its method and body live
  in `metadataUrlMethod` and `metadataUrlBody`.
- `transactionsExtraction` may use JSONPath or XPath. Do not mix both without a
  tested consumer requirement.
- `paramNames` and `paramSelectors` are positional.
- `paramSelectors[].source` may be `responseBody`, `requestBody`,
  `requestHeaders`, `responseHeaders`, or `url`.
- `userInput` is a click guide. It does not strengthen the attestation.
- `mobile` is optional and must mirror a tested current platform shape.

## Removed keys

Do not add `proofEngine`, `skipRequestHeaders`, `secretHeaders`,
`responseMatches`, `responseRedactions`, or `additionalProofs` to a new
template. The provider service removes them from served templates.
