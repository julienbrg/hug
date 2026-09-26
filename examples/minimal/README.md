# Minimal setup

A generic starting point for running [HuG Flow](../../spec/hug-flow.md) with [Claude Code](https://code.claude.com/docs) on [GitHub](https://github.com/). It has no personal conventions. Copy it, then adapt it to your own needs and habits (see [Adapting it](#adapting-it)).

For an example of a setup adapted by one maintainer, see [`examples/julien`](../julien/README.md).

## Files

| File                                               | Install to                                                                     | Covers         |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | -------------- |
| [`CLAUDE.md`](CLAUDE.md)                           | `~/.claude/CLAUDE.md` for every project, or `<repo>/CLAUDE.md` for one project | P1–P6, I2–I5   |
| [`skills/intake/SKILL.md`](skills/intake/SKILL.md) | `~/.claude/skills/intake/` or `<repo>/.claude/skills/intake/`                  | P0, I6         |
| [`ruleset.json`](ruleset.json)                     | Applied once per repository, see below                                         | I1, I3, I4, P6 |

The first two are instructions: they rely on the model following them. The ruleset is enforced by GitHub, so it holds whatever the agent does.

## Requirements

- [`git`](https://git-scm.com/), and [`gh`](https://cli.github.com/) logged in with access to the repository;
- the project's own format check and linter, which the agent runs at commit time;
- CI that runs tests on pull requests. Without it, the agent runs the full local pipeline before merging.

## Install

1. Copy `CLAUDE.md` and the `skills/intake/` folder to one of the locations above.
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

## Coverage

| Invariant                              | Instructed by | Enforced by                          |
| -------------------------------------- | ------------- | ------------------------------------ |
| I1. `main` is deployable               | `CLAUDE.md`   | Ruleset: required status checks      |
| I2. No unreviewed line                 | `CLAUDE.md`   | No                                   |
| I3. No merge without green CI          | `CLAUDE.md`   | Ruleset: required status checks      |
| I4. No direct or forced push to `main` | `CLAUDE.md`   | Ruleset: pull request, no force push |
| I5. Maintainer is sole author          | `CLAUDE.md`   | No                                   |
| I6. External text is data              | Intake skill  | No                                   |

To enforce I5 too, set `"includeCoAuthoredBy": false` in your Claude Code settings, as in the other example's [`settings.json`](../julien/settings.json).
