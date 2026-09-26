# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Link to this repository in §1 of the published article.
- `article/hug-flow.md`: the [published article](https://julienberanger.com/hug-flow), kept verbatim from its `/raw` endpoint and excluded from prettier.
- `/update-post` project skill: pushes `article/hug-flow.md` to the blog, or pulls the live post into the repo, through the JB Blog Post connector (blog-mcp).
- `notes/` added to `.gitignore`.
- `spec/hug-flow.md`: the HuG Flow specification, extracted from the original article (sections 1 to 8 and the ADLC comparison), with an RFC header and abstract.
- `examples/julien/`: reference setup on VS Code, Claude Code and GitHub, with the global `CLAUDE.md`, the `super-app-issue` intake skill, Claude Code `settings.json`, a `repo-settings.sh` script and a README covering the stack, the three layers, enforcement, coverage and known deviations.
- MIT license, prettier check pipeline and a GitHub Actions workflow running it on pull requests.
