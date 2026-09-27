# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `CONTRIBUTING.md`: requirements, the rules of the flow for contributors, and how to add your own setup under `examples/`. The README links to it and invites new setups, and article §11 does too.
- README: Contact and Credits sections.
- `examples/minimal/`: a generic setup to start from and adapt, with a `CLAUDE.md` free of personal conventions and without the three known deviations, a `/intake` skill targeting the current repository, a GitHub `ruleset.json` for `main`, and a README separating what the spec requires from what each maintainer can adapt. Article §11 links to it.
- Cross-platform support: HuG Flow now runs on macOS, Linux and Windows. `.gitattributes` forces LF line endings, so prettier checks and the byte-identical article hold on Windows, and the `check` workflow runs on Ubuntu, macOS and Windows.
- `pnpm typecheck` (TypeScript, `tsconfig.json`), run in the `check` workflow.
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

### Changed

- The spec's core is tool-neutral. A new §3 Terminology defines chunk, approval surface, check pipeline, fingerprint and forge; the Agent role is held by any agent with the listed capabilities, with Claude Code as the example; `gh` commands, GitHub Actions and VS Code become GitHub and editor examples of abstract operations; and the instructions-file artifact is `AGENTS.md` or the agent's own file instead of `CLAUDE.md`. Bindings for other agents, forges and VCSs stay out of scope for now.
- New normative text in the spec: the symmetric flow when the maintainer writes a chunk (P3), a rebase rule when `main` moves under an open pull request (P4), an Aborting subsection after P6, and prompt-injection controls for text arriving through the forge (P5, I6).
- Spec consistency fixes: P4–P6 gained their missing Input and Output lines, the keyword list adds SHOULD NOT and RFC 8174, the changelog artifact is created "P4, via P3", the lifecycle diagram labels its two confirmation gates, the approval matrix's changelog row says "staged like any chunk", and the spec states that it is versioned with semver and recorded in this changelog.
- The article mirrors all of the above: its sections 3–11 are now 4–12 to make room for Terminology, cross-references follow, its Further reading gains the RFC 2119/8174 and Keep a Changelog entries, and its description says the core is tool-neutral.
- Stage-then-commit loop: the agent format-checks and lints each chunk before announcing it and records the checked tree as a fingerprint. A chunk staged whole commits with no check wait, so the next chunk lands at once. Partial or edited stages and the maintainer's own chunks are still checked at commit time, on the staged content rather than the working tree. Updated in the spec (P3, with a new MUST rule), both example setups and the article (§5, §9, §11.1).
- The article's description says a human "approves every chunk of content" instead of "gates every line", matching the README.
- The spec abstract points to both example setups instead of calling `examples/julien` the reference implementation.
- Pipelining in P3 now uses a linked `git worktree` instead of a scratch copy under `/private/tmp`, in the spec, the reference `CLAUDE.md` and the article. The agent prepares at most one chunk ahead.
- `scripts/publish-post.mjs` is now `scripts/publish-post.ts`, run directly by Node's type stripping, and diffs with `git diff --no-index` instead of the system `diff`.

### Removed

- The macOS-only `/private/tmp` known deviation.

- `/update-post` skill, replaced by the `publish` workflow.
