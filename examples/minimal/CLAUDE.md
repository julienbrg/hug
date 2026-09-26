# Task confirmation

Before starting any non-trivial task, restate my request as a short
spec: what you understood, what you're about to do, and the files you
expect to create, modify or delete. Wait for my confirmation. Accept
"go", "yes" or anything equivalent.

Once confirmed, run the task end-to-end without further permission
prompts or check-ins. The one exception is the stage-then-commit loop
below. Skip the confirmation for trivial asks (reading a file,
answering a question).

# Attribution

Never add `Co-Authored-By` trailers or "Generated with" footers to
commits, pull requests or issue comments. I am the sole author.

# Workflow

The repository is hosted on GitHub and `gh` is logged in. If there is
no `origin` remote, commit locally only and ask before adding one.

1. Check for uncommitted or untracked changes. If there are any,
   recap them and ask whether to keep them or stash them. Keep going
   while I answer, and resolve it before step 3. Kept changes go
   through the stage-then-commit loop with the new work.
2. If the task comes from an existing issue, use it. Otherwise create
   one (see Issues).
3. Create the branch from `main` and check it out:
   `gh issue develop <number> --checkout`.
4. Commit through the [stage-then-commit loop](#stage-then-commit-loop),
   and push after each commit.
5. After the first push, open the pull request (see Pull requests).
   Later commits push to the same branch.
6. After the last code commit, write one final chunk with the
   `CHANGELOG.md` entry for the whole pull request (create the file in
   [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format if
   it doesn't exist), together with any docs and `README.md` changes.
   It goes through the loop like any other chunk.
7. Wait for the checks: `gh pr checks <number> --watch`. If one fails,
   fix the cause through the loop and push. Never merge on a red or
   still-running check, even if the diff looks harmless. If the
   repository has no CI, run the full local pipeline (tests,
   typecheck, build) instead, and never merge on a failure.
8. Merge: `gh pr merge <number> --squash --delete-branch`.
9. `git checkout main && git pull`. If the branch survived the merge,
   delete it locally and on the remote.

Report the issue number, branch, pull request number and merge result
as you go, so I can see what happened and intervene.

# Stage-then-commit loop

**Whoever did not write a chunk approves it by staging it, and the
author then commits exactly what was staged.** Nobody stages their own
work, and nothing is committed unreviewed.

Before committing, run the project's check pipeline: the format check
and the linter only, with whatever tools the project uses (see
Tooling). Tests, typecheck and build run in CI. If the pipeline
passes, commit exactly what is staged. If it fails,
`git restore --staged` the affected files, say what failed and why,
and leave the fix to whoever staged it. Never modify staged changes you
didn't write, and never commit on a failing check.

When you write a chunk (code, tests, docs, config, anything):

- Write one logical chunk, small enough to read in one sitting. Leave
  it unstaged, say in one line what it is, and stop.
- Never run `git add` on your own work, and never `git add -A` or
  `git add .`.
- I review the diff in my editor and stage what I approve.
- Right after leaving a chunk unstaged, start a background watcher,
  such as
  `until [ -n "$(git diff --cached --name-only)" ]; do sleep 5; done`.
  When something is staged, run the check pipeline, commit, push, and
  start the next chunk. Start a fresh watcher after every commit.
- If I stage only part of a chunk, commit that part and leave the rest
  unstaged.
- A question from me doesn't pause the loop. Answer it, then check
  `git status` in the same turn, and commit anything staged. Never end
  a turn with staged changes left uncommitted.
- If I reject a chunk, propose a fix and wait for my confirmation
  before rewriting it.

When I write a chunk, I leave it unstaged and tell you. You review it,
stage what you approve, and I commit.

While I review chunk N, you may write chunk N+1 in a linked worktree
outside the repository (`git worktree add --detach <path> HEAD`), on
top of a local copy of chunk N. Install dependencies there rather than
linking them. Once chunk N is committed, apply the worktree's diff to
the repository (`git -C <path> diff HEAD | git apply`) as the next
unstaged chunk. Stay one chunk ahead, no more. Remove the worktree when
the work is done.

# Issues

- Title starts with a capitalized imperative verb: `Add`, `Fix`,
  `Improve` or `Remove`. e.g. `Add passkey recovery flow`.
- The body says what the task is, why, and what done looks like.
- Assign it to me (`--assignee @me`) and label it `enhancement` or
  `bug`.

# Pull requests

- Title identical to the issue title.
- Body contains `Closes #<number>`, so merging closes the issue.
- Assign it to me (`--assignee @me`).
- Never push to `main`. Never force-push a shared branch.

# Commits

- One logical change per commit.
- Short, lowercase, imperative title, no trailing period. e.g.
  `add recovery route`.
- No body unless the change needs explaining.

# Tooling

Detect the project's tools before running checks, and use what it
already uses: its package manager and lockfile, its format and lint
scripts (`package.json`, `Makefile`, `pyproject.toml`, `foundry.toml`,
and so on). If it has no format check or linter, say so and commit
without one.
