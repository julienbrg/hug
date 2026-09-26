# HuG repo

`article/hug-flow.md` is the verbatim source of the post at
<https://julienberanger.com/hug-flow>. The spec (`spec/`) and the reference
setup (`examples/julien/`) were extracted from it.

## Article

- Never reformat `article/`: it must stay byte-identical to the live post's
  `/raw` page. It is in `.prettierignore` for that reason.
- Don't publish the post by hand. The `publish` workflow runs
  `scripts/publish-post.mjs` when `article/hug-flow.md` changes on `main`,
  and fails if the live post doesn't match the file afterwards.

## Consistency check

Right **before** writing the CHANGELOG.md chunk of a pull request (workflow
step 9), run `/check-article`, whatever the pull request touched. It asks
whether the post is missing anything, or out of date, given the repo.

- No drift: write the changelog chunk.
- Drift: report it, then write the fix to `article/hug-flow.md` as its own
  chunk through the stage-then-commit loop. The fix always goes to the
  article, never to the repo files it was compared with. Run `/check-article`
  again once it's committed, and write the changelog chunk only when the
  check is clean.
