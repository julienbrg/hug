# Reference implementation

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) and a small CLI that enforce [HuG Flow](../spec/hug-flow.md) instead of only instructing it.

```text
implements: hug-flow@0.3.0
level: L2 (L3 once `hug init` has applied the ruleset)
```

The [`minimal`](../examples/minimal/README.md) example setup is L1: it relies on the model following its instructions. This plugin adds hooks that run outside the model, so their decisions hold whatever the model does and in every permission mode, `bypassPermissions` included.

## Requirements

- [Node.js](https://nodejs.org/) 22.18 or later, which runs the TypeScript sources directly; no dependencies to install;
- [`git`](https://git-scm.com/), and [`gh`](https://cli.github.com/) logged in with access to the repository.

## Install

In a Claude Code session, from the marketplace this repository provides:

```text
/plugin marketplace add julienbrg/hug
/plugin install hug@hug
```

Or, from a clone, for one session: `claude --plugin-dir ./reference`.

Then, once per repository, apply the forge side (L3):

```sh
pnpm hug init <owner>/<repo>            # or: node reference/src/cli/hug.ts init <owner>/<repo>
pnpm hug init <owner>/<repo> --dry-run  # print the plan without applying it
```

## Components

| Component                          | Mechanism                                                                                      | Covers         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | -------------- |
| [`rules.md`](rules.md)             | Loaded into every session by a SessionStart hook                                               | P0–P6          |
| [`guard.ts`](src/hooks/guard.ts)   | PreToolUse hook on Bash: parses the command and blocks it with exit code 2                     | I2, I3, I4, I5 |
| [`ledger.ts`](src/hooks/ledger.ts) | Records every path the agent writes, through Edit, Write or Bash, so the guard can refuse it   | I2             |
| [`stop.ts`](src/hooks/stop.ts)     | Stop hook: the turn cannot end while the maintainer has staged the agent's work and it waits   | P3             |
| [`hug init`](src/cli/init.ts)      | Squash-only merges, merged branches deleted, and the [`hug-flow` ruleset](github/ruleset.json) | I1, I3, I4, P6 |
| [`hug audit`](src/cli/audit.ts)    | A pass or fail per after-the-fact predicate of §10, over the default branch's history          | I1, I3, I4, I5 |
| [`conformance/`](../conformance/)  | Deterministic scenario tests of the hooks and CLI, with `gh` stubbed, run by `pnpm test` in CI | L2             |

### The guard

[`parse.ts`](src/lib/parse.ts) first turns the command line into the simple commands it runs: it splits `&&`, `;`, `|` and newlines, unwraps `sh -c`, `bash -lc`, `eval`, `env`, `sudo` and command substitutions, strips git's global options such as `-C`, resolves heredoc messages and git aliases, and tracks `cd`. The guard then blocks:

- `git add` of a path the agent wrote, and bulk staging: `-A`, `-u`, `.`, a directory, a glob or pathspec magic, except in a linked worktree on a detached `HEAD`, where the agent commits its WIP;
- commits that bypass the index or its hooks: `-a`, `--only`, paths, `--no-verify`, `core.hooksPath`;
- other writers of the index or of history (`rm`, `mv`, `apply --cached`, `update-index`, `revert`, `commit-tree`), and moves that would bring in a commit that is neither on the branch nor on a remote, such as a worktree's WIP commit;
- pushes to the default branch in any refspec form, force-pushes, except `--force-with-lease` on the current issue branch, and pushes of a commit that is on no local branch and no remote, such as a worktree's WIP commit;
- `gh pr merge` without `--squash`, with `--admin` or `--auto`, or while `gh pr checks` reports a failing, pending or cancelled check, or none at all;
- `Co-Authored-By` trailers and generated-by footers in commit messages, pull requests and issue comments, and `--author`.

A staging command with a private `GIT_INDEX_FILE`, as used to fingerprint a chunk, is allowed. The path must be literal: a variable such as `$T` leaves the guard unable to tell the private index from the real one, so it blocks. A git or `gh` command the parser cannot read with confidence is blocked, with a request to rewrite it in plain form. Other commands are left alone.

### The ledger

The loop is symmetric: the agent stages the maintainer's chunks, so `git add` cannot be denied outright. Instead, the ledger, in `.git/hug/ledger.json`, lists the paths the agent wrote. Edits and writes are recorded directly. For Bash, a snapshot of the dirty files and their hashes is taken before each call, and every file that changed during the call is recorded. A path leaves the ledger once it matches `HEAD` again.

## Limits

- The guard checks the repository as it is before the command runs. A branch switch and a push in the same command line are blocked, and must run as two commands.
- A file the maintainer edits while an agent Bash call is running is recorded as the agent's. The guard then refuses to stage it, and the maintainer stages it instead.
- I2 is verified procedurally: nothing in the history shows who staged a chunk, and no hook can tell whether the maintainer read it. I6 is not enforced at all; it rests on the rules.
- GitHub only. Rulesets on private repositories may require a paid GitHub plan; without them, `hug init` reports it and the repository stays at L2.
