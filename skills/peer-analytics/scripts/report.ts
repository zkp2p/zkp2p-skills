import type { GlobalDailyStats } from "@zkp2p/indexer-schema/types";

export const INDEXER_URL = "https://indexer.zkp2p.xyz/v1/graphql";
export const DAILY_STATS_QUERY = `query DailyStats($chainId: Int!, $from: numeric!, $to: numeric!, $after: String!, $limit: Int!) {
  GlobalDailyStats(
    where: {chainId: {_eq: $chainId}, dayTimestamp: {_gte: $from, _lt: $to}, id: {_gt: $after}}
    order_by: {id: asc}, limit: $limit
  ) { id dayTimestamp fulfilledVolumeUsdCents fulfilledIntentCount updatedAt }
}`;

type DailyRow = Pick<GlobalDailyStats, "id" | "fulfilledIntentCount"> & {
  dayTimestamp: string; fulfilledVolumeUsdCents: string; updatedAt: string;
};

function utcDay(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new Error("Use a valid UTC calendar date: YYYY-MM-DD");
  }
  return timestamp / 1000;
}

function dailyRow(value: unknown): DailyRow {
  if (!value || typeof value !== "object") throw new Error("Invalid indexer daily-stat row");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id
    || typeof row.fulfilledIntentCount !== "number" || !Number.isSafeInteger(row.fulfilledIntentCount) || row.fulfilledIntentCount < 0
    || !["dayTimestamp", "fulfilledVolumeUsdCents", "updatedAt"].every(key =>
      typeof row[key] === "string" && /^\d+$/.test(row[key] as string))) {
    throw new Error("Indexer daily stats require integer-string amounts/timestamps and a nonnegative count");
  }
  return row as DailyRow;
}

// Reports the indexer's daily aggregates for [from, to), using whole UTC days.
// Endpoint/auth overrides must belong to the selected canonical indexer environment.
export async function reportWindow(input: {
  from: string; to: string; chainId: number; pageSize: number; maxPages: number;
}, options: { endpoint?: string; headers?: Record<string, string>; fetcher?: typeof fetch } = {}) {
  const from = utcDay(input.from), to = utcDay(input.to);
  if (from >= to) throw new Error("Window start must precede its exclusive end");
  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) throw new Error("Invalid chain ID");
  if (![input.pageSize, input.maxPages].every(n => Number.isInteger(n) && n >= 1 && n <= 100)) {
    throw new Error("Page size and page budget must each be 1–100");
  }
  const endpoint = options.endpoint ?? INDEXER_URL;
  const fetcher = options.fetcher ?? fetch;
  const rows: DailyRow[] = [];
  let after = "", complete = false, pages = 0;
  for (; pages < input.maxPages;) {
    const response = await fetcher(endpoint, {
      method: "POST", headers: { ...options.headers, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ query: DAILY_STATS_QUERY, variables: {
        chainId: input.chainId, from: String(from), to: String(to), after, limit: input.pageSize + 1,
      } }),
    });
    if (!response.ok) throw new Error(`Indexer HTTP ${response.status}`);
    const result = await response.json() as { data?: { GlobalDailyStats?: unknown }; errors?: unknown[] };
    if (result.errors?.length) throw new Error("Indexer GraphQL errors; partial data is not a complete report");
    if (!Array.isArray(result.data?.GlobalDailyStats)) throw new Error("Indexer omitted GlobalDailyStats");
    const page = result.data.GlobalDailyStats.map(dailyRow);
    for (const row of page.slice(0, input.pageSize)) {
      if (row.id <= after) throw new Error("Indexer page did not advance its unique ID cursor");
      rows.push(row);
      after = row.id;
    }
    pages++;
    if (page.length <= input.pageSize) { complete = true; break; }
  }
  return {
    source: endpoint, chainId: input.chainId, from: input.from, toExclusive: input.to,
    observedAt: new Date().toISOString(), pages, complete, nextAfterId: complete ? null : after,
    observedFulfilledVolumeUsdCents: rows.reduce((sum, row) => sum + BigInt(row.fulfilledVolumeUsdCents), 0n).toString(),
    observedFulfilledIntentCount: rows.reduce((sum, row) => sum + BigInt(row.fulfilledIntentCount), 0n).toString(),
    rows,
  };
}

// Presentation only: never fetch or scrape this link as an analytics data source.
export function intentExplorerLink(intentHash: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(intentHash)) throw new Error("Expected a 32-byte intent hash");
  return `https://peerlytics.xyz/explorer/intent/${intentHash}`;
}
