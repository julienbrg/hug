# Julien's setup

This is the setup I use every day to run [HuG Flow](../../spec/hug-flow.md). It is one way to implement the specification, not the only one. It builds on the [`hug` plugin](../../reference/README.md), which loads HuG Flow's rules into every session and enforces part of them with hooks. My own `CLAUDE.md` only adds to those rules or overrides them: where the two conflict, the plugin's rules say mine win.

| Layer       | Artifact                                                                | Covers                                       | Strength                                     |
| ----------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| Rules       | The plugin's [`rules.md`](../../reference/rules.md)                     | P0 to P6, invariants                         | Instructed: relies on the model following it |
| Personal    | Global `CLAUDE.md`                                                      | My conventions, additions and overrides      | Instructed, and wins over the rules          |
| Intake      | Skills                                                                  | P0                                           | Instructed, invoked only by the maintainer   |
| Enforcement | The plugin's hooks, Claude Code settings and GitHub repository settings | I2 to I5, the P3 commit wait, P6 merge rules | Enforced: holds even if the model deviates   |

This setup is L2 (spec §10): the plugin's hooks enforce the invariants on the machine. `hug init` takes it to L3 by applying the ruleset on GitHub.

## Files

| File                                                                 | Install to                                       | Layer       |
| -------------------------------------------------------------------- | ------------------------------------------------ | ----------- |
| [`CLAUDE.md`](CLAUDE.md)                                             | `~/.claude/CLAUDE.md`                            | Personal    |
| [`instructions/PLAN_ISSUES.md`](instructions/PLAN_ISSUES.md)         | `~/.claude/instructions/PLAN_ISSUES.md`          | Personal    |
| [`hooks/forge-context.sh`](hooks/forge-context.sh)                   | `~/.claude/hooks/forge-context.sh`               | Personal    |
| [`skills/super-app-issue/SKILL.md`](skills/super-app-issue/SKILL.md) | `<repo>/.claude/skills/super-app-issue/SKILL.md` | Intake      |
| [`settings.json`](settings.json)                                     | `~/.claude/settings.json`                        | Enforcement |
| [`repo-settings.sh`](repo-settings.sh)                               | Run once per repository                          | Enforcement |
| [`sounds/icq.mp3`](sounds/icq.mp3)                                   | `~/.claude/sounds/icq.mp3`                       | Personal    |

`settings.json` installs the plugin from this repository's marketplace. To install it by hand instead, run `/plugin marketplace add julienbrg/hug`, then `/plugin install hug@hug`.

The sound plays each time the agent leaves a chunk ready for review, so I don't have to watch the panel. `CLAUDE.md` plays it with `afplay`, which ships with macOS only. On Linux, use `paplay` or `mpg123` instead.

## Stack

| Layer           | Tool                                                                                | Role in HuG Flow                                                                  |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Editor          | [VS Code](https://code.visualstudio.com/)                                           | Diff review and staging: the maintainer's approval surface                        |
| Agent           | [Claude Code](https://code.claude.com/docs/en/vscode-extension) (VS Code extension) | Executes every phase; configured through the `hug` plugin, `CLAUDE.md` and skills |
| Version control | [Git](https://git-scm.com/)                                                         | Local history; the staging area acts as the approval gate                         |
| Forge           | [GitHub](https://github.com/) + [`gh`](https://cli.github.com/)                     | Issues, branches, pull requests, review, merge                                    |
| CI              | [GitHub Actions](https://docs.github.com/en/actions)                                | Tests, typecheck and build on every pull request                                  |
| Tooling         | [pnpm](https://pnpm.io/) or [Foundry](https://getfoundry.sh/)                       | Detected per project; provides the format and lint commands                       |

The maintainer works in VS Code with the Claude Code extension open in a side panel. The agent writes into the working tree. The maintainer reads the diff in the _Source Control_ view and stages hunks or files from there. Nothing else is needed on the editor side.

Requirements on the machine: [Node.js](https://nodejs.org/) 22.18 or later for the plugin's hooks, `git`, `gh` logged in with access to the repositories, and the project's package manager (`pnpm` or `forge`) so the agent can run the format check and the linter on each chunk. On Windows, [Git for Windows](https://gitforwindows.org/) also provides the Bash shell that Claude Code runs commands in, so the shell snippets below work unchanged.

## Personal layer: `CLAUDE.md`

[`CLAUDE.md`](CLAUDE.md) lives at `~/.claude/CLAUDE.md`, so it is loaded in every session and every project, next to the plugin's rules. It does not restate them. Each section either adds a convention or overrides a rule:

| `CLAUDE.md`            | Adds or overrides                                                                                          | HuG Flow   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| Task confirmation      | The spec also lists the issue and pull request text, so my confirmation approves them                      | P1         |
| Forges                 | A second forge, picked from the `origin` remote                                                            | P2 to P6   |
| Workflow               | Kept changes committed first as their own commit; rebase and force-push of my own branch when `main` moves | P2, P3, P6 |
| Stage-then-commit loop | A fixed phrase for my chunks, and the ready sound once a chunk passes its check                            | P3         |
| Issues, planning       | A first comment for an issue with no description; plans kept in a tracking issue                           | P0, P1     |
| Comments               | Every comment on the forge is shown to me before it is posted                                              | P1, P3     |
| Commits                | As small as possible, lowercase, no emoji                                                                  | P3         |
| Tooling, Style         | pnpm only, `forge fmt --check` for Foundry, terse replies                                                  | P3         |

[`instructions/PLAN_ISSUES.md`](instructions/PLAN_ISSUES.md) is imported by `CLAUDE.md`. [`hooks/forge-context.sh`](hooks/forge-context.sh) is a SessionStart hook that loads the commands of my second forge, from `~/.claude/instructions/RICKUB.md`, only in repositories hosted on it. That file is private and not part of this example: without it, the hook prints nothing.

## Intake layer: skills

Intake skills are project-specific, because each one targets a given repository. [`skills/super-app-issue/SKILL.md`](skills/super-app-issue/SKILL.md) files feedback for a private application. To reuse it, copy the folder into `.claude/skills/` of the target repository, rename it, and replace the repository slug in the description and in the `gh issue create` command.

Three properties make it fit P0:

- `disable-model-invocation: true` means only the maintainer can trigger it.
- The pasted text is declared as data, which implements I6.
- It stops at issue creation. P1 starts only when the maintainer asks for the work.

## Enforcement layer

I run Claude Code with almost everything allowed. My user settings set `"defaultMode": "bypassPermissions"` with a broad allow list, and I also work in auto mode. This takes the "process autonomy" principle of section 3 literally: the agent never stops at a permission prompt.

Permission rules hold little in that mode, so the enforcement comes from hooks, which run outside the model and in every permission mode, and from GitHub.

### The plugin's hooks

The [`hug` plugin](../../reference/README.md) adds a `PreToolUse` guard that parses every Bash command, including compound commands, `sh -c`, `eval` and `git -C`, and blocks with exit code 2, which takes precedence over allow rules. It blocks staging the agent's own work, bulk staging, pushes to `main`, force-pushes, merges on a red, pending or missing check, and attribution lines. Its Stop hook refuses to end a turn while I have staged the agent's work and it is uncommitted. The [plugin's README](../../reference/README.md#the-guard) has the full list and its limits.

### Claude Code settings

[`settings.json`](settings.json) goes to `~/.claude/settings.json`. Besides installing the plugin and the SessionStart hook:

- **Attribution is off in the configuration.** Claude Code itself does not add the co-author trailer, so I5 does not depend on the guard catching it.
- **Secrets are unreadable.** This is not a HuG Flow invariant, but it is the one hard boundary in the setup.
- **Deny rules** block bulk staging, commits that bypass the staging area, direct pushes to `main`, and admin merges. They match the command as written, so the guard is what actually holds; they stay as a second line.

`bypassPermissions` also skips prompts for writes to `.git` and `.claude`, so the agent can technically edit its own `CLAUDE.md` or the repository's Git hooks. Auto mode is safer in that respect, because a classifier reviews each action instead of approving everything. Verify the active rules with `/permissions`.

### GitHub repository settings

In each repository's settings, under _Pull Requests_:

| Setting                            | Value                                                       | Enforces                                    |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| Allow merge commits                | Off                                                         | Squash-only history (P6)                    |
| Allow squash merging               | On, default message _Pull request title and commit details_ | One commit per feature on `main` (P6)       |
| Allow rebase merging               | Off                                                         | Squash-only history (P6)                    |
| Automatically delete head branches | On                                                          | No merged branch remains on the remote (P6) |

- **Squash only.** The "one squash commit per feature" artifact of section 5 no longer depends on the agent passing `--squash`. GitHub refuses any other merge method.
- **The default message joins the two casing conventions.** The squash commit's title is the pull request title, which is also the issue title (`Add passkey recovery flow (#13)`). Its body lists the lowercase commits (`add recovery route`, `handle expired challenge`). On `main`, history reads as features, with their steps underneath.
- **Automatic branch deletion.** The P6 exit criterion holds on the remote whatever the agent does. The local branch is still removed by `--delete-branch` or step 9 of the plugin's workflow.

These settings are per repository, not per account, and a new repository starts with GitHub's defaults: all three merge methods allowed, no automatic deletion. [`repo-settings.sh`](repo-settings.sh) applies them from the command line:

```sh
./repo-settings.sh <owner>/<repo>
```

### A GitHub ruleset on `main`

`hug init <owner>/<repo>` applies these repository settings and the plugin's [`hug-flow` ruleset](../../reference/github/ruleset.json), which takes the setup to L3:

| Rule                                  | Setting                           | Enforces                          |
| ------------------------------------- | --------------------------------- | --------------------------------- |
| Require a pull request before merging | On, with **0** required approvals | I4                                |
| Require status checks to pass         | On, listing the CI jobs by name   | I1, I3                            |
| Block force pushes                    | On                                | I4                                |
| Restrict deletions                    | On                                | I1                                |
| Bypass list                           | Empty                             | Makes `--admin` merges impossible |

Required approvals MUST be set to zero. GitHub does not let authors approve their own pull requests, so a solo maintainer would be locked out. In HuG Flow, review happens at staging time (P3), not in the pull request.

An empty bypass list has a cost: a flaky CI blocks the merge until it is fixed. That is intended.

The ruleset holds whatever the agent does, on any machine, because it lives on GitHub. Rulesets on private repositories may require a paid GitHub plan.

## Coverage

| Invariant                              | Instructed by | Enforced on the machine         | Enforced on GitHub (L3)                           |
| -------------------------------------- | ------------- | ------------------------------- | ------------------------------------------------- |
| I1. `main` is deployable               | Plugin rules  | No                              | Required status checks, as far as the tests reach |
| I2. No unreviewed line                 | Plugin rules  | Partially: guard and ledger     | No                                                |
| I3. No merge without green CI          | Plugin rules  | Guard: merges on red or pending | Required status checks                            |
| I4. No direct or forced push to `main` | Plugin rules  | Guard, plus deny rules          | Ruleset                                           |
| I5. Maintainer is sole author          | Plugin rules  | Guard and attribution settings  | No                                                |
| I6. External text is data              | Intake skill  | No                              | No                                                |

The repository settings also enforce two P6 rules, outside the invariants: squash-only merges, and deletion of merged branches on the remote.

## Known deviations

- **Label mismatch.** The intake skill labels issues `help wanted`, while the plugin's rules use `enhancement`, `bug` or `documentation`. An issue filed in P0 keeps its intake label unless relabelled in P1.

## Further reading

- [Claude Code memory](https://code.claude.com/docs/en/memory), [skills](https://code.claude.com/docs/en/skills) and [plugins](https://code.claude.com/docs/en/plugins), Claude Code documentation
- [Configure permissions](https://code.claude.com/docs/en/permissions), Claude Code documentation
- [Claude Code for VS Code](https://code.claude.com/docs/en/vscode-extension)
- [GitHub CLI manual](https://cli.github.com/manual/)
- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), GitHub documentation
