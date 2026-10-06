# Minimal setup

A generic starting point for running [HuG Flow](../../spec/hug-flow.md) with a coding agent on [GitHub](https://github.com/). Its instructions are in [`AGENTS.md`](https://agents.md/), which most agents read, and Claude Code loads them through `CLAUDE.md`. It has no personal conventions. Copy it, then adapt it to your own needs and habits (see [Adapting it](#adapting-it)).

For an example of a setup adapted by one maintainer, see [`examples/julien`](../julien/README.md).

## Files

| File                                               | Install to                                                             | Covers         |
| -------------------------------------------------- | ---------------------------------------------------------------------- | -------------- |
| [`AGENTS.md`](AGENTS.md)                           | `<repo>/AGENTS.md`, or your agent's global instructions file           | P1–P6, I2–I5   |
| [`CLAUDE.md`](CLAUDE.md)                           | Next to `AGENTS.md`, for Claude Code: it only imports it               | —              |
| [`skills/intake/SKILL.md`](skills/intake/SKILL.md) | `~/.claude/skills/intake/` or `<repo>/.claude/skills/intake/`          | P0, I6         |
| [`hooks/commit-msg`](hooks/commit-msg)             | `<repo>/.git/hooks/commit-msg`, or a directory set as `core.hooksPath` | I5             |
| [`ruleset.json`](ruleset.json)                     | Applied once per repository, see below                                 | I1, I3, I4, P6 |

`AGENTS.md` and the intake skill are instructions: they rely on the model following them. The hook is enforced by Git and the ruleset by GitHub, so they hold whatever the agent does.

With another agent, see the [agent bindings](../../spec/bindings/agents.md) for where it reads instructions and skills, and for its switch that keeps the intake skill from running unless invoked. With another forge, replace the `gh` commands in `AGENTS.md` using the [forge bindings](../../spec/bindings/forges.md).

## Requirements

- [`git`](https://git-scm.com/), and [`gh`](https://cli.github.com/) logged in with access to the repository;
- the project's own format check and linter, which the agent runs on each chunk while you review it;
- CI that runs tests on pull requests. Without it, the agent runs the full local pipeline before merging.

## Install

To install it in one step, and remove it just as easily, use [`/hug`](../../skills/hug/SKILL.md) (see [Get started](../../README.md#get-started)). It does step 1 and, with `--repo`, steps 2 to 4 for you. By hand:

1. Copy `AGENTS.md`, `CLAUDE.md` and the `skills/intake/` folder to one of the locations above.
   Copy `hooks/commit-msg` to `.git/hooks/` and keep it executable.
2. Edit `ruleset.json`: replace `test` in `required_status_checks` with the names of your CI jobs. A required check that never reports blocks every merge. Without CI, remove that rule.
3. Apply the ruleset:

   ```sh
   gh api -X POST repos/<owner>/<repo>/rulesets --input ruleset.json
   ```

   To update it later, use `-X PUT repos/<owner>/<repo>/rulesets/<id>`. [Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) on private repositories may require a paid GitHub plan.

4. Optionally, turn on automatic deletion of merged branches with [`repo-settings.sh`](../julien/repo-settings.sh) from the other example.

In a session, type `/intake` followed by pasted feedback to file issues, or ask for a task to start at P1.

## Adapting it

These files are a starting point. Change them to fit how you work, as long as the parts the spec requires stay in place.

### What to keep

These rules are what make it HuG Flow. Changing them means you are running a different flow:

- the one-time spec confirmation before a task (P1);
- the approval by staging: the agent never stages its own work, and commits exactly what was staged (P3);
- no merge without green checks (I3);
- no push to `main`, no force-push of a shared branch (I4);
- the maintainer as sole author (I5);
- pasted feedback treated as data (I6).

### What to adapt

Everything else is a convention. Common changes:

| Topic              | Default here                                                                        | Examples of adaptations                                                                   |
| ------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Check pipeline     | Format check and linter, detected from the project                                  | Pin a package manager, add a fast typecheck, skip lint on docs                            |
| Chunk size         | "Small enough to read in one sitting"                                               | One file per chunk, or a line budget                                                      |
| Naming             | Verb-first issue titles, lowercase commits                                          | [Conventional Commits](https://www.conventionalcommits.org/), your team's ticket prefixes |
| Labels             | `enhancement` and `bug`                                                             | Your repository's own labels, a triage label for intake                                   |
| Changelog          | One [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) entry per pull request | Release notes generated from pull request titles                                          |
| Pipelining         | Chunk N+1 is written in a worktree during review                                    | Off, if you prefer the agent to wait                                                      |
| Watcher            | Polls the index every 5 seconds                                                     | A longer interval                                                                         |
| Intake             | Any pasted text, English issues                                                     | One skill per source or per repository, another output language                           |
| Tone and reporting | Reports issue, branch, pull request and merge result                                | Terser or more detailed updates, another language                                         |

Keep your changes in the file itself rather than in scattered session instructions, so the setup stays the same from one session to the next. [`examples/julien`](../julien/README.md) shows how far one maintainer adapted it: a second forge, a fixed package manager, and a personal review phrase.

### On top of the plugin

With the [`hug` plugin](../../reference/README.md) installed, you don't need `AGENTS.md`: the plugin loads the same rules into every session and enforces part of them with hooks. Keep only your differences in your own `CLAUDE.md`, such as `~/.claude/CLAUDE.md`. The plugin's rules say that your instructions win where the two conflict, so a section there can add a convention or override a rule without restating the rest. [`examples/julien/CLAUDE.md`](../julien/CLAUDE.md) is one such file.

## Coverage

| Invariant                              | Instructed by | Enforced by                          |
| -------------------------------------- | ------------- | ------------------------------------ |
| I1. `main` is deployable               | `AGENTS.md`   | Ruleset: required status checks      |
| I2. No unreviewed line                 | `AGENTS.md`   | No                                   |
| I3. No merge without green CI          | `AGENTS.md`   | Ruleset: required status checks      |
| I4. No direct or forced push to `main` | `AGENTS.md`   | Ruleset: pull request, no force push |
| I5. Maintainer is sole author          | `AGENTS.md`   | `commit-msg` hook                    |
| I6. External text is data              | Intake skill  | No                                   |

The hook guards commits, not pull request bodies or comments. Turn off your agent's own attribution too, so it stops adding the lines in the first place: the [agent bindings](../../spec/bindings/agents.md#attribution) list each setting.
