# Task confirmation

Before starting any non-trivial task, rephrase my request in your own
words as a short spec (what you understood, what you're about to do,
the list of files you expect to create, modify or delete, and the
suggested issue title and description) and wait for my
confirmation. Accept "go", "yes", "y", "yep", "sure", or anything
equivalent as confirmation — don't demand exact wording.
My confirmation approves the issue title and description too.

Once confirmed, run the task end-to-end with zero further
interruptions — no permission prompts, no intermediate check-ins —
except the stage-then-commit loop and the
[published text](#published-text) approvals defined below.
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

Every other step, including push, runs without approval — only the
text it publishes needs mine (see [Published text](#published-text)).
Still show
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

The project's check pipeline consists of the format check and the
linter only, using the tool that matches the project (see Tooling
below). Tests, typecheck and build are not part of it; the full test
suite runs in the PR checks (step 10). Nothing is committed unless
exactly what is staged passed it. You check your own chunks as soon
as they appear as unstaged changes, while I review them, so a fully
staged chunk of yours commits with no check wait. Anything else
staged, including my chunks and partial or
edited stages of yours, is checked at commit time, on the staged
content itself (`git show :<file>` piped to the tool's stdin mode),
not the working tree. If the pipeline passes, commit exactly what is
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
- The moment the chunk is complete on disk, in the same command, record its
  fingerprint — the tree it would commit as, built in a throwaway
  index so mine is untouched,
  `GIT_INDEX_FILE=<tmp> sh -c 'git read-tree HEAD && git add -A && git write-tree'` —
  and run the check pipeline on it. I'm already reading the diff, so
  the check costs me no wait. Keep the fingerprint only if the check
  passes. If it fails, tell me what failed, fix it as new unstaged
  changes, and check again.
- You watch for my staging by polling `git status` — no nudges, no
  check-ins, no asking me whether I'm done reviewing — and the moment
  something is staged, commit exactly what's staged, then immediately
  start the next chunk as new unstaged changes. Compare `git write-tree`
  with the fingerprint in the same command as the commit: equal means I
  staged the checked chunk untouched, so commit without re-running the
  pipeline; different means run it on the staged content first.
- Polling means a background watcher, never ending the turn: you only
  run while a turn is active, so a turn that ends unwatched misses my
  staging. Right after leaving a chunk unstaged, start a Bash
  `run_in_background` loop such as
  `until [ -n "$(git diff --cached --name-only)" ]; do sleep 1; done`
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
  in the worktree — never symlink dependencies. Stay one chunk ahead,
  no more.
  - When I stage chunk N, do the whole handoff in one Bash command, so
    it costs a single round-trip: commit chunk N (re-checking only if
    the fingerprint differs) and apply chunk N+1 to the repo with
    `git -C <path> diff HEAD | git apply` — Git carries deletions and
    renames — right away, finished or not, so I never wait for it to
    appear. Push chunk N last in that same command, once N+1 is on
    disk. Then start the watcher.
  - If chunk N+1 is finished, record its fingerprint and check it in
    that same command, WIP-commit it in the worktree, say it's ready
    for review, and start chunk N+2 in the worktree.
  - If it isn't, say it's still in progress and finish it in place, in
    the repo, while I start reading. Once it's complete, record its
    fingerprint and check it, say it's ready for review, carry it into
    the worktree as a WIP commit, and start chunk N+2 there. If I stage
    part of it before then, there's no fingerprint yet: check the
    staged content and commit it.
  - When I ask for a change to chunk N: apply it to chunk N in the
    repo, carry it into the worktree, and rework chunk N+1 so it
    still fits.
  - When the step's work is done: `git worktree remove --force <path>`.

Repeat until the step's work is done.

## Issues

- Title starts with a capitalized verb, usually Add / Fix / Improve /
  Remove. e.g. `Add passkey recovery flow`, `Fix stale nonce on retry`.
- If an issue has no main description, draft one as the first comment
  (what the task is, why, and what done looks like) and post it once I
  approve it.
- Assign it to me (`@me`).
- Label it `enhancement` or `bug`, whichever fits.

## Pull requests

- PR title is identical to the issue title — same verb, same casing.
- PR body is the approved issue description, then `closes #12` so
  merging closes the issue.
- Always assign it to me: `--assignee @me`.
- Never push to main directly. Never force-push a shared branch.
- If main moves under a long-lived branch, rebase the branch onto main
  and force-push — it's your own unshared branch, so that's safe.

## Published text

I approve every text you publish on GitHub: issue and PR titles and
bodies, and comments. Post exactly what I approved, or my edited
version.

- The issue title and description are approved with the task spec, and
  the PR reuses them, so opening either needs no extra approval.
- As the work goes on, draft a PR comment when you make a choice I
  didn't specify (naming, approach, a tradeoff), find something new
  about the codebase or the task, or hit a minor issue out of scope (a
  bug, stale docs, a flaky check). Show me the draft and post it only
  once I approve it.
- Any other text — an edited title or body, any other comment — follows
  the same draft-then-approve rule.
- Keep working while a draft waits: it never blocks a commit or a push.
  Commit messages are not covered; staging a chunk is enough for them.

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
