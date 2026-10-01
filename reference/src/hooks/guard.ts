// PreToolUse hook on Bash. Parses the command and blocks, with exit code 2,
// anything that breaks I2 (unreviewed content), I3 (merge without green CI),
// I4 (push to main, force-push) or I5 (attribution). A hook's exit 2 holds
// under every permission mode, bypassPermissions included.

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  branched,
  currentBranch,
  defaultBranch,
  git,
  reviewed,
  run,
  scratch,
} from "../lib/git.ts";
import * as ledger from "../lib/ledger.ts";
import { mentionsGitOrGh, parse } from "../lib/parse.ts";
import type { Command, Word } from "../lib/parse.ts";

type Verdict = string | null;

const LITERAL =
  "GIT_INDEX_FILE must be a literal path for the guard to tell a private index from the real one";

const ATTRIBUTION = [
  /^\s*co-authored-by\s*:/im,
  /generated (with|by) \[?(claude|codex|copilot|cursor|gemini|chatgpt|an? ai)/i,
  /🤖/u,
];

// Plumbing and porcelain that write commits or the index without staging.
const WRITERS: Record<string, string> = {
  rm: "stages a deletion; delete the file with plain rm and leave it unstaged",
  mv: "stages a rename; move the file with plain mv and leave both paths unstaged",
  "read-tree": "writes the index",
  "commit-tree": "builds a commit outside the index",
  "update-ref": "moves a ref outside the flow",
  "fast-import": "writes commits outside the index",
  am: "commits patches nobody staged",
  revert: "commits content nobody staged; write the revert as a chunk",
  "filter-branch": "rewrites history",
  replace: "rewrites history",
};

function check(line: string, cwd: string): Verdict {
  const parsed = parse(line);
  if (!parsed.ok) {
    return mentionsGitOrGh(line)
      ? `the guard cannot read this command with confidence (${parsed.reason}); rewrite it as plain git or gh commands`
      : null;
  }
  let switched = false;
  for (const command of parsed.commands) {
    const dir = command.cwd === null ? null : resolve(cwd, command.cwd);
    if (switched && command.tool === "git" && command.subcommand === "push") {
      return "the guard checks pushes against the branch checked out now; run the branch switch and the push as separate commands";
    }
    switched ||=
      (command.tool === "git" &&
        ["switch", "checkout"].includes(command.subcommand ?? "")) ||
      (command.tool === "gh" && command.args[0]?.value === "develop");
    const verdict =
      command.tool === "git"
        ? checkGit(command, dir, 0)
        : command.tool === "gh"
          ? checkGh(command, dir ?? cwd)
          : null;
    if (verdict) return verdict;
  }
  return null;
}

function attributed(text: string): boolean {
  return ATTRIBUTION.some((pattern) => pattern.test(text));
}

function checkText(words: Word[], what: string): Verdict {
  for (const word of words) {
    if (word.dynamic)
      return `the ${what} is not static, so it cannot be checked`;
    if (attributed(word.value)) {
      return `the ${what} carries an attribution line; the maintainer is the sole author (I5)`;
    }
  }
  return null;
}

function checkFile(
  path: string,
  stdin: string | null,
  dir: string,
  what: string,
): Verdict {
  let text: string;
  if (path === "-") {
    if (stdin === null) return `the ${what} comes from an unknown stdin`;
    text = stdin;
  } else {
    try {
      text = readFileSync(resolve(dir, path), "utf8");
    } catch {
      return null;
    }
  }
  return attributed(text)
    ? `the ${what} carries an attribution line; the maintainer is the sole author (I5)`
    : null;
}

// Splits arguments into long options, short option letters and operands.
// `values` lists the options that take a value, long or single-letter.
function options(args: Word[], values: string[]) {
  const flags = new Map<string, Word[]>();
  const operands: Word[] = [];
  const add = (name: string, value?: Word) => {
    const list = flags.get(name) ?? [];
    if (value) list.push(value);
    flags.set(name, list);
  };
  for (let i = 0; i < args.length; i++) {
    const v = args[i].value;
    if (v === "--") {
      operands.push(...args.slice(i + 1));
      break;
    }
    if (v.startsWith("--")) {
      const eq = v.indexOf("=");
      const name = eq === -1 ? v : v.slice(0, eq);
      if (eq !== -1) add(name, { ...args[i], value: v.slice(eq + 1) });
      else if (values.includes(name) && i + 1 < args.length)
        add(name, args[++i]);
      else add(name);
    } else if (v.startsWith("-") && v.length > 1) {
      for (let j = 1; j < v.length; j++) {
        const name = `-${v[j]}`;
        if (!values.includes(name)) {
          add(name);
          continue;
        }
        const attached = v.slice(j + 1);
        if (attached) add(name, { ...args[i], value: attached });
        else if (i + 1 < args.length) add(name, args[++i]);
        break;
      }
    } else {
      operands.push(args[i]);
    }
  }
  return {
    flags,
    operands,
    has: (...names: string[]) => names.find((n) => flags.has(n)),
  };
}

function checkGit(
  command: Command,
  dir: string | null,
  depth: number,
): Verdict {
  const sub = command.subcommand;
  if (!sub) return null;
  const hooks = command.config.some((c) => /^core\.hookspath=/i.test(c));
  if (hooks && (sub === "commit" || sub === "push")) {
    return `git -c core.hooksPath skips the hooks, like --no-verify`;
  }
  if (sub === "add" || sub === "stage") return stage(command, dir);
  if (sub === "commit") return commit(command, dir);
  if (sub === "push") return push(command, dir);
  if (sub === "update-index") {
    const refresh = command.args.every((a) =>
      ["--refresh", "--really-refresh", "-q", "--ignore-missing"].includes(
        a.value,
      ),
    );
    return refresh || index(command, dir) === "private"
      ? null
      : "git update-index writes the index directly; the maintainer stages chunks";
  }
  if (sub === "apply") {
    const staged = command.args.some(
      (a) => a.value === "--cached" || a.value === "--index",
    );
    return staged && index(command, dir) !== "private"
      ? "git apply --cached stages the patch; apply it to the working tree and leave it unstaged"
      : null;
  }
  if (sub === "read-tree") {
    const where = index(command, dir);
    if (where === "private") return null;
    if (where === "unknown") return LITERAL;
  }
  if (sub in WRITERS) return `git ${sub} ${WRITERS[sub]}`;
  if (
    ["merge", "rebase", "cherry-pick", "reset", "checkout", "restore"].includes(
      sub,
    )
  ) {
    return revisions(command, dir);
  }
  return alias(command, dir, depth);
}

// Where GIT_INDEX_FILE sends a command: the repository's own index, a
// private one (as when the agent fingerprints a chunk), or unknown.
function index(
  command: Command,
  dir: string | null,
): "real" | "private" | "unknown" {
  const file = command.env.GIT_INDEX_FILE;
  if (!file) return "real";
  if (file.dynamic || dir === null) return "unknown";
  const real = git(
    ["rev-parse", "--path-format=absolute", "--git-path", "index"],
    dir,
  );
  return real && resolve(dir, file.value) !== resolve(real)
    ? "private"
    : "real";
}

function stage(command: Command, dir: string | null): Verdict {
  const where = index(command, dir);
  if (where === "private") return null;
  if (where === "unknown") return LITERAL;
  if (dir === null)
    return "the guard cannot tell which directory git add runs in";
  // WIP commits there never leave it: push() refuses commits on no branch.
  if (scratch(dir)) return null;
  const { operands, has } = options(command.args, [
    "--chmod",
    "--pathspec-from-file",
  ]);
  const bulk = has(
    "-A",
    "--all",
    "-u",
    "--update",
    "--no-ignore-removal",
    "--pathspec-from-file",
  );
  if (bulk)
    return `git add ${bulk} stages everything; the maintainer stages chunks`;
  const repo = ledger.repo(dir);
  const written = repo ? ledger.read(repo) : new Set<string>();
  for (const path of operands) {
    if (path.dynamic) return "a path given to git add is not static";
    if (/[*?[]/.test(path.value) || path.glob) {
      return `git add ${path.value} is a glob; name the files`;
    }
    if (path.value.startsWith(":")) {
      return `git add ${path.value} uses pathspec magic; name the files`;
    }
    const abs = resolve(dir, path.value);
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      return `git add ${path.value} stages a whole directory; name the files`;
    }
    if (repo && written.has(ledger.key(repo, abs))) {
      return `the agent wrote ${ledger.key(repo, abs)}; only the maintainer stages the agent's work (I2)`;
    }
  }
  return null;
}

function commit(command: Command, dir: string | null): Verdict {
  if (command.env.GIT_INDEX_FILE) {
    return "git commit with GIT_INDEX_FILE commits a tree the maintainer did not stage";
  }
  if (dir === null)
    return "the guard cannot tell which directory git commit runs in";
  const { flags, operands, has } = options(command.args, [
    "-m",
    "-F",
    "-C",
    "-c",
    "-t",
    "--message",
    "--file",
    "--reuse-message",
    "--reedit-message",
    "--template",
    "--author",
    "--date",
    "--cleanup",
    "--fixup",
    "--squash",
    "--trailer",
    "--pathspec-from-file",
  ]);
  const bypass = has(
    "-a",
    "--all",
    "-i",
    "--include",
    "-o",
    "--only",
    "-p",
    "--patch",
    "--interactive",
    "--pathspec-from-file",
  );
  if (bypass)
    return `git commit ${bypass} commits what nobody staged; commit exactly the index`;
  if (has("-n", "--no-verify")) return "git commit --no-verify skips the hooks";
  if (operands.length)
    return "git commit with paths bypasses the index; commit exactly what is staged";
  if (has("--author"))
    return "git commit --author changes the author of record (I5)";
  const message = [
    ...(flags.get("-m") ?? []),
    ...(flags.get("--message") ?? []),
    ...(flags.get("--trailer") ?? []),
  ];
  const text = checkText(message, "commit message");
  if (text) return text;
  for (const file of [
    ...(flags.get("-F") ?? []),
    ...(flags.get("--file") ?? []),
    ...(flags.get("-t") ?? []),
    ...(flags.get("--template") ?? []),
  ]) {
    if (file.dynamic) return "the commit message file is not static";
    const verdict = checkFile(file.value, command.stdin, dir, "commit message");
    if (verdict) return verdict;
  }
  for (const rev of [
    ...(flags.get("-C") ?? []),
    ...(flags.get("-c") ?? []),
    ...(flags.get("--reuse-message") ?? []),
    ...(flags.get("--reedit-message") ?? []),
  ]) {
    if (rev.dynamic) return "the reused commit is not static";
    const body = git(["log", "-1", "--format=%B", rev.value], dir) ?? "";
    if (attributed(body))
      return "the reused commit message carries an attribution line (I5)";
  }
  if (has("--amend") && git(["branch", "-r", "--contains", "HEAD"], dir)) {
    return "amending a pushed commit needs a force-push; add a new commit";
  }
  return null;
}

function push(command: Command, dir: string | null): Verdict {
  if (dir === null)
    return "the guard cannot tell which directory git push runs in";
  const { flags, operands, has } = options(command.args, [
    "--repo",
    "-o",
    "--push-option",
    "--receive-pack",
    "--exec",
  ]);
  const everything = has("--mirror", "--all", "--prune");
  if (everything)
    return `git push ${everything} can rewrite or delete the default branch`;
  if (has("--no-verify")) return "git push --no-verify skips the hooks";
  if (operands.some((o) => o.dynamic || o.glob)) {
    return "a git push target is not static";
  }
  const current = currentBranch(dir);
  const main = defaultBranch(dir);
  const deleting = !!has("-d", "--delete");
  const force = has("-f", "--force");
  const lease = [...flags.keys()].some(
    (k) => k.startsWith("--force-with-lease") || k === "--force-if-includes",
  );

  const targets: string[] = [];
  let plus = false;
  for (const spec of operands.slice(1).map((o) => o.value)) {
    if (spec.startsWith("+")) plus = true;
    const [src, dst] = spec.replace(/^\+/, "").split(":");
    const commit =
      src && git(["rev-parse", "--verify", "--quiet", `${src}^{commit}`], dir);
    if (commit && !branched(commit, dir)) {
      return `${src} is on no branch, like a worktree's WIP commit, so pushing it would publish content nobody staged (I2)`;
    }
    let target = dst ?? src;
    if (target === "HEAD" || target === "@") target = current ?? "HEAD";
    targets.push(target.replace(/^refs\/heads\//, ""));
  }
  if (!operands.slice(1).length) {
    if (!current) return "git push from a detached HEAD has no clear target";
    targets.push(current);
  }
  if (targets.includes(main)) {
    return deleting
      ? `git push deletes ${main}`
      : `git push to ${main}; ${main} only changes through a squash-merged pull request (I4)`;
  }
  if (force || plus)
    return "force-pushing is blocked; use --force-with-lease on your own issue branch (I4)";
  if (lease && targets.some((t) => t !== current)) {
    return "--force-with-lease is only allowed on the current issue branch (I4)";
  }
  return null;
}

// Blocks moves that would bring in commits nobody staged, such as a
// worktree's WIP commit. Branch switches and remote-tracking refs pass.
function revisions(command: Command, dir: string | null): Verdict {
  const sub = command.subcommand;
  if (dir === null)
    return `the guard cannot tell which directory git ${sub} runs in`;
  const values =
    sub === "restore"
      ? ["-s", "--source"]
      : sub === "checkout"
        ? ["-b", "-B", "--orphan"]
        : ["-m", "-X", "-s", "--strategy", "--strategy-option", "--onto"];
  const { flags, operands, has } = options(command.args, values);
  if (has("--abort", "--quit", "--skip")) return null;
  if (sub === "rebase" && has("-x", "--exec", "-i", "--interactive")) {
    return "git rebase --exec or -i runs unreviewed steps";
  }
  if (sub === "checkout" && operands.length <= 1) return null;
  const revs = [...operands];
  if (sub === "restore")
    revs.splice(
      0,
      revs.length,
      ...(flags.get("-s") ?? []),
      ...(flags.get("--source") ?? []),
    );
  if (sub === "rebase") revs.push(...(flags.get("--onto") ?? []));
  for (const rev of revs) {
    if (rev.dynamic) return `a revision given to git ${sub} is not static`;
    const commit = git(
      ["rev-parse", "--verify", "--quiet", `${rev.value}^{commit}`],
      dir,
    );
    if (commit && !reviewed(commit, dir)) {
      return `${rev.value} is not on this branch or any remote, so git ${sub} would bring in content nobody staged (I2)`;
    }
  }
  return null;
}

function alias(command: Command, dir: string | null, depth: number): Verdict {
  const sub = command.subcommand!;
  const configured = command.config.find((c) => c.startsWith(`alias.${sub}=`));
  const value = configured
    ? configured.slice(sub.length + 7)
    : git(["config", "--get", `alias.${sub}`], dir ?? process.cwd());
  if (!value) return null;
  if (value.startsWith("!"))
    return `git ${sub} is a shell alias the guard cannot see through`;
  if (depth > 5) return `git ${sub} is a recursive alias`;
  const [expanded, ...rest] = value.trim().split(/\s+/);
  const words = rest.map((v) => ({ value: v, dynamic: false, glob: false }));
  return checkGit(
    { ...command, subcommand: expanded, args: [...words, ...command.args] },
    dir,
    depth + 1,
  );
}

function checkGh(command: Command, dir: string): Verdict {
  const [action, ...args] = command.args;
  if (command.subcommand === "api") return api(command.args);
  if (!["pr", "issue"].includes(command.subcommand ?? "") || !action)
    return null;
  const merge = command.subcommand === "pr" && action.value === "merge";
  const { flags, operands, has } = options(
    args,
    merge
      ? [
          "-b",
          "--body",
          "-F",
          "--body-file",
          "-t",
          "--subject",
          "-A",
          "--author-email",
          "--match-head-commit",
          "-R",
          "--repo",
        ]
      : [
          "-b",
          "--body",
          "-F",
          "--body-file",
          "-t",
          "--title",
          "-R",
          "--repo",
          "-B",
          "--base",
          "-H",
          "--head",
          "-a",
          "--assignee",
          "-l",
          "--label",
          "-m",
          "--milestone",
          "-p",
          "--project",
          "-r",
          "--reviewer",
          "-T",
          "--template",
          "--add-label",
          "--remove-label",
          "--add-assignee",
          "--remove-assignee",
          "--add-reviewer",
          "--remove-reviewer",
        ],
  );
  const text = checkText(
    ["-b", "--body", "-t", "--title", "--subject"].flatMap(
      (f) => flags.get(f) ?? [],
    ),
    `${command.subcommand} text`,
  );
  if (text) return text;
  for (const file of [
    ...(flags.get("-F") ?? []),
    ...(flags.get("--body-file") ?? []),
  ]) {
    if (file.dynamic) return "the body file is not static";
    const verdict = checkFile(
      file.value,
      command.stdin,
      dir,
      `${command.subcommand} body`,
    );
    if (verdict) return verdict;
  }
  if (!merge) return null;

  if (has("--admin"))
    return "gh pr merge --admin bypasses the branch rules (I3)";
  if (has("--auto"))
    return "gh pr merge --auto merges later, unwatched; wait for green checks and merge";
  if (!has("-s", "--squash") || has("-m", "--merge", "-r", "--rebase")) {
    return "merge with gh pr merge --squash; main gets one commit per pull request";
  }
  const repo = [...(flags.get("-R") ?? []), ...(flags.get("--repo") ?? [])][0];
  const target = operands[0];
  if (target?.dynamic || repo?.dynamic)
    return "the pull request to merge is not static";
  const result = run(
    "gh",
    [
      "pr",
      "checks",
      ...(target ? [target.value] : []),
      ...(repo ? ["--repo", repo.value] : []),
      "--json",
      "name,bucket",
    ],
    dir,
  );
  if (/no checks reported/i.test(result.stderr)) {
    return "no check ran on this pull request; merge only after at least one green check (I3)";
  }
  let checks: { name: string; bucket: string }[];
  try {
    checks = JSON.parse(result.stdout);
  } catch {
    return `the guard could not read the pull request's checks (${result.stderr.trim() || "gh failed"}), so the merge is blocked`;
  }
  if (!checks.length) {
    return "no check ran on this pull request; merge only after at least one green check (I3)";
  }
  const red = checks.filter(
    (c) => c.bucket !== "pass" && c.bucket !== "skipping",
  );
  if (red.length) {
    const list = red.map((c) => `${c.name} is ${c.bucket}`).join(", ");
    return `${list}; merge only on green checks (I3)`;
  }
  return null;
}

function api(args: Word[]): Verdict {
  if (args.some((a) => a.dynamic))
    return "a gh api call with dynamic arguments cannot be checked";
  const text = args.map((a) => a.value).join(" ");
  const { flags } = options(args, [
    "-X",
    "--method",
    "-f",
    "-F",
    "--field",
    "--raw-field",
    "-H",
    "--header",
    "--input",
    "-q",
    "--jq",
    "-t",
    "--template",
  ]);
  const method = (
    [...(flags.get("-X") ?? []), ...(flags.get("--method") ?? [])][0]?.value ??
    ""
  ).toUpperCase();
  const writes =
    (method && method !== "GET") ||
    ["-f", "-F", "--field", "--raw-field", "--input"].some((f) => flags.has(f));
  if (
    /\/pulls\/[^/\s]+\/merge\b|mergePullRequest|enablePullRequestAutoMerge/.test(
      text,
    )
  ) {
    return "merges go through gh pr merge --squash, which the guard checks";
  }
  if (writes && /\/(rulesets|branches\/[^/\s]+\/protection)\b/.test(text)) {
    return "changing the branch rules through gh api is blocked; use hug init";
  }
  if (writes && /\/git\/refs\/heads\//.test(text)) {
    return "writing branch refs through gh api bypasses the flow (I4)";
  }
  return null;
}

const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
if (payload.tool_name === "Bash") {
  const verdict = check(
    String(payload.tool_input?.command ?? ""),
    payload.cwd ?? process.cwd(),
  );
  if (verdict) {
    process.stderr.write(`HuG Flow guard: ${verdict}\n`);
    process.exit(2);
  }
}
