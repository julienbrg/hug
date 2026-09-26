---
name: update-post
description: Sync article/hug-flow.md with the live HuG Flow post on julienberanger.com through the JB Blog Post connector (blog-mcp) — push the local version to the blog, or pull the live one into the repo. Use when the user types /update-post, or asks to publish, push, republish, pull or sync the hug-flow article.
argument-hint: "[push|pull]"
disable-model-invocation: true
---

# Sync the hug-flow article

`article/hug-flow.md` is the verbatim source of <https://julienberanger.com/hug-flow>.
The post lives in the blog database behind the **JB Blog Post** connector
(`../blog-mcp`), keyed by slug `hug-flow`. Never change the slug: the
upsert would create a second post instead of updating this one.

Direction comes from the argument: `push` (default) sends the local file to
the blog, `pull` writes the live post into the repo.

## Frontmatter mapping

The `/raw` endpoint renders the database row as Markdown. Fields map like this:

| `article/hug-flow.md`                                                                               | `posts_upsert`                               |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `title`, `description`, `date`, `author`, `model`, `conversation`, `image`, `image_alt`, `unlisted` | same name                                    |
| `lang`                                                                                              | `locale`                                     |
| `source`                                                                                            | not stored, derived from the slug; ignore it |
| body after the closing `---`                                                                        | `content`                                    |

## Push

1. Read `article/hug-flow.md` and split it into frontmatter and body.
2. Fetch the live version: `curl -sSfL https://julienberanger.com/hug-flow/raw`.
   If it matches the local file, say so and stop.
3. Show the user a `diff` of live vs local and a one-line summary of what
   changes. Wait for their go: publishing is outward-facing.
4. Load the connector (`ToolSearch` "JB Blog Post") and call `posts_upsert`
   with `slug: hug-flow`, `content` set to the body, and every field from the
   mapping above. Carry `image`, `image_alt` and `unlisted` over from the
   live version when the local file lacks them, so the upsert doesn't wipe them.
5. Fetch `/raw` again and `diff` it against the local file. Report any
   remaining difference plainly; don't claim success on a failed upsert.

## Pull

1. Fetch `https://julienberanger.com/hug-flow/raw` into `article/hug-flow.md`
   as is — no reformatting (`article/` is in `.prettierignore` for this reason).
2. Show `git diff --stat article/` and leave the change unstaged for review.

## After either direction

If the article changed in a way that affects the spec, point out which
sections of `spec/hug-flow.md` may need the same edit. Don't edit the spec
from this skill: spec changes go through their own PR.
