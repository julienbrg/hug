// The plugin wiring: every hook in hooks.json exists, and the rules reach
// the session with the conformance declaration the spec requires (§10).

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { hook } from "./helpers.ts";

const plugin = join(import.meta.dirname, "..", "reference");

test("every hook command points to a file in the plugin", () => {
  const { hooks } = JSON.parse(
    readFileSync(join(plugin, "hooks", "hooks.json"), "utf8"),
  );
  const commands: string[] = Object.values(hooks).flatMap((groups) =>
    (groups as { hooks: { command: string }[] }[]).flatMap((g) =>
      g.hooks.map((h) => h.command),
    ),
  );
  assert.ok(commands.length >= 5);
  for (const command of commands) {
    const path = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)/.exec(command)?.[1];
    assert.ok(path && existsSync(join(plugin, path)), command);
  }
});

test("the session starts with the rules and the declared level", () => {
  const outcome = hook("session-start", { hook_event_name: "SessionStart" });
  const context = JSON.parse(outcome.stdout).hookSpecificOutput;
  assert.equal(context.hookEventName, "SessionStart");
  assert.match(context.additionalContext, /implements: hug-flow@0\.2\.0/);
  assert.match(context.additionalContext, /level: L2/);
});
