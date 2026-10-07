# Task confirmation

Before starting any non-trivial task, restate my request as a short
spec: what you understood, what you're about to do, the files you
expect to create, modify or delete, and the suggested issue title and
description. End it with "Merge the pull request once its checks are
green." Wait for my confirmation. Accept "go", "yes" or anything
equivalent. My confirmation approves the issue title and description,
and the merge, too.

Once confirmed, run the task end-to-end without further permission
prompts or check-ins. The exceptions are the stage-then-commit loop
and the comment approvals below. Skip the confirmation for trivial asks (reading a file,
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

The project's check pipeline is the format check and the linter
only, with whatever tools the project uses (see Tooling). Tests,
typecheck and build run in CI. Commit only staged content that passed
it: run it on your chunks as soon as they appear as unstaged changes,
while I review them, and at commit time
on anything staged that differs from what you checked (my chunks,
partial or edited stages), reading the staged content
(`git show :<file>`), not the working tree. If it fails,
`git restore --staged` the affected files, say what failed and why,
and leave the fix to whoever staged it. Never modify staged changes you
didn't write, and never commit on a failing check.

When you write a chunk (code, tests, docs, config, anything):

- Write one logical chunk, small enough to read in one sitting. Leave
  it unstaged, say in one line what it is, and stop.
- The moment it's on disk, in one command, record the tree it would
  commit as, built in a throwaway index
  (`GIT_INDEX_FILE=<literal tmp path> sh -c 'git read-tree HEAD && git add -A && git write-tree'`),
  and run the check pipeline on it. Keep the recorded tree only if the
  check passes. If it fails, tell me, fix it as new unstaged changes,
  and check again.
- Never run `git add` on your own work, and never `git add -A` or
  `git add .`. To move or delete a file, use plain `mv` or `rm`, not
  `git mv` or `git rm`, and leave both paths unstaged.
- I review the diff in my editor and stage what I approve.
- Right after leaving a chunk unstaged, start a background watcher,
  such as
  `until [ -n "$(git diff --cached --name-only)" ]; do sleep 1; done`.
  When something is staged, compare `git write-tree` with the recorded
  tree in the same command as the commit. If they match, commit right
  away; otherwise run the check pipeline on the staged content first. Then push and start the next
  chunk. Start a fresh watcher after every commit.
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
outside the repository (`git worktree add --detach <path> HEAD`).
Seed it with chunk N from its recorded tree
(`git diff --binary HEAD <TN> | git -C <path> apply`), and install
dependencies there rather than linking them. Once chunk N is staged, in
a single command, commit it, record the worktree's tree as `<TN1>` the
same way, in a throwaway index, and apply the difference to the
repository (`git diff --binary <TN> <TN1> | git apply`) as the next
unstaged chunk, finished or not. Push chunk N last. The diff between
the two trees carries new, deleted and renamed files, and still applies
once chunk N is committed. If it is unfinished, say so and finish it
in place.
Once it is complete, record and check it, and say it is ready for
review. Stay one chunk ahead, no more. Remove the worktree when
the work is done.

# Issues

- Title starts with a capitalized imperative verb: `Add`, `Fix`,
  `Improve` or `Remove`. e.g. `Add passkey recovery flow`.
- The body follows the template for its kind. Use the repository's
  `.github/ISSUE_TEMPLATE/` sections when it has them, since `gh` skips
  them when given a body. Otherwise:
  - Bug (`bug`): Description, Steps to reproduce, Expected behavior,
    Actual behavior, Environment.
  - Feature (`enhancement`): Problem, Proposed solution, Alternatives
    considered, Acceptance criteria as a checklist.
  - Other, such as docs, chore, refactor or CI (`documentation` for
    docs only, else `enhancement`): Summary, Why, Done when as a
    checklist.
  - Leave out sections that do not apply rather than leaving them
    empty.
- If an existing issue has no body, draft one as its first comment and
  post it once I approve it.
- Assign it to me (`--assignee @me`) and label it by kind, as above.

# Pull requests

- Title identical to the issue title.
- Body follows the repository's `.github/pull_request_template.md` if
  it has one. Otherwise: Summary (what and why), Changes, How to test,
  optional Notes, then `Closes #<number>`, so merging closes the issue.
- Assign it to me (`--assignee @me`).
- Never push to `main`. Never force-push a shared branch.

# Comments

Show me every comment before you post it on the forge (issue or pull
request) and post exactly what I approve. Issue and pull request
titles and bodies need no approval: publish them as soon as the
workflow reaches that step, and never hold a step back waiting on one.
Draft a pull request
comment when you make a choice I didn't specify, find something new, or
hit a minor issue out of scope. A draft waiting for me never blocks a
commit or a push.

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
