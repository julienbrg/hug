// hug audit: each after-the-fact predicate of §10 passes on a conforming
// history and fails on the commit that breaks it.

import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate } from "../reference/src/cli/audit.ts";
import type { AuditCommit } from "../reference/src/cli/audit.ts";

const pass = [{ name: "check", conclusion: "success" }];

function commit(overrides: Partial<AuditCommit> = {}): AuditCommit {
  return {
    sha: "a".repeat(40),
    message: "Add parser (#3)\n\n* add parser",
    author: "maintainer",
    parents: 1,
    pr: { number: 3, checks: pass },
    checks: pass,
    ...overrides,
  };
}

function failures(commits: AuditCommit[]) {
  return Object.fromEntries(
    evaluate(commits, "maintainer").map((v) => [
      v.invariant,
      v.failures.length,
    ]),
  );
}

test("a conforming history passes every predicate", () => {
  assert.deepEqual(failures([commit(), commit({ checks: [] })]), {
    I1: 0,
    I3: 0,
    I4: 0,
    I5: 0,
  });
});

test("I1: a red check on main fails", () => {
  const red = [{ name: "check", conclusion: "failure" }];
  assert.equal(failures([commit({ checks: red })]).I1, 1);
  assert.equal(failures([commit({ checks: [], pr: null })]).I1, 1);
});

test("I3: a pull request merged on red, pending or no checks fails", () => {
  for (const checks of [
    [{ name: "check", conclusion: "failure" }],
    [{ name: "check", conclusion: null }],
    [],
  ]) {
    assert.equal(failures([commit({ pr: { number: 3, checks } })]).I3, 1);
  }
});

test("I4: a direct push or a merge commit fails", () => {
  assert.equal(failures([commit({ pr: null })]).I4, 1);
  assert.equal(failures([commit({ parents: 2 })]).I4, 1);
});

test("I5: attribution or another author fails", () => {
  const trailer =
    "Add x (#4)\n\nCo-Authored-By: Claude <noreply@anthropic.com>";
  assert.equal(failures([commit({ message: trailer })]).I5, 1);
  assert.equal(failures([commit({ author: "someone" })]).I5, 1);
});
