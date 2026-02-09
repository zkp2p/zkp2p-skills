#!/usr/bin/env python3
"""
ZKP2P Vault Rate Optimizer

Queries the indexer for vault performance data, computes recommended rate
adjustments, and outputs them as JSON. Does NOT execute on-chain transactions
directly -- use the TypeScript implementation in SKILL.md for execution.

Usage:
    python3 optimize.py <vault_id> [indexer_url] [--dry-run] [--json]

Arguments:
    vault_id     The bytes32 rateManagerId for the vault
    indexer_url  GraphQL endpoint (default: staging indexer)
    --dry-run    Print recommendations without executing (default behavior)
    --json       Output as machine-readable JSON

Examples:
    python3 optimize.py 0xabc123...
    python3 optimize.py 0xabc123... https://indexer.hyperindex.xyz/00be13d/v1/graphql --json
"""

import json
import sys
import time
import urllib.request
from dataclasses import dataclass, asdict
from typing import Optional

# --- Constants ---
PRECISE_UNIT = 10**18
BPS_UNIT = PRECISE_UNIT // 10_000
MIN_SPREAD_FLOOR = PRECISE_UNIT + (10 * BPS_UNIT)    # 10 bps minimum
MAX_SPREAD_CAP = PRECISE_UNIT + (1000 * BPS_UNIT)    # 10% maximum
MAX_CHANGE_PER_ITER = 50 * BPS_UNIT                   # 50 bps max change
ZERO_FILL_DISABLE_DAYS = 7                            # Disable after N days of no fills
WARNING_THRESHOLD_BPS = 30                             # Warn if change > 30 bps

DEFAULT_INDEXER_URL = "https://indexer.hyperindex.xyz/00be13d/v1/graphql"


@dataclass
class PairMetrics:
    payment_method_hash: str
    currency_code: str
    current_rate: int
    pnl_7d: int
    volume_7d: int
    fill_count_7d: int
    days_since_last_fill: int
    market_best_rate: int
    market_median_rate: int


@dataclass
class RateAdjustment:
    payment_method_hash: str
    currency_code: str
    current_rate: int
    new_rate: int
    change_bps: int
    reason: str
    warning: bool = False


def query_indexer(indexer_url: str, query: str) -> dict:
    """Execute a GraphQL query against the indexer."""
    payload = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        indexer_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            if "errors" in body:
                print(f"GraphQL errors: {body['errors']}", file=sys.stderr)
                return {}
            return body.get("data", {})
    except Exception as e:
        print(f"Indexer query failed: {e}", file=sys.stderr)
        return {}


def fetch_vault_rates(indexer_url: str, vault_id: str) -> list[dict]:
    """Fetch current rates for a vault."""
    query = """
    {
      RateManagerRate(where: { rateManagerId: { _eq: "%s" } }) {
        paymentMethodHash
        currencyCode
        managerRate
        updatedAt
      }
    }
    """ % vault_id
    data = query_indexer(indexer_url, query)
    return data.get("RateManagerRate", [])


def fetch_vault_performance(indexer_url: str, vault_id: str, since_ts: int) -> list[dict]:
    """Fetch per-intent performance stats for a vault over a time window."""
    query = """
    {
      ManagerStats(
        where: {
          rateManagerId: { _eq: "%s" }
          createdAt: { _gte: "%d" }
        }
        order_by: { createdAt: desc }
      ) {
        intentId
        depositId
        amount
        quoteConversionRate
        marketRate
        spreadBps
        pnlUsdCents
        managerFee
        managerFeeAmount
        createdAt
      }
    }
    """ % (vault_id, since_ts)
    data = query_indexer(indexer_url, query)
    return data.get("ManagerStats", [])


def fetch_aggregate_stats(indexer_url: str, vault_id: str) -> Optional[dict]:
    """Fetch aggregate vault stats."""
    query = """
    {
      ManagerAggregateStats(where: { rateManagerId: { _eq: "%s" } }) {
        totalFilledVolume
        totalFeeAmount
        totalPnlUsdCents
        fulfilledIntents
        currentDelegatedBalance
        currentDelegatedDeposits
        updatedAt
      }
    }
    """ % vault_id
    data = query_indexer(indexer_url, query)
    stats = data.get("ManagerAggregateStats", [])
    return stats[0] if stats else None


def fetch_competitor_rates(
    indexer_url: str,
    payment_method_hash: str,
    currency_code: str,
) -> list[int]:
    """Fetch all active competitor rates for a (method, currency) pair."""
    query = """
    {
      MethodCurrency(
        where: {
          paymentMethodHash: { _eq: "%s" }
          currencyCode: { _eq: "%s" }
          conversionRate: { _gt: "0" }
        }
        order_by: { conversionRate: asc }
      ) {
        conversionRate
      }
    }
    """ % (payment_method_hash, currency_code)
    data = query_indexer(indexer_url, query)
    return [int(mc["conversionRate"]) for mc in data.get("MethodCurrency", [])]


def compute_adjustment(metrics: PairMetrics) -> RateAdjustment:
    """Apply the rate optimization algorithm to a single pair."""
    new_rate = metrics.current_rate
    reason = "HOLD -- performing within acceptable range"

    if metrics.pnl_7d < 0:
        new_rate = metrics.current_rate + (20 * BPS_UNIT)
        reason = f"WIDEN +20bps -- negative PnL ({metrics.pnl_7d} cents)"

    elif metrics.fill_count_7d == 0 and metrics.current_rate > 0:
        if metrics.days_since_last_fill > ZERO_FILL_DISABLE_DAYS:
            new_rate = 0
            reason = f"DISABLE -- zero fills for {metrics.days_since_last_fill} days"
        else:
            new_rate = metrics.current_rate - (15 * BPS_UNIT)
            reason = "TIGHTEN -15bps -- no recent fills, may be overpriced"

    elif metrics.volume_7d > 0 and metrics.current_rate > (
        metrics.market_median_rate * 105 // 100
    ):
        new_rate = metrics.current_rate - (10 * BPS_UNIT)
        reason = "TIGHTEN -10bps -- overpriced vs market median"

    elif metrics.volume_7d > 0 and metrics.current_rate < metrics.market_best_rate:
        new_rate = metrics.current_rate + (5 * BPS_UNIT)
        reason = "WIDEN +5bps -- underpriced vs market best"

    # Apply safety constraints
    warning = False
    if new_rate != 0:
        if new_rate < MIN_SPREAD_FLOOR:
            new_rate = MIN_SPREAD_FLOOR
        if new_rate > MAX_SPREAD_CAP:
            new_rate = MAX_SPREAD_CAP

        delta = abs(new_rate - metrics.current_rate)
        if delta > MAX_CHANGE_PER_ITER:
            if new_rate > metrics.current_rate:
                new_rate = metrics.current_rate + MAX_CHANGE_PER_ITER
            else:
                new_rate = metrics.current_rate - MAX_CHANGE_PER_ITER
            reason += " [CLAMPED to 50bps max]"

    change_bps = (new_rate - metrics.current_rate) * 10_000 // PRECISE_UNIT
    if abs(change_bps) > WARNING_THRESHOLD_BPS:
        warning = True

    return RateAdjustment(
        payment_method_hash=metrics.payment_method_hash,
        currency_code=metrics.currency_code,
        current_rate=metrics.current_rate,
        new_rate=new_rate,
        change_bps=change_bps,
        reason=reason,
        warning=warning,
    )


def compute_days_since_last_fill(intents: list[dict]) -> int:
    """Compute days since the most recent intent fulfillment."""
    if not intents:
        return 999
    latest = max(int(i["createdAt"]) for i in intents)
    now = int(time.time())
    return (now - latest) // 86400


def main():
    # Parse arguments
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]

    if len(args) < 1:
        print("Usage: python3 optimize.py <vault_id> [indexer_url] [--dry-run] [--json]")
        print()
        print("Arguments:")
        print("  vault_id     The bytes32 rateManagerId for the vault")
        print("  indexer_url  GraphQL endpoint (default: staging indexer)")
        print()
        print("Flags:")
        print("  --dry-run    Print recommendations only (default)")
        print("  --json       Output as machine-readable JSON")
        sys.exit(1)

    vault_id = args[0]
    indexer_url = args[1] if len(args) > 1 else DEFAULT_INDEXER_URL
    output_json = "--json" in flags

    if not output_json:
        print(f"=== ZKP2P Rate Optimizer ===")
        print(f"Vault: {vault_id}")
        print(f"Indexer: {indexer_url}")
        print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
        print()

    # Step 1: Fetch current vault rates
    current_rates = fetch_vault_rates(indexer_url, vault_id)
    if not current_rates:
        if output_json:
            print(json.dumps({"error": "No rates found for vault", "vault_id": vault_id}))
        else:
            print("No rates found for this vault. Has it been created and configured?")
        sys.exit(1)

    if not output_json:
        print(f"Found {len(current_rates)} rate pair(s)")

    # Step 2: Fetch performance data (last 7 days)
    seven_days_ago = int(time.time()) - 7 * 86400
    performance = fetch_vault_performance(indexer_url, vault_id, seven_days_ago)

    if not output_json:
        print(f"Found {len(performance)} intent(s) in last 7 days")

    # Step 3: Fetch aggregate stats
    agg_stats = fetch_aggregate_stats(indexer_url, vault_id)
    if agg_stats and not output_json:
        print(f"Lifetime volume: {int(agg_stats.get('totalFilledVolume', 0)) / 1e6:.2f} USDC")
        print(f"Lifetime PnL: {int(agg_stats.get('totalPnlUsdCents', 0)) / 100:.2f} USD")
        print(f"Total intents fulfilled: {agg_stats.get('fulfilledIntents', 0)}")
        print(f"Active delegated deposits: {agg_stats.get('currentDelegatedDeposits', 0)}")
        print()

    # Step 4: Compute adjustments for each pair
    adjustments = []
    for rate in current_rates:
        pmh = rate["paymentMethodHash"]
        cc = rate["currencyCode"]
        current_rate_val = int(rate["managerRate"])

        # Fetch competitor rates for this pair
        competitor_rates = fetch_competitor_rates(indexer_url, pmh, cc)
        market_best = competitor_rates[0] if competitor_rates else current_rate_val
        market_median = (
            competitor_rates[len(competitor_rates) // 2]
            if competitor_rates
            else current_rate_val
        )

        # Aggregate pair performance
        pnl_7d = sum(int(s["pnlUsdCents"]) for s in performance)
        volume_7d = sum(int(s["amount"]) for s in performance)
        fill_count = len(performance)
        days_since = compute_days_since_last_fill(performance)

        metrics = PairMetrics(
            payment_method_hash=pmh,
            currency_code=cc,
            current_rate=current_rate_val,
            pnl_7d=pnl_7d,
            volume_7d=volume_7d,
            fill_count_7d=fill_count,
            days_since_last_fill=days_since,
            market_best_rate=market_best,
            market_median_rate=market_median,
        )

        adj = compute_adjustment(metrics)
        adjustments.append(adj)

    # Step 5: Output results
    if output_json:
        output = {
            "vault_id": vault_id,
            "timestamp": int(time.time()),
            "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "aggregate_stats": agg_stats,
            "adjustments": [asdict(a) for a in adjustments],
            "summary": {
                "total_pairs": len(adjustments),
                "changes": sum(1 for a in adjustments if a.new_rate != a.current_rate),
                "holds": sum(1 for a in adjustments if a.new_rate == a.current_rate),
                "warnings": sum(1 for a in adjustments if a.warning),
                "disables": sum(1 for a in adjustments if a.new_rate == 0),
            },
        }
        print(json.dumps(output, indent=2))
    else:
        print("--- Rate Recommendations ---")
        print()
        changes = 0
        for adj in adjustments:
            status = "HOLD" if adj.new_rate == adj.current_rate else "CHANGE"
            warn = " [WARNING]" if adj.warning else ""
            print(f"[{status}]{warn} {adj.payment_method_hash[:14]}... / {adj.currency_code[:14]}...")
            print(f"  Current rate: {adj.current_rate}")
            print(f"  New rate:     {adj.new_rate}")
            sign = "+" if adj.change_bps >= 0 else ""
            print(f"  Change:       {sign}{adj.change_bps} bps")
            print(f"  Reason:       {adj.reason}")
            print()
            if adj.new_rate != adj.current_rate:
                changes += 1

        print(f"--- Summary ---")
        print(f"Total pairs:  {len(adjustments)}")
        print(f"Changes:      {changes}")
        print(f"Holds:        {len(adjustments) - changes}")
        print(f"Warnings:     {sum(1 for a in adjustments if a.warning)}")
        print()
        if changes > 0:
            print("To execute these changes, use the TypeScript implementation")
            print("in SKILL.md with executeAdjustments().")


if __name__ == "__main__":
    main()
