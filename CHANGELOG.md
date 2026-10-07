# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Issue forms for bugs, features and other work, and a pull request template, in `.github/`. Blank issues are off.
- Issue and pull request body templates in the spec (P1 and P4), the plugin's rules, both examples and the article: a bug has Description, Steps to reproduce, Expected behavior, Actual behavior and Environment; a feature has Problem, Proposed solution, Alternatives considered and Acceptance criteria; other work has Summary, Why and Done when. A pull request has Summary, Changes, How to test, optional Notes, then `Closes #<n>`. A repository's own templates take precedence, since a forge CLI given a body skips them.
- A Motivation section in the README and the article.
- A "What it looks like" walkthrough of a first task, after Get started in the README and the article. It replaces the README's "The flow in one paragraph".
- A comment rule in `examples/julien/CLAUDE.md`, `examples/minimal/AGENTS.md` and the article: the agent shows the maintainer every issue or pull request comment before posting it, posts exactly what they approve, and drafts a pull request comment on a choice, a finding or a minor issue met along the way. A draft waiting for approval never blocks a commit or a push. Issue and pull request titles and bodies need no approval, so the pull request opens right after the first push.
- A ready sound in `examples/julien`: the agent plays `sounds/icq.mp3` with `afplay` in the same command that records a chunk's fingerprint, so the maintainer hears when a chunk is ready for review. The README gives its install path, `~/.claude/sounds/`, and notes that `afplay` is macOS only. The article quotes the new lines.
- A precedence rule in the plugin's rules: the user's own instructions, their `CLAUDE.md` and what it imports, may add to or override HuG Flow's rules, and win where they conflict. The README and the article explain keeping only those additions and overrides in a personal `CLAUDE.md` on top of the plugin.
- A link to the repository in the article's intro.

### Changed

- The task spec ends with "Merge the pull request once its checks are green.", and the maintainer's confirmation approves the merge too, in the plugin's rules, both examples and the article. Claude Code's auto mode denies `gh pr merge` unless the conversation shows the maintainer approved it.

- `examples/julien` builds on the `hug` plugin and is L2: its `CLAUDE.md` is a slim personal layer that only adds to or overrides the plugin's rules, with `instructions/PLAN_ISSUES.md` imported and a `hooks/forge-context.sh` SessionStart hook that loads a second forge's commands. `settings.json` enables the plugin, and the README maps each section to what it adds and drops the deviations the plugin's rules fixed. The minimal README explains how to keep only your differences on top of the plugin. The spec, the README, the plugin's README and the article list `examples/julien` as L2.
- Issues are labelled by kind: `bug`, `enhancement`, or `documentation` for docs-only work. The forge bindings' Open PR commands take the templated body, and CONTRIBUTING points to the forms and the pull request template.
- The article follows the repo: an intro and Motivation and Get started from the README, the specification verbatim under Official spec, and My own setup quoting `examples/julien/CLAUDE.md` and linking to the `super-app-issue` skill. The Stack section and the setup's layers, enforcement, coverage and known deviations are no longer in the article; it links to `examples/julien` for them.
- `/check-article` maps each article section to its source in the repo.
- Get started names its two options "Instructions only" and "Plugin, with enforcement", recommends the first, and mentions the L1 to L3 levels once, at the end.
- The article's Further reading lists every link from the examples README.
- `hug.sh on --repo` delegates to `hug init` instead of re-implementing it, so both apply the same ruleset and require only the checks that passed on the last merged pull request. It runs before any local change, and stops with nothing changed when `hug init` refuses. It no longer calls `examples/julien/repo-settings.sh`.
- In `examples/julien/CLAUDE.md` and the article, leftover changes the maintainer keeps at step 1 are committed first on the new branch: the agent stages them by name, runs the check pipeline on the staged content, commits them as their own commit and pushes, before any new work.
- The ready sound in `examples/julien` is renamed `sounds/icq.mp3`, in the README, `CLAUDE.md` and the article.
- The fingerprint's throwaway index is a `<literal tmp path>` in `examples/julien/CLAUDE.md`, `examples/minimal/AGENTS.md` and the article, as in the plugin's rules, since the guard blocks a variable one.
- The pipelining handoff diffs fingerprints instead of the worktree's `HEAD`, in the spec, the plugin's rules, both examples and the article: the worktree is seeded with `git diff --binary HEAD <TN>`, and chunk N+1 reaches the repository through `git diff --binary <TN> <TN1> | git apply`. It needs no WIP commit.
- The guard's hints for `git mv` and `git rm` name plain `mv` and `rm`, and the rules and both examples say to use them, leaving both paths unstaged.

### Removed

- The `jq` code path in `hug.sh`: `on` and `off` use `node`, and stop up front without it.
- The dead `notes/hug-toggle-spec.md` reference in `hug.sh`.

### Fixed

- `examples/julien/README.md` presented auto mode as working on top of `bypassPermissions`. They are alternative permission modes: the README now names `bypassPermissions` as the default and auto mode as the switch to a classifier that reviews each action.
- The `examples/julien/README.md` mapping table pointed the artifact conventions to section 5 instead of 6.
- The `publish` workflow failed because the article's frontmatter lacked `source`, which the live post's `/raw` page always shows.
- The ready sound in `examples/julien/CLAUDE.md` and the article starts detached, with `nohup` and its output redirected, so a harness that cleans up the tool call's processes when it returns can't cut it off.
- The guard blocked the agent from staging its own files in a linked worktree, so the WIP commit that pipelining needs was impossible. It now allows staging and committing in a linked worktree on a detached `HEAD`, and blocks pushing any commit that is on no local branch and no remote, from the worktree or the repository.
- The guard reported a variable `GIT_INDEX_FILE` in `read-tree` as "writes the index", which read as a ban on fingerprints. It now asks for a literal path.
- The plugin's version stayed `0.1.0` after the worktree fix, so installs kept the old guard. It is now `0.1.1`.
- The worktree handoff (`git -C <path> diff HEAD | git apply`) dropped new files, which are untracked in the worktree, and failed to apply once chunk N was committed, since the diff contained chunk N again.
- The ready sound in `examples/julien/CLAUDE.md` and the article plays only once the check passes, as the last step of the fingerprint command, wrapped in a subshell. At the end of an `&&` chain, its bare `&` backgrounded the whole chain, so the tool call returned at once and the sound was cut off, and nothing kept it from playing for a chunk that failed the check.
- The plugin's version stayed `0.1.1` after the issue and pull request templates reached its rules, so installs kept the rules without them. It is now `0.1.2`.

## [0.3.0] - 2026-09-27

### Added

- `spec/bindings/`: informative bindings that map the spec's tool-neutral core onto real tools. `agents.md` lists the five capabilities an agent needs and, for Claude Code, Codex, GitHub Copilot, Cursor and Gemini CLI, where it reads `AGENTS.md`, its switch for invocation-only skills (P0), how it can wait for staging (P3), and its attribution setting (I5). `forges.md` gives the commands for creating an issue, branching, opening a pull request, watching checks, squash-merging and protecting `main` on GitHub, GitLab, Azure DevOps and Forgejo/Gitea, with the fallback where a forge has no command. `vcs.md` maps the approval surface onto Git, Jujutsu (an empty change below `@`) and, as a weaker fit, Mercurial and Sapling. `review-tools.md` lists editors and Git interfaces that stage hunks.
- `examples/minimal/hooks/commit-msg`: a POSIX `sh` Git hook that rejects `Co-Authored-By` trailers and generated-by footers, with the reference guard's patterns, so I5 is enforced for every agent.

### Changed

- The spec is now version 0.3.0. Its scope says it is independent of the agent, the forge and the editor, and lists the bindings; §3, §5 and P3 link to the matching binding. The reference implementation, the plugin and marketplace manifests and `package.json` claim 0.3.0. The article mirrors the spec (§2, §3, §5, P3, §10).
- `examples/minimal`: the instructions move to `AGENTS.md`, which most agents read, and `CLAUDE.md` only imports it, so `/hug` keeps working. The README lists the hook, points to the agent and forge bindings, and marks I5 as enforced by the hook.
- README, CONTRIBUTING and SETUP point to the bindings and to `AGENTS.md`.

## [0.2.0] - 2026-09-27

### Added

- `/hug on | off | status`: a skill and `scripts/hug.sh`, in POSIX `sh`, that switch Claude Code to HuG Flow and back. `on` backs up the current setup with a manifest, lists instructions that may conflict so the maintainer can keep them, comment them out or leave both, then appends one import line to `~/.claude/CLAUDE.md` pointing to `examples/minimal/CLAUDE.md`, adds missing attribution settings and deny rules to `~/.claude/settings.json` (with `jq`, or `node` as the fallback), and installs the `/intake` skill if absent. `--repo <owner>/<repo>` also sets squash-only merges and applies the `hug-flow` ruleset, requiring the checks of the last merged pull request. `off` reverts only what `on` recorded, keeps symlinked dotfiles as symlinks, and leaves the backup on disk. Tested by a round trip in `conformance/toggle.test.ts`.
- `SETUP.md`: setup steps for an agent, so "Switch me to HuG Flow: github.com/julienbrg/hug" installs the `/hug` skill and turns it on in one phrase.
- `.claude-plugin/marketplace.json`: the repository is its own plugin marketplace, so the reference implementation installs with `/plugin marketplace add julienbrg/hug` and `/plugin install hug@hug`.
- A Get started section in the README and the article: one phrase for L1, or the plugin for L2. `/check-article` maps them to each other. `examples/minimal` and `reference` READMEs point to the new install routes.

- Spec §10 Conformance: three levels (L1 Instructed, L2 Locally enforced by hooks against I2, I4 and I5 violations, L3 Remotely enforced by forge rules plus an auditable history), a MUST rule that an implementation declares the spec version and level it implements, and a checkable predicate for each invariant. I2 and I6 are marked as verified procedurally, not after the fact, since staging leaves no trace in history. Both example setups are L1. The ADLC section moves to §11.
- The article mirrors it as §10 Conformance; its Stack, ADLC and setup sections are now §11–§13, and cross-references follow. The `/check-article` section map is updated to match.
- `reference/`: the reference implementation, a Claude Code plugin declaring `implements: hug-flow@0.2.0`, `level: L2`. A command parser unwraps compound commands, `sh -c`, `eval`, `env`, substitutions and git's global options, and fails closed on git or `gh` calls it cannot read. A PreToolUse guard then blocks, with exit code 2 and in every permission mode, bulk staging, staging a path the agent wrote, commits that bypass the index or its hooks, other writers of the index, pushes to `main`, force-pushes other than `--force-with-lease` on the issue branch, non-squash, admin or auto merges, merges on red, pending or missing checks, and attribution lines. A ledger records the paths the agent writes through Edit, Write or Bash, so the symmetric loop keeps working. A Stop hook refuses to end a turn while the agent's staged work is uncommitted, and a SessionStart hook loads the rules.
- `hug init <owner/repo>`: squash-only merges, merged branches deleted, and the `hug-flow` ruleset on the default branch, requiring the checks that passed on the last merged pull request. It takes the repository to L3.
- `hug audit <owner/repo>`: a pass or fail per after-the-fact predicate of §10 (I1, I3, I4, I5) over the default branch's history.
- `conformance/`: deterministic L2 scenario tests of the parser, hooks and CLI on the Node.js test runner, with `gh` stubbed through `PATH`. `pnpm test` runs them, in a new `test` job on Ubuntu, macOS and Windows.

### Changed

- The spec is now version 0.2.0. Its abstract and §10 point to the reference implementation, and so does the `examples/julien` README, which describes the setup as L1. The article mirrors both (§10, §13, §13.3).
- Stage-then-commit loop, immediate handoff: once chunk N is staged, the agent commits it and applies chunk N+1 from the worktree right away, finished or not, then pushes chunk N last, so neither an unfinished chunk nor the network delays the handoff. An unfinished chunk is announced as in progress and finished in place; it is fingerprinted, checked and announced as ready once complete. The maintainer may stage part of an in-progress chunk, which is checked on the staged content before it is committed. Updated in the spec (§3 Fingerprint, P3), both example setups, `reference/rules.md` and the article (§3, §7, §13.1).

## [0.1.2] - 2026-09-27

### Changed

- The spec's core is tool-neutral. A new §3 Terminology defines chunk, approval surface, check pipeline, fingerprint and forge; the Agent role is held by any agent with the listed capabilities, with Claude Code as the example; `gh` commands, GitHub Actions and VS Code become GitHub and editor examples of abstract operations; and the instructions-file artifact is `AGENTS.md` or the agent's own file instead of `CLAUDE.md`. Bindings for other agents, forges and VCSs stay out of scope for now.
- New normative text in the spec: the symmetric flow when the maintainer writes a chunk (P3), a rebase rule when `main` moves under an open pull request (P4), an Aborting subsection after P6, and prompt-injection controls for text arriving through the forge (P5, I6).
- Spec consistency fixes: P4–P6 gained their missing Input and Output lines, the keyword list adds SHOULD NOT and RFC 8174, the changelog artifact is created "P4, via P3", the lifecycle diagram labels its two confirmation gates, the approval matrix's changelog row says "staged like any chunk", and the spec states that it is versioned with semver and recorded in this changelog.
- The article mirrors all of the above: its sections 3–11 are now 4–12 to make room for Terminology, cross-references follow, its Further reading gains the RFC 2119/8174 and Keep a Changelog entries, and its description says the core is tool-neutral.
- Stage-then-commit loop: the agent format-checks and lints each chunk before announcing it and records the checked tree as a fingerprint. A chunk staged whole commits with no check wait, so the next chunk lands at once. Partial or edited stages and the maintainer's own chunks are still checked at commit time, on the staged content rather than the working tree. Updated in the spec (P3, with a new MUST rule), both example setups and the article (§5, §9, §11.1).
- Stage-then-commit loop, faster handoff: the agent checks a chunk as soon as it appears as unstaged changes, while the maintainer reads the diff, instead of before announcing it, and reports and fixes a failure as new unstaged changes. The watcher polls every second instead of every five, and once a chunk is staged a single command commits it, applies the next chunk from the worktree, and fingerprints and checks it, so the handoff costs the agent one round-trip. Updated in the spec (§3 Fingerprint, P3), both example setups and the article (§3, §7, §12.1).

## [0.1.1] - 2026-09-26

### Added

- `CONTRIBUTING.md`: requirements, the rules of the flow for contributors, and how to add your own setup under `examples/`. The README links to it and invites new setups, and article §11 does too.
- README: Contact and Credits sections.
- `examples/minimal/`: a generic setup to start from and adapt, with a `CLAUDE.md` free of personal conventions and without the three known deviations, a `/intake` skill targeting the current repository, a GitHub `ruleset.json` for `main`, and a README separating what the spec requires from what each maintainer can adapt. Article §11 links to it.
- Cross-platform support: HuG Flow now runs on macOS, Linux and Windows. `.gitattributes` forces LF line endings, so prettier checks and the byte-identical article hold on Windows, and the `check` workflow runs on Ubuntu, macOS and Windows.
- `pnpm typecheck` (TypeScript, `tsconfig.json`), run in the `check` workflow.

### Changed

- The article's description says a human "approves every chunk of content" instead of "gates every line", matching the README.
- The spec abstract points to both example setups instead of calling `examples/julien` the reference implementation.
- Pipelining in P3 now uses a linked `git worktree` instead of a scratch copy under `/private/tmp`, in the spec, the reference `CLAUDE.md` and the article. The agent prepares at most one chunk ahead.
- `scripts/publish-post.mjs` is now `scripts/publish-post.ts`, run directly by Node's type stripping, and diffs with `git diff --no-index` instead of the system `diff`.

### Removed

- The macOS-only `/private/tmp` known deviation.

## [0.1.0] - 2026-09-26

### Added

- `scripts/publish-post.mjs`, run by two workflows: the `post` job in `check` prints the diff between `article/hug-flow.md` and the live post on pull requests, and `publish` publishes it through blog-mcp on every push to `main` when they differ, then waits up to 5 minutes for the live post to match. Needs the `MCP_BEARER_TOKEN` repository secret.
- Article §9 and §11: the editor workflow and machine requirements from the reference setup, and a link to its files in `examples/julien`.
- `/check-article` skill: reports what the post is missing, or has out of date, given the repo.
- Project `CLAUDE.md`: run `/check-article` right before each pull request's changelog chunk, and fix any drift in the article.
- Link to this repository in §1 of the published article.
- `article/hug-flow.md`: the [published article](https://julienberanger.com/hug-flow), kept verbatim from its `/raw` endpoint and excluded from prettier.
- `/update-post` project skill: pushes `article/hug-flow.md` to the blog, or pulls the live post into the repo, through the JB Blog Post connector (blog-mcp).
- `notes/` added to `.gitignore`.
- `spec/hug-flow.md`: the HuG Flow specification, extracted from the original article (sections 1 to 8 and the ADLC comparison), with an RFC header and abstract.
- `examples/julien/`: reference setup on VS Code, Claude Code and GitHub, with the global `CLAUDE.md`, the `super-app-issue` intake skill, Claude Code `settings.json`, a `repo-settings.sh` script and a README covering the stack, the three layers, enforcement, coverage and known deviations.
- MIT license, prettier check pipeline and a GitHub Actions workflow running it on pull requests.

### Removed

- `/update-post` skill, replaced by the `publish` workflow.

[Unreleased]: https://github.com/julienbrg/hug/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/julienbrg/hug/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/julienbrg/hug/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/julienbrg/hug/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/julienbrg/hug/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/julienbrg/hug/releases/tag/v0.1.0
