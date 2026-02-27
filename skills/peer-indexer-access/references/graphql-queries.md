# Peer Indexer GraphQL Queries

Use these templates against `POST /v1/graphql` on the proxy.

## 1) Schema Bootstrap

Run this first when you need to confirm available entity names and fields for the currently configured upstream indexer.

```graphql
query SchemaBootstrap {
  __schema {
    queryType {
      name
    }
    types {
      name
    }
  }
}
```

## 2) Active Deposits

```graphql
query ActiveDeposits($limit: Int = 50) {
  Deposit(
    where: { acceptingIntents: { _eq: true }, availableBalance_gt: "0" }
    order_by: { availableBalance: desc }
    limit: $limit
  ) {
    id
    depositor
    token
    depositAmount
    availableBalance
    intentAmountMin
    intentAmountMax
    methodCurrencies {
      paymentMethod
      currencyCode
      conversionRate
      managerRate
      isActive
    }
  }
}
```

## 3) Recent Intents by Depositor

```graphql
query IntentHistory($depositor: String!, $limit: Int = 100) {
  Intent(
    where: { deposit: { depositor: { _eq: $depositor } } }
    order_by: { createdAt: desc }
    limit: $limit
  ) {
    id
    intentHash
    amount
    status
    paymentMethod
    fiatCurrency
    conversionRate
    createdAt
    fulfilledAt
    managerFeeAmount
    rateManagerId
  }
}
```

## 4) Manager Aggregate Stats

```graphql
query ManagerAggregate($rateManagerId: String!) {
  ManagerAggregateStats(where: { rateManagerId: { _eq: $rateManagerId } }) {
    rateManagerId
    totalFilledVolume
    totalFeeAmount
    totalPnlUsdCents
    fulfilledIntents
    currentDelegatedBalance
    currentDelegatedDeposits
    updatedAt
  }
}
```

## 5) cURL with Variables

```bash
curl -sS "$INDEXER_PROXY_BASE_URL/v1/graphql" \
  -H "content-type: application/json" \
  -H "x-client-capabilities: x402" \
  --data @- <<'JSON'
{
  "query": "query IntentHistory($depositor: String!, $limit: Int = 20) { Intent(where: { deposit: { depositor: { _eq: $depositor } } }, order_by: { createdAt: desc }, limit: $limit) { id intentHash status createdAt } }",
  "variables": {
    "depositor": "0xabc...",
    "limit": 20
  }
}
JSON
```
