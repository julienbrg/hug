// Compares article/<slug>.md with the live post on julienberanger.com and, if
// they differ, publishes the file through blog-mcp, then waits until the live
// /raw page matches it. --dry-run only prints the difference.
//   MCP_BEARER_TOKEN=... node scripts/publish-post.mjs [--dry-run] [article/hug-flow.md]

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const MCP_URL = "https://blog.mcp.w3hc.org/mcp";
const SITE_URL = "https://julienberanger.com";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--")) ?? "article/hug-flow.md";
const slug = basename(file, ".md");
const rawUrl = `${SITE_URL}/${slug}/raw`;

const raw = readFileSync(file, "utf8");

async function fetchLive() {
  const res = await fetch(rawUrl, { cache: "no-store" });
  if (res.status === 404) return "";
  if (!res.ok) throw new Error(`${rawUrl}: HTTP ${res.status}`);
  return res.text();
}

const live = await fetchLive();
if (live === raw) {
  console.log(`${SITE_URL}/${slug} is up to date`);
  process.exit(0);
}

const liveFile = join(mkdtempSync(join(tmpdir(), "post-")), "live.md");
writeFileSync(liveFile, live);
spawnSync("diff", ["-u", liveFile, file], { stdio: "inherit" });

if (dryRun) {
  console.log(
    `dry run: merging to main will publish this to ${SITE_URL}/${slug}`,
  );
  process.exit(0);
}

const token = process.env.MCP_BEARER_TOKEN;
if (!token) throw new Error("MCP_BEARER_TOKEN is not set");

const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!match) throw new Error(`${file} has no frontmatter`);

const data = {};
for (const line of match[1].split("\n")) {
  const i = line.indexOf(": ");
  if (i === -1) continue;
  data[line.slice(0, i)] = line.slice(i + 2).replace(/^(['"])(.*)\1$/, "$2");
}

// /raw rebuilds the H1 from `title`, so the stored content starts after it.
const content = match[2].replace(/^\n# .*\n/, "");

let id = 0;
async function callTool(name, args) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  if (!res.ok)
    throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);

  const text = await res.text();
  const payload = res.headers.get("content-type")?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("")
    : text;
  const { result, error } = JSON.parse(payload);
  if (error) throw new Error(`${name}: ${error.message}`);
  const out = result.content?.[0]?.text ?? "";
  if (result.isError) throw new Error(`${name}: ${out}`);
  return out ? JSON.parse(out) : null;
}

const stored = await callTool("posts_latest", { prefix: slug });
const existing = stored?.slug === slug ? stored : {};

const post = {
  slug,
  title: data.title,
  content,
  description: data.description,
  date: data.date,
  locale: data.lang?.replace("-", "_") ?? existing.locale,
  author: data.author,
  model: data.model,
  conversation: data.conversation,
  image: data.image ?? existing.image,
  image_alt: data.image_alt ?? existing.image_alt,
  unlisted: data.unlisted
    ? data.unlisted === "true"
    : (existing.unlisted ?? false),
};
for (const key of Object.keys(post)) if (post[key] == null) delete post[key];

await callTool("posts_upsert", post);
console.log(`upserted "${slug}"`);

// The site's cache can take a couple of minutes to serve the new version.
const started = Date.now();
while (Date.now() - started < 300_000) {
  await new Promise((r) => setTimeout(r, 15_000));
  if ((await fetchLive()) === raw) {
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`${SITE_URL}/${slug} matches ${file} after ${seconds}s`);
    process.exit(0);
  }
}
throw new Error(`${rawUrl} still differs from ${file} after 5 minutes`);
