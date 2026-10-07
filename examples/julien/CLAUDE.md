# Base

The hug plugin loads HuG Flow's rules into every session. They are the
base; this file only adds to them, and where the two conflict, this file
wins.

# Task confirmation

The spec also lists the issue title and body (or the existing issue) and
the pull request title and body, and ends with "Merge the pull request
once its checks are green." My confirmation approves them and the
merge, so they are published, and the pull request merged, as soon as
the workflow reaches them. The only other
approvals are the stage-then-commit loop and [comments](#comments).

# Forges

Run `git remote get-url origin` before anything else:

- `github.com` → `gh`, as HuG Flow says
- `git.rickub.com` → `rickub`; a SessionStart hook loads its commands
  from `~/.claude/instructions/RICKUB.md`

# Workflow

- Uncommitted changes I keep at step 1 are mine: right after the branch
  is checked out, before any new work, stage them by naming the files,
  check the staged content, commit them as their own commit, and push.
  If the check fails, `git restore --staged` them and tell me what
  failed; I fix it as a new unstaged chunk.
- Create `CHANGELOG.md` if it doesn't exist.
- If `main` moves under a long-lived branch, rebase it onto `main` and
  force-push: it is your own unshared branch.

# Stage-then-commit loop

- When I write a chunk, I say exactly "Please check my changes as I keep
  on working on the next steps."
- The command that records your chunk's tree and passes the check ends
  with the ready sound, and only then:
  `… && (nohup afplay ~/.claude/sounds/icq.mp3 >/dev/null 2>&1 &)`.
  The subshell keeps `&` from detaching the whole chain.

# Issues

- Issue body templates by kind and labels as in HuG Flow. If an issue
  has no main description, draft one as its first comment and post it
  once I approve it.

@instructions/PLAN_ISSUES.md

# Comments

Show me every comment before you post it on the forge (issue or PR)
and post exactly what I approve. Draft a PR comment when you make a
choice I didn't specify, find something new, or hit a minor issue out
of scope. A draft waiting for me never blocks a commit or a push.

# Commits

As small as possible, lowercase including the first word, no emoji.
e.g. issue `Add passkey recovery flow` → commits `add recovery route`,
`handle expired challenge`.

# Tooling

- pnpm, never npm or yarn.
- `foundry.toml` → `forge fmt --check` as the format check.

# Style

- Be terse; skip preamble and closing summaries.
- Don't add comments explaining what the code obviously does.
