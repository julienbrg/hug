# HuG

Human-Gated Flow

HuG Flow is an issue-driven development lifecycle for building software with a coding agent. The agent runs every process step (issue, branch, commit, push, pull request, merge) without asking permission. The human maintainer approves every chunk of content by staging it in the Git index, and nothing enters the history unreviewed.

It extends the [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow) with an explicit division of labor between a human and an agent: **process autonomy, content control**.

Original article: <https://julienberanger.com/hug-flow>

## Contents

| Path                                                                     | What it is                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [`spec/hug-flow.md`](spec/hug-flow.md)                                   | The specification: roles, artifacts, lifecycle phases, approval matrix, invariants               |
| [`article/hug-flow.md`](article/hug-flow.md)                             | The [published article](https://julienberanger.com/hug-flow), verbatim                           |
| [`.claude/skills/check-article/`](.claude/skills/check-article/SKILL.md) | `/check-article`: reports what the post is missing, or has out of date, given the repo           |
| [`scripts/publish-post.mjs`](scripts/publish-post.mjs)                   | Publishes the article to the blog; run by the `publish` workflow when it changes on `main`       |
| [`examples/julien/`](examples/julien/README.md)                          | A reference setup on VS Code, Claude Code and GitHub: `CLAUDE.md`, an intake skill, settings, CI |

## The flow in one paragraph

A request becomes an issue. The agent branches from `main`, then writes one small chunk at a time and leaves it unstaged. The maintainer reads the diff in the editor and stages what they approve. The agent runs the format check and the linter, commits exactly what was staged, pushes, and starts the next chunk. A pull request is open from the first push. When the work is done and CI is green, the agent squash-merges, cleans up, and reports.

## Contributing

This repository is maintained with HuG Flow. Open an issue, or a pull request from a branch linked to one. The check pipeline is `pnpm format:check`.

## License

[MIT](LICENSE)
