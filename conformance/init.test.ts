// hug init: the ruleset it applies is what L3 requires (§10).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { requiredChecks, ruleset } from "../reference/src/cli/init.ts";

const cli = join(
  import.meta.dirname,
  "..",
  "reference",
  "src",
  "cli",
  "hug.ts",
);

test("the required checks are the ones that passed on a pull request", () => {
  assert.deepEqual(
    requiredChecks([
      { name: "test", conclusion: "success" },
      { name: "test", conclusion: "success" },
      { name: "lint", conclusion: "success" },
      { name: "deploy", conclusion: "skipped" },
      { name: "flaky", conclusion: "failure" },
    ]),
    ["lint", "test"],
  );
});

test("the ruleset requires a pull request, green checks and squash merges", () => {
  const body = ruleset(["test"]);
  const rule = (type: string) =>
    body.rules.find((r: { type: string }) => r.type === type);
  assert.equal(body.enforcement, "active");
  assert.deepEqual(body.conditions.ref_name.include, ["~DEFAULT_BRANCH"]);
  assert.deepEqual(body.bypass_actors, []);
  assert.ok(rule("deletion"));
  assert.ok(rule("non_fast_forward"));
  assert.deepEqual(rule("pull_request").parameters.allowed_merge_methods, [
    "squash",
  ]);
  assert.deepEqual(
    rule("required_status_checks").parameters.required_status_checks,
    [{ context: "test" }],
  );
});

test("a dry run prints the plan without calling gh", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "init", "o/r", "--checks", "check,post", "--dry-run"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${join(import.meta.dirname, "stubs")}${delimiter}${process.env.PATH}`,
        HUG_STUB_CHECKS: "error",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /gh repo edit o\/r .*--enable-squash-merge/);
  assert.match(result.stdout, /"context": "post"/);
});

test("a malformed repository is refused", () => {
  const result = spawnSync(process.execPath, [cli, "init", "not a repo"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
});
