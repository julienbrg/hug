// L2 scenarios for the Stop hook: a turn cannot end while the maintainer has
// staged the agent's work and it is still uncommitted.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { git, hook, repo } from "./helpers.ts";

function stop(cwd: string, active = false) {
  const outcome = hook("stop", {
    hook_event_name: "Stop",
    stop_hook_active: active,
    cwd,
  });
  assert.equal(outcome.code, 0, outcome.stderr);
  return outcome.stdout ? JSON.parse(outcome.stdout) : null;
}

function setup() {
  const cwd = repo();
  writeFileSync(join(cwd, "agent.ts"), "agent\n");
  writeFileSync(join(cwd, "mine.ts"), "maintainer\n");
  const dir = join(git(cwd, "rev-parse", "--absolute-git-dir"), "hug");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ledger.json"), JSON.stringify(["agent.ts"]));
  return cwd;
}

test("an empty index lets the turn end", () => {
  assert.equal(stop(setup()), null);
});

test("the agent's staged work holds the turn until it is committed", () => {
  const cwd = setup();
  git(cwd, "add", "agent.ts");
  const verdict = stop(cwd);
  assert.equal(verdict.decision, "block");
  assert.match(verdict.reason, /agent\.ts/);
  git(cwd, "commit", "--quiet", "-m", "add agent");
  assert.equal(stop(cwd), null);
});

test("a staged chunk the agent did not write is the maintainer's to commit", () => {
  const cwd = setup();
  git(cwd, "add", "mine.ts");
  assert.equal(stop(cwd), null);
});

test("a second block on the same staged tree ends the turn and tells the maintainer", () => {
  const cwd = setup();
  git(cwd, "add", "agent.ts");
  assert.equal(stop(cwd).decision, "block");
  const verdict = stop(cwd, true);
  assert.equal(verdict.decision, undefined);
  assert.match(verdict.systemMessage, /did not commit/);
});

test("a changed staged tree blocks again", () => {
  const cwd = setup();
  git(cwd, "add", "agent.ts");
  assert.equal(stop(cwd).decision, "block");
  writeFileSync(join(cwd, "agent.ts"), "agent, edited\n");
  git(cwd, "add", "agent.ts");
  assert.equal(stop(cwd, true).decision, "block");
});

test("outside a repository the turn ends", () => {
  assert.equal(stop(mkdtempSync(join(tmpdir(), "hug-"))), null);
});
