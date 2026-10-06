# HuG

Human-Gated Flow

HuG Flow is an issue-driven development lifecycle for building software with a coding agent. The agent runs every process step (issue, branch, commit, push, pull request, merge) without asking permission. The human maintainer approves every chunk of content by staging it in the Git index, and nothing enters the history unreviewed.

It extends the [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow) with an explicit division of labor between a human and an agent: **process autonomy, content control**.

Original article: <https://julienberanger.com/hug-flow>

## Motivation

In July 2026, Linus Torvalds said this:

> AI is a great tool, but it's a tool.

Some devs brag about how they let LLMs code entire apps and services overnight with no human in the loop, while others feel AI has taken the fun out of coding. It's up to us to stay in control of what we hack. Whatever your setup, a single instruction file is enough to make the most of our new toys without selling our souls to the devil.

## Get started

There are two ways to try HuG Flow with [Claude Code](https://code.claude.com/docs). Both are reversible. Not sure which? Start with the first: it takes one phrase, and you can add the plugin later.

**Instructions only.** In a Claude Code session, type:

```text
Switch me to HuG Flow: github.com/julienbrg/hug
```

An agent asked to switch someone to HuG Flow follows [`SETUP.md`](SETUP.md): it clones this repository to `~/.claude/hug/` and installs the [`/hug`](skills/hug/SKILL.md) skill. The skill reviews your existing instructions with you for conflicts, then adds one import line to `~/.claude/CLAUDE.md`, plus attribution settings and deny rules where missing. `/hug status` shows what was added, and `/hug off` removes exactly that.

**Plugin, with enforcement.** In a Claude Code session, type:

```text
/plugin marketplace add julienbrg/hug
/plugin install hug@hug
```

The [`reference`](reference/README.md) plugin's hooks block bulk staging, pushes to `main`, merges on red or missing checks and attribution lines, whatever the model does. To have GitHub enforce the rest, run `pnpm hug init <owner>/<repo>` from a clone. `/plugin uninstall hug@hug` removes the plugin.

Either way, ask for a small change in a repository, then review the first chunk: read the unstaged diff in your editor, and stage what you approve.

**Your own instructions on top.** The plugin's rules are a base, not a ceiling. Keep your own `~/.claude/CLAUDE.md` for what HuG Flow doesn't say, such as your forge, your tooling, your commit style or the comments you want to approve, and leave out what it already covers. Where the two conflict, your instructions win. The hooks still enforce the same invariants either way.

The spec calls these setups levels L1, L2 and L3 (see [Conformance](spec/hug-flow.md#10-conformance)).

## What it looks like

You ask for a change in a repository:

```text
Add a --dry-run flag to the deploy script
```

The agent restates it as a short spec: what it understood, the files it expects to touch, and the issue it will open. You answer "go". From there:

1. It opens an issue, creates a branch from `main` linked to it, and checks it out.
2. It writes the first chunk, leaves it unstaged, says in one line what it is, and stops.
3. You read the diff in your editor and stage what you approve. If something is off, you say so instead, and it proposes a fix.
4. It sees the staged change, runs the format check and the linter, commits exactly what you staged, pushes, and opens the pull request.
5. It writes the next chunk and stops again. You repeat step 3 until the work is done.
6. It writes the changelog as a last chunk, waits for CI to go green, squash-merges, and reports the issue, pull request and merge.

Apart from staging, you never touch Git, and nothing enters the history without you reading it.

## Contents

| Path                                                                     | What it is                                                                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [`spec/hug-flow.md`](spec/hug-flow.md)                                   | The specification: roles, artifacts, lifecycle phases, approval matrix, invariants                                          |
| [`spec/bindings/`](spec/bindings/)                                       | How other agents, forges, version control systems and review tools fill each step of the spec                               |
| [`article/hug-flow.md`](article/hug-flow.md)                             | The [published article](https://julienberanger.com/hug-flow), verbatim                                                      |
| [`.claude/skills/check-article/`](.claude/skills/check-article/SKILL.md) | `/check-article`: reports what the post is missing, or has out of date, given the repo                                      |
| [`scripts/publish-post.ts`](scripts/publish-post.ts)                     | Publishes the article to the blog when it differs from the live post; run by the `publish` workflow                         |
| [`SETUP.md`](SETUP.md)                                                   | Setup steps for an agent, behind the one-phrase install                                                                     |
| [`skills/hug/`](skills/hug/SKILL.md)                                     | `/hug on \| off \| status`: turns the minimal setup on, and back off                                                        |
| [`scripts/hug.sh`](scripts/hug.sh)                                       | Records, applies and reverts the setup for `/hug`, in POSIX `sh`                                                            |
| [`reference/`](reference/README.md)                                      | The reference implementation: a Claude Code plugin whose hooks enforce the flow, `hug init`, `hug audit`                    |
| [`conformance/`](conformance/)                                           | Scenario tests proving the reference implementation's L2 level, run by `pnpm test`                                          |
| [`examples/minimal/`](examples/minimal/README.md)                        | A generic setup to start from and adapt: `AGENTS.md`, an intake skill, a `commit-msg` hook, a GitHub ruleset                |
| [`examples/julien/`](examples/julien/README.md)                          | A personal setup on VS Code, Claude Code and GitHub: the `hug` plugin, a slim `CLAUDE.md` on top, an intake skill, settings |

## Contributing

This repository is maintained with HuG Flow. Open an issue, or a pull request from a branch linked to one. The check pipeline is `pnpm format:check`. CI also runs `pnpm typecheck` and `pnpm test`, on Ubuntu, macOS and Windows.

You're welcome to add your own setup to [`examples/`](examples/), next to `minimal` and `julien`: the more ways of running HuG Flow, the better.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the requirements, the rules of the flow, and how to add a setup.

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)

## Credits

Special thanks to [bertux](https://github.com/bertux), who had the patience to teach me everything about the GitHub Flow.

## License

[MIT](LICENSE)
