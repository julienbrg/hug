# Julien's setup

This is the setup I use every day to run [HuG Flow](../../spec/hug-flow.md). It is one way to implement the specification, not the only one. It has three layers. The first two tell the agent what to do. The third makes sure some things cannot happen, whatever the agent does.

| Layer       | Artifact                                                                                                                                                                                                          | Covers                                                                        | Strength                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| Process     | Global `CLAUDE.md`                                                                                                                                                                                                | P1 to P6, conventions, invariants                                             | Instructed: relies on the model following it |
| Intake      | Skills                                                                                                                                                                                                            | P0                                                                            | Instructed, invoked only by the maintainer   |
| Enforcement | Claude Code settings, GitHub repository settings and [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) | I5 and the P6 merge rules today; I1, I3, I4 and part of I2 with the additions | Enforced: holds even if the model deviates   |

## Files

| File                                                                 | Install to                                       | Layer       |
| -------------------------------------------------------------------- | ------------------------------------------------ | ----------- |
| [`CLAUDE.md`](CLAUDE.md)                                             | `~/.claude/CLAUDE.md`                            | Process     |
| [`skills/super-app-issue/SKILL.md`](skills/super-app-issue/SKILL.md) | `<repo>/.claude/skills/super-app-issue/SKILL.md` | Intake      |
| [`settings.json`](settings.json)                                     | `~/.claude/settings.json`                        | Enforcement |
| [`repo-settings.sh`](repo-settings.sh)                               | Run once per repository                          | Enforcement |

## Stack

| Layer           | Tool                                                                                | Role in HuG Flow                                                |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Editor          | [VS Code](https://code.visualstudio.com/)                                           | Diff review and staging: the maintainer's approval surface      |
| Agent           | [Claude Code](https://code.claude.com/docs/en/vscode-extension) (VS Code extension) | Executes every phase; configured through `CLAUDE.md` and skills |
| Version control | [Git](https://git-scm.com/)                                                         | Local history; the staging area acts as the approval gate       |
| Forge           | [GitHub](https://github.com/) + [`gh`](https://cli.github.com/)                     | Issues, branches, pull requests, review, merge                  |
| CI              | [GitHub Actions](https://docs.github.com/en/actions)                                | Tests, typecheck and build on every pull request                |
| Tooling         | [pnpm](https://pnpm.io/) or [Foundry](https://getfoundry.sh/)                       | Detected per project; provides the format and lint commands     |

The maintainer works in VS Code with the Claude Code extension open in a side panel. The agent writes into the working tree. The maintainer reads the diff in the _Source Control_ view and stages hunks or files from there. Nothing else is needed on the editor side.

Requirements on the machine: `git`, `gh` logged in with access to the repositories, and the project's package manager (`pnpm` or `forge`) so the agent can run the format check and the linter at commit time.

## Process layer: `CLAUDE.md`

[`CLAUDE.md`](CLAUDE.md) lives at `~/.claude/CLAUDE.md`, so it is loaded in every session and every project. How it maps to the lifecycle:

| `CLAUDE.md`                                                           | HuG Flow                                   |
| --------------------------------------------------------------------- | ------------------------------------------ |
| Task confirmation                                                     | P1                                         |
| Workflow, steps 1 to 4                                                | P2                                         |
| Workflow, steps 5 and 8, and the stage-then-commit loop               | P3                                         |
| Workflow, steps 6, 7 and 9                                            | P4                                         |
| Workflow, step 10                                                     | P5                                         |
| Workflow, steps 11 and 12                                             | P6                                         |
| Attribution                                                           | I5                                         |
| Pull requests: never push to `main`, never force-push a shared branch | I4                                         |
| Issues, Pull requests, Commits                                        | Conventions for the artifacts of section 5 |

## Intake layer: skills

Intake skills are project-specific, because each one targets a given repository. [`skills/super-app-issue/SKILL.md`](skills/super-app-issue/SKILL.md) files feedback for a private application. To reuse it, copy the folder into `.claude/skills/` of the target repository, rename it, and replace the repository slug in the description and in the `gh issue create` command.

Three properties make it fit P0:

- `disable-model-invocation: true` means only the maintainer can trigger it.
- The pasted text is declared as data, which implements I6.
- It stops at issue creation. P1 starts only when the maintainer asks for the work.

## Enforcement layer

I run Claude Code with almost everything allowed. My user settings set `"defaultMode": "bypassPermissions"` with a broad allow list, and I also work in auto mode. This takes the "process autonomy" principle of section 3 literally: the agent never stops at a permission prompt.

The consequence is that the process layer is mostly unbacked today. My Claude Code settings and my GitHub repository settings do enforce part of HuG Flow, and the rest of this section is what I would add.

### Claude Code settings

[`settings.json`](settings.json) goes to `~/.claude/settings.json`. It merges what my settings enforce today with the deny rules I would add.

What is enforced today:

- **Attribution is off in the configuration.** I5 no longer depends only on the `CLAUDE.md` instruction: Claude Code itself does not add the co-author trailer.
- **Secrets are unreadable.** This is not a HuG Flow invariant, but it is the one hard boundary in the setup.

`bypassPermissions` also skips prompts for writes to `.git` and `.claude`, so the agent can technically edit its own `CLAUDE.md` or the repository's Git hooks. Auto mode is safer in that respect, because a classifier reviews each action instead of approving everything.

What the deny rules add: [Claude Code permissions](https://code.claude.com/docs/en/permissions) are evaluated deny first, and no allow rule can override a deny. A deny rule does not add a prompt, it only blocks. It therefore fits an "allow almost everything" setup: nothing changes for the maintainer until the agent tries something forbidden.

The rules block bulk staging, commits that bypass the staging area, direct pushes to `main`, and admin merges that skip required checks.

`git add` is not denied outright, because the loop is symmetric: when the maintainer writes a chunk, the agent is the reviewer and stages it. A maintainer who never writes chunks MAY deny `Bash(git add *)` entirely. The agent side of I2 then becomes a hard guarantee.

The Claude Code documentation is explicit that a Bash rule is not a security boundary. It matches the command as written, so `git -C . add -A` or `sh -c 'git add .'` slip past the rules above. My own allow list contains `git -C <path> add` and `git -C <path> commit` entries, so the agent does use that form. For a stricter check, a `PreToolUse` hook can inspect the full command text and block it with exit code 2, which takes precedence over allow rules. Verify the active rules with `/permissions`.

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
- **Automatic branch deletion.** The P6 exit criterion holds on the remote whatever the agent does. The local branch is still removed by `--delete-branch` or step 12.

These settings are per repository, not per account, and a new repository starts with GitHub's defaults: all three merge methods allowed, no automatic deletion. [`repo-settings.sh`](repo-settings.sh) applies them from the command line:

```sh
./repo-settings.sh <owner>/<repo>
```

### What I would add: a GitHub ruleset on `main`

| Rule                                  | Setting                           | Enforces                          |
| ------------------------------------- | --------------------------------- | --------------------------------- |
| Require a pull request before merging | On, with **0** required approvals | I4                                |
| Require status checks to pass         | On, listing the CI jobs by name   | I1, I3                            |
| Block force pushes                    | On                                | I4                                |
| Restrict deletions                    | On                                | I1                                |
| Bypass list                           | Empty                             | Makes `--admin` merges impossible |

Required approvals MUST be set to zero. GitHub does not let authors approve their own pull requests, so a solo maintainer would be locked out. In HuG Flow, review happens at staging time (P3), not in the pull request.

An empty bypass list has a cost: a flaky CI blocks the merge until it is fixed. That is intended.

The ruleset holds whatever the agent does, including in `bypassPermissions` mode, because it lives on GitHub rather than on the machine. That makes it the most valuable addition for this setup.

Rulesets on private repositories may require a paid GitHub plan.

## Coverage

| Invariant                              | Instructed by        | Enforced today            | Enforced with the additions                       |
| -------------------------------------- | -------------------- | ------------------------- | ------------------------------------------------- |
| I1. `main` is deployable               | `CLAUDE.md`          | No                        | Required status checks, as far as the tests reach |
| I2. No unreviewed line                 | `CLAUDE.md`          | No                        | Partially: deny rules against bulk staging        |
| I3. No merge without green CI          | `CLAUDE.md`, step 10 | No                        | Required status checks                            |
| I4. No direct or forced push to `main` | `CLAUDE.md`          | No                        | Ruleset, plus deny rules                          |
| I5. Maintainer is sole author          | `CLAUDE.md`          | Yes: attribution settings | Same                                              |
| I6. External text is data              | Intake skill         | No                        | No                                                |

The repository settings also enforce two P6 rules today, outside the invariants: squash-only merges, and deletion of merged branches on the remote.

## Known deviations

This setup diverges from the specification in three places:

- **Existing issues.** Step 2 of `CLAUDE.md` always creates an issue. When the work starts from an existing issue, for example one filed in P0, a literal reading creates a duplicate. P1 requires reusing the existing issue.
- **Repositories without CI.** The file applies to every project, including those with no checks. There, step 10 has nothing to wait for and I3 is vacuous. A setup that follows the spec MUST either configure CI or run the full local pipeline (tests, typecheck, build) before P6.
- **Label mismatch.** The intake skill labels issues `help wanted`, while `CLAUDE.md` uses `enhancement` or `bug`. An issue filed in P0 keeps its intake label unless relabelled in P1.

The scratch copy under `/private/tmp` is specific to macOS. Other systems need another path.

## Further reading

- [Claude Code memory](https://code.claude.com/docs/en/memory) and [skills](https://code.claude.com/docs/en/skills), Claude Code documentation
- [Configure permissions](https://code.claude.com/docs/en/permissions), Claude Code documentation
- [Claude Code for VS Code](https://code.claude.com/docs/en/vscode-extension)
- [GitHub CLI manual](https://cli.github.com/manual/)
- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), GitHub documentation
