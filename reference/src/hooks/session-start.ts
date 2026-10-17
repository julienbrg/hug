// SessionStart hook. Loads rules.md into every session, so updating the
// plugin updates the rules the agent follows. A track's confirmation
// outlives the session that started it, so when one is active the session
// also hears about it, with where each recorded issue stands.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { run } from "../lib/git.ts";
import * as track from "../lib/track.ts";

const rules = readFileSync(
  join(import.meta.dirname, "..", "..", "rules.md"),
  "utf8",
);

let payload: { cwd?: string } = {};
try {
  payload = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {}
const here = payload.cwd ?? process.cwd();
const project = process.env.CLAUDE_PROJECT_DIR;
const cwd =
  !track.file(here) && project && track.file(project) ? project : here;

function states(cwd: string, active: track.Track): string[] | null {
  // No --jq filter: on Windows, gh runs through cmd, which would read its |
  // as a pipe.
  const issues = run(
    "gh",
    [
      "api",
      `repos/{owner}/{repo}/issues/${active.tracking}/sub_issues?per_page=100`,
    ],
    cwd,
  );
  const prs = run(
    "gh",
    ["pr", "list", "--state", "open", "--json", "number,headRefName"],
    cwd,
  );
  try {
    const closed = new Set(
      (JSON.parse(issues.stdout) as { number: number; state: string }[])
        .filter((issue) => issue.state === "closed")
        .map((issue) => issue.number),
    );
    const open = JSON.parse(prs.stdout) as {
      number: number;
      headRefName: string;
    }[];
    return active.issues.map((n) => {
      if (closed.has(n)) return `#${n}: closed`;
      const pr = open.find((p) => p.headRefName.startsWith(`${n}-`));
      return pr
        ? `#${n}: pull request #${pr.number} open`
        : `#${n}: not started`;
    });
  } catch {
    return null;
  }
}

let context = rules;
const active = track.read(cwd);
if (active) {
  const lines = states(cwd, active);
  context += `\n## Active track\n\nHuG Flow: track #${active.tracking} is active, confirmed in an earlier session. Resume it as the Tracks rules say. ${
    lines
      ? `Its recorded issues:\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`
      : `Its recorded issues: ${active.issues.map((n) => `#${n}`).join(", ")}; their states are unknown, as gh failed.\n`
  }`;
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  }),
);
