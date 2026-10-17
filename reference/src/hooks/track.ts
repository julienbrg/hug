// UserPromptSubmit hook. Only the maintainer types prompts, so this is where
// a track starts: `Start track #<n>` records tracking issue n and its open
// sub-issues, and `Stop track` ends it.

import { readFileSync } from "node:fs";
import { run } from "../lib/git.ts";
import * as track from "../lib/track.ts";

function say(message: string) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: message,
      },
    }),
  );
}

const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
const cwd: string = payload.cwd ?? process.cwd();
const prompt = String(payload.prompt ?? "").trim();
const start = /^start track #?(\d+)$/i.exec(prompt);

if (start && track.file(cwd)) {
  const tracking = Number(start[1]);
  const result = run(
    "gh",
    [
      "api",
      "--paginate",
      `repos/{owner}/{repo}/issues/${tracking}/sub_issues`,
      "--jq",
      '.[] | select(.state == "open") | .number',
    ],
    cwd,
  );
  const issues = result.stdout.split(/\s+/).filter(Boolean).map(Number);
  if (!result.ok || !issues.length) {
    say(
      `HuG Flow: track #${tracking} not started: ${result.ok ? "it has no open sub-issues" : result.stderr.trim()}.`,
    );
  } else {
    track.write(cwd, { tracking, issues });
    say(
      `HuG Flow: track #${tracking} confirmed for ${issues.map((n) => `#${n}`).join(", ")}. On their branches, the agent stages its own work.`,
    );
  }
} else if (/^stop track$/i.test(prompt) && track.read(cwd)) {
  track.remove(cwd);
  say("HuG Flow: track ended. The maintainer stages every chunk again.");
}
