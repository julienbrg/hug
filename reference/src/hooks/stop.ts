// Stop hook. Refuses to end the turn while the maintainer has staged some of
// the agent's work and it sits uncommitted, the P3 rule most often dropped.
// A staged chunk the agent did not write is the maintainer's to commit, so it
// does not hold the turn. If the agent is blocked twice on the same staged
// tree, the turn ends and the maintainer is told instead, to avoid a loop.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { git, gitDir } from "../lib/git.ts";
import * as ledger from "../lib/ledger.ts";

const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
const cwd: string = payload.cwd ?? process.cwd();
const repo = ledger.repo(cwd);
const dir = gitDir(cwd);
const staged = repo
  ? git(["diff", "--cached", "--name-only", "-z"], repo.top)
  : null;

if (repo && dir && staged) {
  const written = ledger.read(repo);
  const agents = staged
    .split("\0")
    .filter(
      (path) => path && written.has(ledger.key(repo, join(repo.top, path))),
    );
  if (agents.length) {
    const tree = git(["write-tree"], repo.top);
    const state = join(dir, "hug", "stop.json");
    let last: string | null = null;
    try {
      last = JSON.parse(readFileSync(state, "utf8")).tree;
    } catch {}
    const message = `Staged and uncommitted: ${agents.join(", ")}.`;
    if (payload.stop_hook_active && tree === last) {
      process.stdout.write(
        JSON.stringify({
          systemMessage: `HuG Flow: ${message} The agent did not commit it; check the pipeline output above.`,
        }),
      );
    } else {
      mkdirSync(dirname(state), { recursive: true });
      writeFileSync(state, JSON.stringify({ tree }));
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `HuG Flow: ${message} Run the check pipeline on the staged content and commit exactly what is staged, or unstage it and report the failure, before ending the turn.`,
        }),
      );
    }
  }
}
