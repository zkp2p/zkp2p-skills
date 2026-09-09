import { Glob } from "bun";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const urls = new Set<string>();
const files = ["README.md", ...await Array.fromAsync(new Glob("skills/**/*.md").scan({ cwd: root }))];
for (const file of files) {
  const text = await Bun.file(resolve(root, file)).text();
  for (const match of text.matchAll(/\[[^\]]*\]\((https:\/\/[^)]+)\)/g)) urls.add(match[1]!);
}
if (urls.size === 0) throw new Error("No source links discovered");
let failures = 0;
for (const url of [...urls].sort()) {
  // npm's HTML pages block automated clients; verify the owning registry record instead.
  const npm = url.match(/^https:\/\/www\.npmjs\.com\/package\/(.+)$/);
  const target = npm ? `https://registry.npmjs.org/${npm[1]}/latest` : url;
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "peer-skills-link-check" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (npm) {
      const record = await response.json() as { name: string };
      if (record.name !== npm[1]) throw new Error("registry returned a different package");
    } else {
      const body = await response.text();
      if (/<title>[^<]*(?:404|Page Not Found)/i.test(body)) throw new Error("soft 404 page");
    }
    console.log(`OK ${url}${npm ? " (registry)" : ""}`);
  } catch (error) { failures++; console.error(`FAIL ${url}: ${error instanceof Error ? error.message : String(error)}`); }
}
if (failures) throw new Error(`${failures} source links could not be verified`);
console.log(`Verified ${urls.size} public source links`);
