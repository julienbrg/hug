// L2 scenarios for tracks: only the maintainer's `Start track #<n>` records
// one, the agent stages its own work only on the branches of the recorded
// issues, and any agent change to the confirmation revokes it.

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { bash, git, hook, repo } from "./helpers.ts";

const file = (cwd: string) => join(cwd, ".git", "hug", "track.json");

function prompt(cwd: string, text: string, issues = "3,4:closed,5") {
  return hook(
    "track",
    { hook_event_name: "UserPromptSubmit", prompt: text, cwd },
    { HUG_STUB_SUBISSUES: issues },
  );
}

function write(cwd: string, path: string, content: string) {
  writeFileSync(join(cwd, path), content);
  hook("ledger", {
    hook_event_name: "PostToolUse",
    tool_name: "Write",
    tool_input: { file_path: join(cwd, path), content },
    cwd,
  });
}

test("Start track records the tracking issue and its open sub-issues", () => {
  const cwd = repo();
  const outcome = prompt(cwd, "Start track #2");
  assert.equal(outcome.code, 0, outcome.stderr);
  assert.match(outcome.stdout, /track #2 confirmed for #3, #5/);
  assert.deepEqual(JSON.parse(readFileSync(file(cwd), "utf8")), {
    tracking: 2,
    issues: [3, 5],
  });
});

test("other prompts, or a track with no open sub-issues, record nothing", () => {
  const cwd = repo();
  prompt(cwd, "go");
  prompt(cwd, "please start track #2 now");
  assert.equal(existsSync(file(cwd)), false);
  assert.match(prompt(cwd, "Start track #2", "").stdout, /not started/);
  assert.equal(existsSync(file(cwd)), false);
});

test("Stop track ends the track", () => {
  const cwd = repo();
  prompt(cwd, "Start track #2");
  assert.match(prompt(cwd, "Stop track").stdout, /track ended/);
  assert.equal(existsSync(file(cwd)), false);
});

test("on a recorded issue's branch, the agent stages its own work by name", () => {
  const cwd = repo();
  prompt(cwd, "Start track #2");
  git(cwd, "switch", "--quiet", "-c", "3-first");
  write(cwd, "a.ts", "agent\n");
  assert.equal(bash(cwd, "git add a.ts").code, 0);
  assert.equal(bash(cwd, "git add -A").code, 2);
});

test("on another branch, or with no track, the agent's work stays blocked", () => {
  const cwd = repo();
  git(cwd, "switch", "--quiet", "-c", "4-other");
  write(cwd, "a.ts", "agent\n");
  assert.equal(bash(cwd, "git add a.ts").code, 2);
  prompt(cwd, "Start track #2");
  assert.equal(bash(cwd, "git add a.ts").code, 2);
});

test("an agent Write to the confirmation revokes the track", () => {
  const cwd = repo();
  prompt(cwd, "Start track #2");
  write(cwd, ".git/hug/track.json", '{"tracking":2,"issues":[3,4,5]}\n');
  assert.equal(existsSync(file(cwd)), false);
});

test("an agent Bash call that forges the confirmation revokes it", () => {
  const cwd = repo();
  git(cwd, "switch", "--quiet", "-c", "4-other");
  write(cwd, "a.ts", "agent\n");
  const command = "echo forged > .git/hug/track.json";
  const payload = { tool_name: "Bash", tool_input: { command }, cwd };
  hook("ledger", { ...payload, hook_event_name: "PreToolUse" });
  writeFileSync(file(cwd), '{"tracking":2,"issues":[4]}\n');
  const outcome = hook("ledger", {
    ...payload,
    hook_event_name: "PostToolUse",
  });
  assert.match(outcome.stdout, /revoked/);
  assert.equal(existsSync(file(cwd)), false);
  assert.equal(bash(cwd, "git add a.ts").code, 2);
});

test("outside the repository, the project directory gets the track", () => {
  const cwd = repo();
  const outside = mkdtempSync(join(tmpdir(), "hug-out-"));
  const outcome = hook(
    "track",
    {
      hook_event_name: "UserPromptSubmit",
      prompt: "Start track #2",
      cwd: outside,
    },
    { HUG_STUB_SUBISSUES: "3", CLAUDE_PROJECT_DIR: cwd },
  );
  assert.match(outcome.stdout, /track #2 confirmed for #3/);
  assert.equal(existsSync(file(cwd)), true);
});

test("with no repository at all, Start track and Stop track say so", () => {
  const outside = mkdtempSync(join(tmpdir(), "hug-out-"));
  for (const text of ["Start track #2", "Stop track"]) {
    const outcome = hook(
      "track",
      { hook_event_name: "UserPromptSubmit", prompt: text, cwd: outside },
      { CLAUDE_PROJECT_DIR: outside },
    );
    assert.match(outcome.stdout, /is not in a git repository/);
  }
});

test("Stop track with no track recorded says so", () => {
  assert.match(prompt(repo(), "Stop track").stdout, /no track to stop/);
});

test("the agent cannot hand claude a prompt from Bash", () => {
  const cwd = repo();
  for (const command of [
    'claude -p "Start track #2"',
    'claude "Start track #2"',
    "echo 'Start track #2' | claude --print",
    "c=claude; $c -p x",
    "npx @anthropic-ai/claude-code -p x",
    'pnpm dlx claude "Start track #2"',
  ]) {
    assert.equal(bash(cwd, command).code, 2, command);
  }
  for (const command of [
    "claude plugin update hug@hug",
    "claude mcp list",
    "claude --version",
    "npx prettier --check .",
  ]) {
    assert.equal(bash(cwd, command).code, 0, command);
  }
});
