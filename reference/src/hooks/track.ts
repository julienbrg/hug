// UserPromptSubmit hook. Only the maintainer types prompts, so this is where
// a track starts: `Start track #<n>` records tracking issue n and its open
// sub-issues, and `Stop track` ends it. Both always answer, so a confirmation
// is never lost silently.

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
// The agent may have moved the session out of the repository, into a
// scratchpad for instance; the project directory doesn't move.
const here: string = payload.cwd ?? process.cwd();
const project = process.env.CLAUDE_PROJECT_DIR;
const cwd =
  !track.file(here) && project && track.file(project) ? project : here;
const prompt = String(payload.prompt ?? "").trim();
const start = /^start track #?(\d+)$/i.exec(prompt);
const stop = /^stop track$/i.test(prompt);

if ((start || stop) && !track.file(cwd)) {
  say(
    `HuG Flow: ${start ? `track #${start[1]} not started` : "no track to stop"}: ${cwd} is not in a git repository. Take no track action.`,
  );
} else if (start) {
  const tracking = Number(start[1]);
  // An issue has at most 100 sub-issues, so one page holds them all. No --jq
  // filter: on Windows, gh runs through cmd, which would read its | as a pipe.
  const result = run(
    "gh",
    ["api", `repos/{owner}/{repo}/issues/${tracking}/sub_issues?per_page=100`],
    cwd,
  );
  let issues: number[] = [];
  try {
    issues = (JSON.parse(result.stdout) as { number: number; state: string }[])
      .filter((issue) => issue.state === "open")
      .map((issue) => issue.number);
  } catch {}
  if (!result.ok || !issues.length) {
    say(
      `HuG Flow: track #${tracking} not started: ${result.ok ? "it has no open sub-issues" : result.stderr.trim()}. Take no track action.`,
    );
  } else {
    track.write(cwd, { tracking, issues });
    say(
      `HuG Flow: track #${tracking} confirmed for ${issues.map((n) => `#${n}`).join(", ")}. On their branches, the agent stages its own work.`,
    );
  }
} else if (stop) {
  const ended = track.read(cwd);
  track.remove(cwd);
  say(
    ended
      ? "HuG Flow: track ended. The maintainer stages every chunk again."
      : "HuG Flow: no track to stop.",
  );
}
