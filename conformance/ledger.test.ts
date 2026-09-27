// L2 scenarios for the ledger: whatever the agent writes, through Edit, Write
// or Bash, it cannot stage, while the maintainer's chunks stay stageable.

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { bash, git, hook, repo } from "./helpers.ts";

function write(cwd: string, path: string, content: string) {
  writeFileSync(join(cwd, path), content);
  const outcome = hook("ledger", {
    hook_event_name: "PostToolUse",
    tool_name: "Write",
    tool_input: { file_path: join(cwd, path), content },
    cwd,
  });
  assert.equal(outcome.code, 0, outcome.stderr);
}

function run(cwd: string, command: string, effect: () => void) {
  const payload = { tool_name: "Bash", tool_input: { command }, cwd };
  hook("ledger", { ...payload, hook_event_name: "PreToolUse" });
  effect();
  hook("ledger", { ...payload, hook_event_name: "PostToolUse" });
}

test("the agent writes a file, then tries to stage it: blocked", () => {
  const cwd = repo();
  write(cwd, "a.ts", "agent\n");
  assert.equal(bash(cwd, "git add a.ts").code, 2);
});

test("the maintainer writes a file, then the agent stages it: allowed", () => {
  const cwd = repo();
  writeFileSync(join(cwd, "b.ts"), "maintainer\n");
  write(cwd, "a.ts", "agent\n");
  assert.equal(bash(cwd, "git add b.ts").code, 0);
});

test("files written through Bash are recorded", () => {
  const cwd = repo();
  writeFileSync(join(cwd, "b.ts"), "maintainer\n");
  run(cwd, "echo agent > c.ts && sed -i s/x/y/ b.ts", () => {
    writeFileSync(join(cwd, "c.ts"), "agent\n");
  });
  assert.equal(bash(cwd, "git add c.ts").code, 2);
  assert.equal(bash(cwd, "git add b.ts").code, 0);
  run(cwd, "sed -i s/maintainer/agent/ b.ts", () => {
    writeFileSync(join(cwd, "b.ts"), "agent\n");
  });
  assert.equal(bash(cwd, "git add b.ts").code, 2);
});

test("tracked files changed through Bash are recorded", () => {
  const cwd = repo();
  writeFileSync(join(cwd, "t.ts"), "maintainer\n");
  git(cwd, "add", "t.ts");
  git(cwd, "commit", "--quiet", "-m", "add t");
  run(cwd, "sed -i s/maintainer/agent/ t.ts", () => {
    writeFileSync(join(cwd, "t.ts"), "agent\n");
  });
  assert.equal(bash(cwd, "git add t.ts").code, 2);
});

test("a path leaves the ledger once it is committed", () => {
  const cwd = repo();
  write(cwd, "a.ts", "agent\n");
  git(cwd, "add", "a.ts");
  run(cwd, "git commit -m 'add a'", () => {
    git(cwd, "commit", "--quiet", "-m", "add a");
  });
  writeFileSync(join(cwd, "a.ts"), "maintainer\n");
  assert.equal(bash(cwd, "git add a.ts").code, 0);
});

test("files outside the repository are ignored", () => {
  const cwd = repo();
  write(cwd, "../outside.ts", "agent\n");
  const file = join(
    git(cwd, "rev-parse", "--absolute-git-dir"),
    "hug",
    "ledger.json",
  );
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), []);
});
