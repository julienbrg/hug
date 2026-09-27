// hug init <owner/repo>: the L3 half of the implementation. Sets the
// repository to squash-only merges that delete their branch, and creates or
// updates the `hug-flow` ruleset on the default branch: pull request
// required, required checks green, no force-push, no deletion, no bypass.

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../lib/git.ts";

const template = join(
  import.meta.dirname,
  "..",
  "..",
  "github",
  "ruleset.json",
);

export interface CheckRun {
  name: string;
  conclusion: string | null;
}

// The checks to require: those that passed on a pull request. Checks that
// only run on `main` would never report on a pull request and block it.
export function requiredChecks(runs: CheckRun[]): string[] {
  const green = runs.filter((r) => r.conclusion === "success");
  return [...new Set(green.map((r) => r.name))].sort();
}

export function ruleset(checks: string[]) {
  const body = JSON.parse(readFileSync(template, "utf8"));
  for (const rule of body.rules) {
    if (rule.type === "required_status_checks") {
      rule.parameters.required_status_checks = checks.map((context) => ({
        context,
      }));
    }
  }
  return body;
}

function gh(args: string[]): string {
  const result = run("gh", args, process.cwd());
  if (!result.ok) {
    throw new Error(`gh ${args.join(" ")}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function detect(repo: string): string[] {
  const [pr] = JSON.parse(
    gh([
      "pr",
      "list",
      "--repo",
      repo,
      "--state",
      "merged",
      "--limit",
      "1",
      "--json",
      "headRefOid",
    ]),
  );
  if (!pr) return [];
  const { check_runs } = JSON.parse(
    gh([
      "api",
      `repos/${repo}/commits/${pr.headRefOid}/check-runs?per_page=100`,
    ]),
  );
  return requiredChecks(check_runs);
}

export function init(args: string[]): number {
  let repo: string | undefined;
  let checks: string[] | undefined;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--checks" || arg.startsWith("--checks=")) {
      const list = arg === "--checks" ? args[++i] : arg.slice(9);
      checks = (list ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    } else if (!arg.startsWith("-")) repo = arg;
  }
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    console.error(
      "usage: hug init <owner/repo> [--checks <name,...>] [--dry-run]",
    );
    return 2;
  }
  checks ??= detect(repo);
  if (!checks.length) {
    console.error(
      "no green check found on the last merged pull request; pass --checks <name,...>",
    );
    return 1;
  }

  const body = ruleset(checks);
  const settings = [
    [
      "repo",
      "edit",
      repo,
      "--enable-merge-commit=false",
      "--enable-rebase-merge=false",
      "--enable-squash-merge",
      "--delete-branch-on-merge",
    ],
    [
      "api",
      "-X",
      "PATCH",
      `repos/${repo}`,
      "-f",
      "squash_merge_commit_title=PR_TITLE",
      "-f",
      "squash_merge_commit_message=COMMIT_MESSAGES",
    ],
  ];
  if (dryRun) {
    for (const args of settings) console.log(`gh ${args.join(" ")}`);
    console.log(JSON.stringify(body, null, 2));
    return 0;
  }

  for (const args of settings) gh(args);
  console.log(`${repo}: squash merges only, merged branches deleted`);

  const existing = (
    JSON.parse(gh(["api", `repos/${repo}/rulesets`])) as {
      id: number;
      name: string;
      source_type: string;
    }[]
  ).find((r) => r.name === body.name && r.source_type === "Repository");
  const file = join(mkdtempSync(join(tmpdir(), "hug-")), "ruleset.json");
  writeFileSync(file, JSON.stringify(body));
  const result = run(
    "gh",
    existing
      ? [
          "api",
          "-X",
          "PUT",
          `repos/${repo}/rulesets/${existing.id}`,
          "--input",
          file,
        ]
      : ["api", "-X", "POST", `repos/${repo}/rulesets`, "--input", file],
    process.cwd(),
  );
  if (!result.ok) {
    if (/upgrade|not available|HTTP 403/i.test(result.stderr)) {
      console.warn(
        `${repo}: rulesets are not available on this plan, so the repository stays at L2: ${result.stderr.trim()}`,
      );
      return 0;
    }
    throw new Error(
      `the ruleset could not be applied: ${result.stderr.trim()}`,
    );
  }
  console.log(
    `${repo}: ruleset ${body.name} ${existing ? "updated" : "created"}, requiring ${checks.join(", ")}`,
  );
  return 0;
}
