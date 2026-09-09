import { resolve } from "node:path";
const pkg = await Bun.file(resolve(import.meta.dir, "../package.json")).json();
const baseline: Record<string, string> = Object.fromEntries(
  Object.entries<string>(pkg.devDependencies).filter(([name]) => name.startsWith("@zkp2p/")),
);
baseline["@zkp2p/providers"] = "7.9.2";
let changed = 0;
for (const [name, version] of Object.entries(baseline)) {
  const response = await fetch(`https://registry.npmjs.org/${name}/latest`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${name}: registry HTTP ${response.status}`);
  const current = await response.json() as { version: string };
  console.log(`${name}: verified ${version}, latest ${current.version}`);
  if (current.version !== version) changed++;
}
if (changed) throw new Error(`${changed} package baselines changed; review examples and protocol behavior before updating`);
