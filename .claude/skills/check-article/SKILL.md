---
name: check-article
description: Check whether article/hug-flow.md, the verbatim copy of the published HuG Flow post, is missing anything or out of date given the current repo content, and report what the post needs. Use when the user types /check-article, and right before the CHANGELOG.md chunk of every pull request in this repo.
---

# Check the article against the repo

`article/hug-flow.md` is published to <https://julienberanger.com/hug-flow>
by CI when it changes on `main`. The repo is the source of truth: the
question is **is the post missing anything, or still saying something the
repo has changed?**

This skill reports only. It never edits, stages or commits. Fixes always
go to `article/hug-flow.md`, never to the repo files it was compared with.

## Order

1. `git diff --name-only main...HEAD` (plus uncommitted changes): check
   the files this pull request changed first. That is where drift comes from.
2. Then walk the whole map below. Read both sides in full; don't sample.
3. Then any tracked file not in the map (`git ls-files`): if it adds or
   changes something the post describes, or should describe, it's a finding.

## Map

| Repo                                              | Article                                   |
| ------------------------------------------------- | ----------------------------------------- |
| `spec/hug-flow.md` §1 to §8                       | §1 to §8                                  |
| `spec/hug-flow.md` §9 Relationship to the ADLC    | §10                                       |
| `examples/julien/README.md`, Stack                | §9 Stack                                  |
| `examples/julien/README.md`, other sections       | §11 intro, 11.1 to 11.5 prose and tables  |
| `examples/julien/CLAUDE.md`                       | §11.1 code block, character for character |
| `examples/julien/skills/super-app-issue/SKILL.md` | §11.2 code block, character for character |
| `examples/julien/settings.json`                   | §11.3 settings JSON and deny rules        |
| `examples/julien/repo-settings.sh`                | §11.3 `gh repo edit` / `gh api` block     |
| `README.md` intro, `package.json` `description`   | Frontmatter `title`, `description`        |
| Further reading in the spec and examples README   | Further reading                           |

## Expected differences

Don't report these:

- The spec's header table and Abstract, and its links to `examples/julien/`.
- Section numbers shifted by the removal of §9 Stack from the spec.
- First person ("I", "my setup") in the article vs neutral wording in the spec.
- Wording that points to a file in the repo where the article quotes it
  inline ("Here it is as I use it", "applies them from the command line").
- `examples/julien/settings.json` merging today's settings with the deny
  rules the article presents as additions.
- `repo-settings.sh` taking `<owner>/<repo>` where the article uses `{owner}/{repo}`.
- The article's line pointing to this repository.
- Markdown formatting that prettier applies to the repo but not to `article/`
  (table padding, list markers, emphasis style) when the text is the same.

## Report

If the post is up to date, say so in one line.

Otherwise, one table, most important first:

| Repo | Article | Missing or outdated |
| ---- | ------- | ------------------- |

Give the repo location as a clickable `path:line` and the article location
as `§n` plus a short quote (or "nowhere" when it's missing). Then propose
the edit to `article/hug-flow.md` as the next chunk, to go through the
usual review loop.
