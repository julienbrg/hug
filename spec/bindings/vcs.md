# Version control bindings

This document maps the approval surface of [HuG Flow](../hug-flow.md) onto version control systems. It is informative. The spec assumes [Git](https://git-scm.com/), which nearly every developer uses; the other systems are listed for completeness, and how well each one fits.

## Approval surface

§3 defines the approval surface by three properties:

1. Only the reviewer writes to it.
2. It can hold a subset of the changes.
3. The author records exactly its contents.

Any system whose workflow has a place with these properties can run the flow. The rest of P3 follows from it: the watcher waits for the surface to be non-empty, the fingerprint is the tree the surface would record, and pipelining needs a second working copy on top of the chunk under review.

| VCS                                                                              | Approval surface                       | Reviewer approves with                   | Author records with                              | Pipelining                                                                    | Fit    |
| -------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- | ------ |
| Git                                                                              | The index                              | `git add -p`, or staging hunks in a tool | `git commit`                                     | [`git worktree`](https://git-scm.com/docs/git-worktree)                       | Exact  |
| [Jujutsu](https://github.com/jj-vcs/jj)                                          | An empty change below the working copy | `jj squash -i --into <approved>`         | `jj describe`, then a new empty change below `@` | [`jj workspace`](https://jj-vcs.github.io/jj/latest/working-copy/#workspaces) | Clean  |
| [Mercurial](https://www.mercurial-scm.org/), [Sapling](https://sapling-scm.com/) | A draft commit made by the reviewer    | `hg commit -i`                           | `hg metaedit`, to set the message and author     | `hg share`                                                                    | Weaker |

## Git

The spec's worked example. The watcher polls `git diff --cached --name-only`, and the fingerprint is `git write-tree` run on a throwaway index built from the working tree.

## Jujutsu

Jujutsu has no index: the working copy is itself a change, `@`. The flow keeps an empty change, _approved_, between the last commit and `@`:

```text
@          the agent's chunk, as working-copy changes
approved   empty until the reviewer moves hunks into it
main       the last recorded commit
```

- The reviewer moves the hunks they approve from `@` into _approved_ with `jj squash -i --into <approved>`, which keeps the rest in `@`. Only the reviewer runs it.
- The watcher polls `jj log --no-graph -r <approved> -T empty` until it prints `false`.
- The agent records the chunk with `jj describe <approved> -m "<title>"`, then inserts a new empty _approved_ change below `@` with `jj new --insert-after <approved> --no-edit`.

In a [colocated](https://jj-vcs.github.io/jj/latest/git-compatibility/#colocated-jujutsugit-repos) repository the result is ordinary Git history, so the forge bindings apply unchanged. Git hooks don't run on Jujutsu's own commands, though, so a `commit-msg` hook does not guard I5 there; the agent checks the description instead.

## Mercurial and Sapling

These have no place where the reviewer can hold hunks without making a commit. The reviewer approves by committing the hunks as a draft, with `hg commit -i` (`sl commit -i` in Sapling). The agent then finalizes the draft: it sets the message and the maintainer as author with `hg metaedit`, and runs the check pipeline on it.

This stretches the authorship rule of §5: the reviewer, not the author, creates the commit, and the author only edits it. The content recorded is still exactly what the reviewer approved, so I2 holds. It fits worse than Git or Jujutsu, and an implementation on Mercurial SHOULD say so.
