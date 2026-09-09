import { Peerlytics } from "@peerlytics/sdk";

export function analyticsClient(apiKey: string) {
  if (!apiKey) throw new Error("An existing Peerlytics API key is required");
  return new Peerlytics({ auth: { mode: "api-key", apiKey } });
}

export async function reportWindow(client: Peerlytics, from: string, to: string) {
  const start = Date.parse(from), end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error("Require an explicit valid UTC start before end");
  }
  const summary = await client.getProtocolSummary({ from, to, compare: "prior_period" });
  const activity = await client.getActivity({ from, to, limit: 25 });
  return { from, to, summary, activity, credits: client.getLastCredits() };
}
