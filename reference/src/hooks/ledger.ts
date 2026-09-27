// Records the paths the agent writes, for the guard to refuse staging them.
// - PostToolUse on Edit, Write, MultiEdit and NotebookEdit: the file path.
// - PreToolUse on Bash: a snapshot of the dirty files and their hashes.
// - PostToolUse on Bash: every file that became dirty or changed since.
// Each update also drops the paths that match HEAD again, once committed.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { run } from "../lib/git.ts";
import * as ledger from "../lib/ledger.ts";

// Maps each dirty path's ledger key to the hash of its working-tree content.
function dirty(repo: ledger.Repo): Map<string, string> {
  // Not trimmed: the first entry can start with a space.
  const status = run(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    repo.top,
  ).stdout;
  const paths: string[] = [];
  const entries = status.split("\0");
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    paths.push(entry.slice(3));
    if (/[RC]/.test(entry.slice(0, 2))) paths.push(entries[++i]);
  }
  const hashes = spawnSync("git", ["hash-object", "--stdin-paths"], {
    cwd: repo.top,
    input: paths.map((p) => join(repo.top, p)).join("\n"),
    encoding: "utf8",
  });
  const list = hashes.status === 0 ? hashes.stdout.trim().split("\n") : [];
  const map = new Map<string, string>();
  paths.forEach((path, i) => {
    map.set(ledger.key(repo, join(repo.top, path)), list[i] ?? "gone");
  });
  return map;
}

const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
const cwd: string = payload.cwd ?? process.cwd();
const repo = ledger.repo(cwd);

if (repo) {
  const snapshot = join(dirname(repo.file), "snapshot.json");
  if (
    payload.tool_name === "Bash" &&
    payload.hook_event_name === "PreToolUse"
  ) {
    mkdirSync(dirname(snapshot), { recursive: true });
    writeFileSync(snapshot, JSON.stringify(Object.fromEntries(dirty(repo))));
  } else {
    const written = ledger.read(repo);
    const now = dirty(repo);
    if (payload.tool_name === "Bash") {
      let before: Record<string, string> = {};
      try {
        before = JSON.parse(readFileSync(snapshot, "utf8"));
      } catch {}
      for (const [path, hash] of now) {
        if (before[path] !== hash) written.add(path);
      }
      rmSync(snapshot, { force: true });
    } else {
      const input = payload.tool_input ?? {};
      const file = input.file_path ?? input.notebook_path;
      if (typeof file === "string") {
        const key = ledger.key(repo, resolve(cwd, file));
        if (!key.startsWith("..")) written.add(key);
      }
    }
    for (const path of written) {
      if (!now.has(path)) written.delete(path);
    }
    ledger.write(repo, written);
  }
}
