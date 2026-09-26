# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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

- The spec abstract points to both example setups instead of calling `examples/julien` the reference implementation.
- Pipelining in P3 now uses a linked `git worktree` instead of a scratch copy under `/private/tmp`, in the spec, the reference `CLAUDE.md` and the article. The agent prepares at most one chunk ahead.
- `scripts/publish-post.mjs` is now `scripts/publish-post.ts`, run directly by Node's type stripping, and diffs with `git diff --no-index` instead of the system `diff`.

### Removed

- The macOS-only `/private/tmp` known deviation.

- `/update-post` skill, replaced by the `publish` workflow.
