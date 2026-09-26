# Task confirmation

Before starting any non-trivial task, rephrase my request in your own
words as a short spec (what you understood, what you're about to do,
and the list of files you expect to create, modify or delete) and
wait for my confirmation. Accept "go", "yes", "y", "yep", "sure",
or anything equivalent as confirmation — don't demand exact wording.

Once confirmed, run the task end-to-end with zero further
interruptions — no permission prompts, no intermediate check-ins —
except the stage-then-commit loop defined below.
Skip this confirmation step for trivial asks (reading a file,
answering a question, a one-line lookup).

# Git & forges

## Attribution

Never add `Co-Authored-By: Claude` or `Generated with Claude Code` to
commits, PR bodies, or issue comments. I am the sole author.

## Forge detection

Run `git remote get-url origin` before anything else. The host picks
the command set for the workflow below:

- `github.com` → `gh` (the commands as written)
- no remote → commit locally only; ask before adding one

## Workflow

Always follow this order. Never skip a step.

1. Check for uncommitted or untracked changes on the current branch.
   If there are any, show a short recap of what they do and ask
   whether to keep them or discard them (via `git stash` — reversible),
   then immediately move on to step 2 without waiting for the answer.
   Resolve the answer by step 3: keep needs no action (the new branch
   carries them forward automatically), discard means stashing first.
   Anything kept goes through the stage-then-commit loop (step 5)
   alongside the new work.
2. Create an issue
3. Create a branch from that issue, off main
4. Fetch the branch locally
5. Commit — via the [stage-then-commit loop](#stage-then-commit-loop)
6. Push
7. Open a pull request
8. Repeat 5–6 for further commits as the work continues
9. Update CHANGELOG.md (create it if it doesn't exist), once, summarizing
   the whole PR — not on every commit. Runs after the last code commit,
   through the stage-then-commit loop like any other commit, then push.
   The PR's docs and README.md changes go in that same last chunk, together
   with the changelog.
10. Wait for PR checks to finish and pass
11. Merge
12. Checkout main, sync it, and delete the merged branch

Steps 3–4 collapse into `gh issue develop <number> --checkout`. Open the
PR right after the first commit is pushed (step 7) — don't wait until
the work is finished. Later commits just push to the same branch.

Run the whole sequence end-to-end without pausing to ask permission at
each step — this applies across all projects. The one exception is
step 5 (commit), which does not work like a normal commit.

Every other step, including push, runs without approval. Still show
what was done (issue #, branch, PR #, merge result) so I can see and
intervene.

Step 10: `gh pr checks <number> --watch`. If a check fails, fix the
underlying issue, commit, and push before merging — never merge on a
red or still-running check, and never skip this step because the diff
looks safe.

Step 11: merge with `gh pr merge <number> --squash --delete-branch`, which
removes the remote and local branch in one go.

Step 12: after merge, `git checkout main && git pull`. If the branch
survived the merge (e.g. `--delete-branch` was not used), delete it:
`git push origin --delete <branch>` and `git branch -d <branch>`. Never
leave a merged branch behind.

## Stage-then-commit loop

The rule in one line: **whoever did not write a chunk approves it by
staging it, and the author then commits exactly what was staged.**
Nobody stages their own work, and nothing gets committed unreviewed.

Before committing what is staged, run the project's check pipeline,
which consists of the format check and the linter only, using the tool
that matches the project (see Tooling below). Tests, typecheck and
build are not run at commit time; the full test suite runs in the PR
checks (step 10). If the pipeline passes, commit exactly what is
staged. If anything fails, `git restore --staged`
the affected files, tell the other party what failed and why, and leave
it there — whoever staged it fixes it as a new unstaged chunk. Never
fix or touch staged changes you didn't write, and never commit on a
failing check.

When I write the chunk:

- I write one logical chunk of changes, leave it unstaged, say exactly
  "Please check my changes as I keep on working on the next steps.", and stop — I
  never run `git add` or `git commit` myself before you've staged.
- You review the unstaged diff in your IDE and `git add` what you
  approve.
- I watch for that, run the check pipeline, and commit exactly what's
  staged if it passes, then immediately start writing the next chunk as
  new unstaged changes.

When you write the chunk — you implementing a task, and this covers
source, tests, scripts, docs, config, everything:

- You write one logical chunk, leave it **unstaged**, say in one line
  what it is and that it's ready for review, and stop. Never run
  `git add` on your own work. Not for a doc, not for a script, not for
  a file you consider uncontroversial, and never `git add -A` or
  `git add .`.
- I review the unstaged diff in my IDE and `git add` what I approve.
- You watch for that by polling `git status` — no nudges, no check-ins,
  no asking me whether I'm done reviewing — and the moment something is
  staged, run the check pipeline and commit exactly what's staged if it
  passes, then immediately start the next chunk as new unstaged
  changes.
- Polling means a background watcher, never ending the turn: you only
  run while a turn is active, so a turn that ends unwatched misses my
  staging. Right after leaving a chunk unstaged, start a Bash
  `run_in_background` loop such as
  `until [ -n "$(git diff --cached --name-only)" ]; do sleep 5; done`
  — it re-invokes you when something is staged. Start a fresh one after
  every commit.
- While I'm reviewing I'll often ask questions about the code — why a
  format, why an approach, why that name. A question is not a pause in
  the loop. Answer it, then **check `git status` in that same turn**,
  because I usually stage while or right after I ask. If something is
  staged, commit it before you end the turn. Never end a turn with
  staged changes sitting uncommitted, whatever else the turn was about.
- If I stage only part of what you wrote, commit that part and leave
  the rest unstaged. I'll either stage the rest or tell you to change
  it.
- Don't pile the whole task up into one review. Keep each chunk small
  enough to read in one sitting, and stop after each one.
- Rejection: if I don't like a chunk, I say what's wrong instead of
  staging it. Propose a fix and wait for my "go" (per Task confirmation)
  before rewriting it — don't silently redo it unprompted.
- Don't idle while I review: write chunk N+1 in a linked worktree, on
  top of chunk N. Chunk 1 is written straight in the repo — nothing is
  under review yet, so no worktree until chunk 2. Create it outside the
  repo with `git worktree add --detach <path> HEAD` (the branch is
  already checked out in the repo), copy chunk N into it and commit it
  there as a local WIP commit, so chunk N+1 diffs cleanly against it.
  WIP commits never leave the worktree. Run the install (`pnpm install`)
  in the worktree — never symlink dependencies. Run the check pipeline
  only in the real repo, at commit time. Stay one chunk ahead, no more.
  - When I stage chunk N: check, commit, then apply chunk N+1 to the
    repo with `git -C <path> diff HEAD | git apply` — Git carries
    deletions and renames — say it's ready for review, WIP-commit it in
    the worktree, and start chunk N+2 there.
  - When I ask for a change to chunk N: apply it to chunk N in the
    repo, carry it into the worktree, and rework chunk N+1 so it
    still fits.
  - When the step's work is done: `git worktree remove --force <path>`.

Repeat until the step's work is done.

## Issues

- Title starts with a capitalized verb, usually Add / Fix / Improve /
  Remove. e.g. `Add passkey recovery flow`, `Fix stale nonce on retry`.
- If an issue has no main description, write one as the first comment:
  what the task is, why, and what done looks like.
- Assign it to me (`@me`).
- Label it `enhancement` or `bug`, whichever fits.

## Pull requests

- PR title is identical to the issue title — same verb, same casing.
- Link the issue in the body so merging closes it (`closes #12`).
- Always assign it to me: `--assignee @me`.
- Never push to main directly. Never force-push a shared branch.
- If main moves under a long-lived branch, rebase the branch onto main
  and force-push — it's your own unshared branch, so that's safe.

## Commits

Commits do NOT follow the issue/PR casing. They are lowercase.

- As small as possible — one logical change per commit.
- Very short titles. Lowercase, always — including the first word.
- Imperative mood. No trailing period. No emoji.
- No body unless the change genuinely needs explaining.

e.g. issue `Add passkey recovery flow` → commits `add recovery route`,
`handle expired challenge`.

# Tooling

- pnpm, never npm or yarn.
- Detect the project type before running checks: `package.json` → pnpm
  project (format check and lint via pnpm scripts); `foundry.toml` →
  Foundry/Solidity project (`forge fmt --check`). Adapt to whatever the
  project actually uses.

# Style

- Be terse; skip preamble and closing summaries.
- Don't add comments explaining what the code obviously does.
