// Publishes article/<slug>.md to julienberanger.com through blog-mcp, then
// waits until the live /raw page matches the file.
//   MCP_BEARER_TOKEN=... node scripts/publish-post.mjs [article/hug-flow.md]

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const MCP_URL = "https://blog.mcp.w3hc.org/mcp";
const SITE_URL = "https://julienberanger.com";

const file = process.argv[2] ?? "article/hug-flow.md";
const slug = basename(file, ".md");
const token = process.env.MCP_BEARER_TOKEN;
if (!token) throw new Error("MCP_BEARER_TOKEN is not set");

const raw = readFileSync(file, "utf8");
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

const live = await callTool("posts_latest", { prefix: slug });
const existing = live?.slug === slug ? live : {};

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

for (let attempt = 1; attempt <= 9; attempt++) {
  const res = await fetch(`${SITE_URL}/${slug}/raw`, { cache: "no-store" });
  if (res.ok && (await res.text()) === raw) {
    console.log(`${SITE_URL}/${slug} matches ${file}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 10_000));
}
throw new Error(`${SITE_URL}/${slug}/raw still differs from ${file} after 90s`);
