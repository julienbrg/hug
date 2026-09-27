// hug audit <owner/repo>: checks the invariants that can be checked after the
// fact (§10) over the default branch's recent history, and prints a pass or
// fail per invariant. I2 and I6 are verified procedurally, never from
// history, so the report says so instead of claiming them.

import { run } from "../lib/git.ts";

export interface Check {
  name: string;
  conclusion: string | null;
}

export interface AuditCommit {
  sha: string;
  message: string;
  author: string | null;
  parents: number;
  // The merged pull request this commit is the squash commit of.
  pr: { number: number; checks: Check[] } | null;
  checks: Check[];
}

export interface Verdict {
  invariant: string;
  predicate: string;
  failures: string[];
}

const GREEN = new Set(["success", "skipped", "neutral"]);
const ATTRIBUTION = [
  /^\s*co-authored-by\s*:/im,
  /generated (with|by) \[?(claude|codex|copilot|cursor|gemini|chatgpt|an? ai)/i,
  /🤖/u,
];

function green(checks: Check[]): boolean {
  return (
    checks.length > 0 && checks.every((c) => GREEN.has(c.conclusion ?? ""))
  );
}

function red(checks: Check[]): string[] {
  return checks
    .filter((c) => !GREEN.has(c.conclusion ?? ""))
    .map((c) => `${c.name} ${c.conclusion ?? "pending"}`);
}

export function evaluate(
  commits: AuditCommit[],
  maintainer: string,
): Verdict[] {
  const short = (c: AuditCommit) =>
    `${c.sha.slice(0, 7)} ${c.message.split("\n")[0]}`;
  const i1: string[] = [];
  const i3: string[] = [];
  const i4: string[] = [];
  const i5: string[] = [];
  for (const commit of commits) {
    const failing = red(commit.checks);
    if (failing.length) i1.push(`${short(commit)}: ${failing.join(", ")}`);
    else if (!commit.checks.length && !(commit.pr && green(commit.pr.checks))) {
      i1.push(`${short(commit)}: no check ran on it or its pull request`);
    }
    if (!commit.pr) {
      i4.push(
        `${short(commit)}: not the squash commit of a merged pull request`,
      );
    } else if (!green(commit.pr.checks)) {
      const why = commit.pr.checks.length
        ? red(commit.pr.checks).join(", ")
        : "no check ran";
      i3.push(`${short(commit)}: #${commit.pr.number} ${why}`);
    }
    if (commit.parents > 1) i4.push(`${short(commit)}: a merge commit`);
    if (ATTRIBUTION.some((p) => p.test(commit.message))) {
      i5.push(`${short(commit)}: attribution line in the message`);
    }
    if (commit.author !== maintainer) {
      i5.push(
        `${short(commit)}: authored by ${commit.author ?? "an unknown user"}`,
      );
    }
  }
  return [
    {
      invariant: "I1",
      predicate: "every commit on main passes the checks",
      failures: i1,
    },
    {
      invariant: "I3",
      predicate: "every squash commit's pull request was green",
      failures: i3,
    },
    {
      invariant: "I4",
      predicate: "every commit is the squash commit of a merged pull request",
      failures: i4,
    },
    {
      invariant: "I5",
      predicate: `no attribution, and ${maintainer} authored every commit`,
      failures: i5,
    },
  ];
}

function gh(args: string[]): any {
  const result = run("gh", args, process.cwd());
  if (!result.ok) {
    throw new Error(`gh ${args.join(" ")}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

function checks(repo: string, sha: string): Check[] {
  const { check_runs } = gh([
    "api",
    `repos/${repo}/commits/${sha}/check-runs?per_page=100`,
  ]);
  return check_runs.map((c: Check) => ({
    name: c.name,
    conclusion: c.conclusion,
  }));
}

function collect(repo: string, limit: number, since?: string): AuditCommit[] {
  const { default_branch } = gh(["api", `repos/${repo}`]);
  const list = gh([
    "api",
    `repos/${repo}/commits?sha=${default_branch}&per_page=${limit}`,
  ]);
  const commits: AuditCommit[] = [];
  for (const c of list) {
    if (since && c.sha.startsWith(since)) break;
    const pulls = gh(["api", `repos/${repo}/commits/${c.sha}/pulls`]);
    const pull = pulls.find(
      (p: { merge_commit_sha: string; merged_at: string | null }) =>
        p.merged_at && p.merge_commit_sha === c.sha,
    );
    commits.push({
      sha: c.sha,
      message: c.commit.message,
      author: c.author?.login ?? null,
      parents: c.parents.length,
      pr: pull
        ? { number: pull.number, checks: checks(repo, pull.head.sha) }
        : null,
      checks: checks(repo, c.sha),
    });
  }
  return commits;
}

export function audit(args: string[]): number {
  let repo: string | undefined;
  let limit = 30;
  let since: string | undefined;
  let maintainer: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--limit") limit = Number(args[++i]);
    else if (arg === "--since") since = args[++i];
    else if (arg === "--maintainer") maintainer = args[++i];
    else if (!arg.startsWith("-")) repo = arg;
  }
  if (
    !repo ||
    !/^[\w.-]+\/[\w.-]+$/.test(repo) ||
    !(limit > 0 && limit <= 100)
  ) {
    console.error(
      "usage: hug audit <owner/repo> [--limit 1-100] [--since <sha>] [--maintainer <login>]",
    );
    return 2;
  }
  maintainer ??= repo.split("/")[0];
  const commits = collect(repo, limit, since);
  const verdicts = evaluate(commits, maintainer);
  console.log(`${repo}: ${commits.length} commits on the default branch\n`);
  for (const v of verdicts) {
    console.log(
      `${v.failures.length ? "FAIL" : "PASS"} ${v.invariant}  ${v.predicate}`,
    );
    for (const f of v.failures) console.log(`       ${f}`);
  }
  console.log(
    "\n  -  I2  verified procedurally by the ledger and the guard, not from history",
  );
  console.log("  -  I6  verified procedurally, not from history");
  return verdicts.some((v) => v.failures.length) ? 1 : 0;
}
