import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative, dirname, sep } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dir, "..");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const readme = await readFile(resolve(root, "README.md"), "utf8");
const skills = await readdir(resolve(root, "skills"));
const errors: string[] = [];
function fail(file: string, message: string) { errors.push(`${relative(root, file)}: ${message}`); }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]))).flat();
}
for (const name of skills) {
  const dir = resolve(root, "skills", name), main = resolve(dir, "SKILL.md");
  const text = await readFile(main, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) { fail(main, "missing YAML frontmatter"); continue; }
  const meta = parse(match[1]!);
  if (meta.name !== name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) fail(main, "name must match directory and Agent Skills syntax");
  if (typeof meta.description !== "string" || !meta.description.trim() || meta.description.length > 180) fail(main, "description must be 1–180 characters");
  if (meta.license !== "MIT" || typeof meta.compatibility !== "string") fail(main, "license and runtime compatibility required");
  if (!meta.metadata || Object.values(meta.metadata).some(v => typeof v !== "string")) fail(main, "metadata values must be strings");
  if (text.split("\n").length > 500) fail(main, "move detail to references; body exceeds 500 lines");
  if (!readme.includes(`(skills/${name}/SKILL.md)`)) fail(main, "missing README catalog entry");
  for (const file of await walk(dir)) {
    const content = await readFile(file, "utf8");
    if (file.endsWith(".md")) {
      for (const link of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = link[1]!;
        if (/^https?:\/\//.test(target) || target.startsWith("#")) continue;
        const path = resolve(dirname(file), target.split("#")[0]!);
        if (!path.startsWith(dir + sep)) { fail(file, `link escapes installed skill: ${target}`); continue; }
        try { if (!(await stat(path)).isFile()) fail(file, `link is not a file: ${target}`); }
        catch { fail(file, `missing linked file: ${target}`); }
      }
    }
    if (file.endsWith(".ts")) {
      for (const imported of content.matchAll(/from ["']([^"']+)["']/g)) {
        const spec = imported[1]!;
        if (spec.startsWith(".")) {
          if (!resolve(dirname(file), spec).startsWith(dir + sep)) fail(file, `import escapes installed skill: ${spec}`);
        } else {
          const packageName = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;
          if (!pkg.devDependencies[packageName]) fail(file, `unverified dependency: ${packageName}`);
        }
      }
    }
  }
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(`Validated ${skills.length} standalone skills: metadata, budgets, local links, imports, catalog`);
