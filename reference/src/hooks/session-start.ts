// SessionStart hook. Loads rules.md into every session, so updating the
// plugin updates the rules the agent follows.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const rules = readFileSync(
  join(import.meta.dirname, "..", "..", "rules.md"),
  "utf8",
);
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: rules,
    },
  }),
);
