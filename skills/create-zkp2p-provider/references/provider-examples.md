# Provider patterns

## JSON transaction list

```json
{
  "metadata": {
    "urlRegex": "https://api\\.example\\.com/activity$",
    "method": "GET",
    "transactionsExtraction": {
      "transactionJsonPathListSelector": "$.items",
      "transactionJsonPathSelectors": {
        "paymentId": "$.id",
        "recipient": "$.recipient.id",
        "amount": "$.amount.value",
        "currency": "$.amount.currency",
        "date": "$.createdAt",
        "status": "$.status"
      }
    }
  }
}
```

Each field selector is relative to one item.

## Same endpoint, different operations

```json
{
  "metadata": {
    "urlRegex": "https://api\\.example\\.com/graphql$",
    "bodyRegex": "\"operationName\":\"PaymentHistory\"",
    "method": "POST"
  }
}
```

Use `bodyRegex` to prevent an unrelated operation on the same endpoint from
winning the match.

## Separate metadata replay

```json
{
  "metadata": {
    "urlRegex": "https://api\\.example\\.com/payments/[a-z0-9-]+$",
    "method": "GET",
    "metadataUrl": "https://api.example.com/payments?page=0&size=20",
    "metadataUrlMethod": "GET",
    "metadataUrlBody": ""
  }
}
```

Use this only to build the selection list. If two responses must both be
trusted, enforce their relationship in the attestation transformer.

## HTML list

```json
{
  "metadata": {
    "transactionsExtraction": {
      "transactionXPathListSelector": "//li[@data-payment-id]",
      "transactionXPathSelectors": {
        "paymentId": "./@data-payment-id",
        "recipient": ".//*[@data-recipient]/@data-recipient",
        "amount": ".//*[@data-amount]/@data-amount",
        "date": ".//time/@datetime"
      }
    }
  }
}
```

Prefer API JSON when it is stable and authenticated; use XPath when the website
does not expose a suitable structured response.
