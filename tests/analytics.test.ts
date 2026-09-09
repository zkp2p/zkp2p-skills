import { expect, test } from "bun:test";
import { INDEXER_URL, intentExplorerLink, reportWindow } from "../skills/peer-analytics/scripts/report.ts";

const input = { from: "2026-09-01", to: "2026-09-03", chainId: 8453, pageSize: 1, maxPages: 3 };
const first = { id: "8453_1788220800", dayTimestamp: "1788220800", fulfilledVolumeUsdCents: "9007199254740993", fulfilledIntentCount: 2, updatedAt: "1788220900" };
const second = { ...first, id: "8453_1788307200", dayTimestamp: "1788307200", fulfilledVolumeUsdCents: "7", fulfilledIntentCount: 3 };
function mockPages(pages: unknown[]) {
  const requests: { url: string; body: { variables: Record<string, unknown> } }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    if (!pages.length) throw new Error("Unexpected extra request");
    return Response.json(pages.shift());
  }) as typeof fetch;
  return { fetcher, requests };
}

test("indexer-only requests preserve precision, exclusive UTC window, and keyset pagination", async () => {
  const mock = mockPages([{ data: { GlobalDailyStats: [first, second] } }, { data: { GlobalDailyStats: [second] } }]);
  const result = await reportWindow(input, mock);
  expect(mock.requests.map(r => r.url)).toEqual([INDEXER_URL, INDEXER_URL]);
  expect(mock.requests[0]?.body.variables).toEqual({ chainId: 8453, from: "1788220800", to: "1788393600", after: "", limit: 2 });
  expect(mock.requests[1]?.body.variables.after).toBe(first.id);
  expect(result.observedFulfilledVolumeUsdCents).toBe("9007199254741000");
  expect(result.observedFulfilledIntentCount).toBe("5");
  expect(result.complete).toBe(true);
  expect(result.nextAfterId).toBeNull();
});

test("page budget returns partial observed totals, not a fabricated full report", async () => {
  const mock = mockPages([{ data: { GlobalDailyStats: [first, second] } }]);
  const result = await reportWindow({ ...input, maxPages: 1 }, mock);
  expect(result.complete).toBe(false);
  expect(result.nextAfterId).toBe(first.id);
  expect(result.rows).toEqual([first]);
  expect(result.observedFulfilledVolumeUsdCents).toBe(first.fulfilledVolumeUsdCents);
});

test("empty data differs from missing data or GraphQL partial failure", async () => {
  const empty = await reportWindow(input, mockPages([{ data: { GlobalDailyStats: [] } }]));
  expect(empty.rows).toEqual([]);
  expect(empty.complete).toBe(true);
  await expect(reportWindow(input, mockPages([{ data: { GlobalDailyStats: [first] }, errors: [{ message: "partial failure" }] }]))).rejects.toThrow("GraphQL errors");
  await expect(reportWindow(input, mockPages([{ data: {} }]))).rejects.toThrow("omitted GlobalDailyStats");
});

test("rejects lossy numeric money, invalid dates, and non-advancing pages", async () => {
  await expect(reportWindow(input, mockPages([{ data: { GlobalDailyStats: [{ ...first, fulfilledVolumeUsdCents: 9007199254740993 }] } }]))).rejects.toThrow("integer-string");
  const mock = mockPages([]);
  await expect(reportWindow({ ...input, from: "2026-02-30" }, mock)).rejects.toThrow("valid UTC");
  await expect(reportWindow({ ...input, pageSize: 0 }, mock)).rejects.toThrow("1–100");
  expect(mock.requests).toHaveLength(0);
  await expect(reportWindow(input, mockPages([{ data: { GlobalDailyStats: [first, second] } }, { data: { GlobalDailyStats: [first] } }]))).rejects.toThrow("did not advance");
});

test("HTTP failure stays a failure without an alternate analytics source", async () => {
  const urls: string[] = [];
  const fetcher = (async (url: string | URL | Request) => { urls.push(String(url)); return new Response("unavailable", { status: 503 }); }) as typeof fetch;
  await expect(reportWindow(input, { fetcher })).rejects.toThrow("Indexer HTTP 503");
  expect(urls).toEqual([INDEXER_URL]);
});

test("Peerlytics is only a formatted external intent link", () => {
  const hash = "0x09e6e5750c3dc5a66300c0a35dec742b91e4018439563dcff86cbecdc2dd3674";
  expect(intentExplorerLink(hash)).toBe(`https://peerlytics.xyz/explorer/intent/${hash}`);
  expect(() => intentExplorerLink("../api/query")).toThrow("32-byte intent hash");
});
