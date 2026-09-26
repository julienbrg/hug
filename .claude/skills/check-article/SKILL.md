---
name: check-article
description: Check that article/hug-flow.md, the verbatim copy of the published HuG Flow post, is consistent with the rest of the repo (spec, examples, README) and report every divergence. Use when the user types /check-article, and right before the CHANGELOG.md chunk of every pull request in this repo.
---

# Check the article against the repo

`article/hug-flow.md` is published to <https://julienberanger.com/hug-flow>
by CI when it changes on `main`. The rest of the repo was extracted from it,
so the two drift apart whenever one side is edited alone. This skill finds
that drift. It **reports only**: it never edits a file, stages or commits.

## Map

Compare each pair. Read both sides in full; don't sample.

| Article                               | Repo                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| Frontmatter `title`, `description`    | `README.md` intro, `package.json` `description`               |
| §1 to §8                              | `spec/hug-flow.md` §1 to §8                                   |
| §9 Stack                              | `examples/julien/README.md`, Stack                            |
| §10 Relationship to the ADLC          | `spec/hug-flow.md` §9                                         |
| §11 intro, 11.3 to 11.5               | `examples/julien/README.md`, matching sections                |
| §11.1 `CLAUDE.md` code block          | `examples/julien/CLAUDE.md`, character for character          |
| §11.2 skill code block                | `examples/julien/skills/super-app-issue/SKILL.md`, same       |
| §11.3 Claude Code settings JSON       | `examples/julien/settings.json`                               |
| §11.3 `gh repo edit` / `gh api` block | `examples/julien/repo-settings.sh`                            |
| Further reading                       | Further reading in `spec/hug-flow.md` and the examples README |

## Expected differences

Don't report these:

- The spec's header table and Abstract, and its links to `examples/julien/`.
- Section numbers shifted by the removal of §9 Stack from the spec.
- First person ("I", "my setup") in the article vs neutral wording in the spec.
- The article's line pointing to this repository.
- Markdown formatting that prettier applies to the repo but not to `article/`
  (table padding, list markers, emphasis style) when the text is the same.

Everything else is a finding: a rule, step, number, name, command, link or
invariant that exists on one side only or says something different.

## Report

If there is no drift, say so in one line.

Otherwise, one table, most important first:

| Article | Repo | Difference |
| ------- | ---- | ---------- |

Give the article location as `§n` plus a short quote, and the repo location
as a clickable `path:line`. Don't decide which side is right: the pull
request's diff usually tells (the side it touched is the new one). Say which
side the diff points to when it does, and propose the edit to the other side
as the next chunk, to go through the usual review loop.
