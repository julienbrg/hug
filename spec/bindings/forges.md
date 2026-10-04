# Forge bindings

This document maps the forge operations of [HuG Flow](../hug-flow.md) onto real forges. It is informative: the spec defines what each operation must achieve, and a binding only says which command does it. GitHub is the spec's worked example; the other forges are listed by how many developers use them.

A forge qualifies if it provides issues, pull requests (merge requests on GitLab), CI that reports on pull requests, squash merges, and branch rules that can hold I1, I3 and I4 on `main`.

## Operations

| Operation      | Phase | Must achieve                                                                                                           |
| -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| Create issue   | P1    | An issue with a verb-first title and a body from its kind's template, assigned to the maintainer and labelled          |
| Branch         | P2    | A branch off `main`, linked to the issue, checked out locally                                                          |
| Open PR        | P4    | A pull request with the issue's title and a templated body, assigned to the maintainer, that closes the issue on merge |
| Watch checks   | P5    | Block until every check has finished, and report red or green                                                          |
| Squash-merge   | P6    | One squash commit on `main`, the merged branch deleted                                                                 |
| Protect `main` | L3    | Pull request required, checks required, squash only, no force-push, no deletion                                        |

Where a forge has no command for an operation, the binding says so and gives the fallback. When checks cannot be watched, the agent polls them. It MUST NOT treat "no result yet" as green.

## GitHub

Client: [`gh`](https://cli.github.com/).

| Operation      | Command                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create issue   | `gh issue create --title "…" --body "…" --assignee @me --label enhancement`                                                                                                                                              |
| Branch         | `gh issue develop <n> --checkout`                                                                                                                                                                                        |
| Open PR        | `gh pr create --title "…" --body "… Closes #<n>" --assignee @me`                                                                                                                                                         |
| Watch checks   | `gh pr checks <n> --watch`, which exits non-zero on a failed check                                                                                                                                                       |
| Squash-merge   | `gh pr merge <n> --squash --delete-branch`                                                                                                                                                                               |
| Protect `main` | A [ruleset](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), such as [`examples/minimal/ruleset.json`](../../examples/minimal/ruleset.json) |

## GitLab

Client: [`glab`](https://gitlab.com/gitlab-org/cli). Pull requests are merge requests.

| Operation      | Command                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create issue   | `glab issue create --title "…" --description "…" --assignee <user> --label enhancement --yes`                                                                                                          |
| Branch         | No single command. `git switch -c <n>-<slug> main`: a branch name that starts with the issue number links it to the issue                                                                              |
| Open PR        | `glab mr create --title "…" --description "… Closes #<n>" --assignee <user> --target-branch main --yes`                                                                                                |
| Watch checks   | `glab ci status --live`, which follows the branch's pipeline until it ends                                                                                                                             |
| Squash-merge   | `glab mr merge <n> --squash --remove-source-branch --yes`                                                                                                                                              |
| Protect `main` | [Protected branch](https://docs.gitlab.com/user/project/repository/branches/protected/) with no one allowed to push and force-push off; merge requests set to require squash and a successful pipeline |

`glab mr merge` enables auto-merge by default: on a running pipeline it schedules the merge instead of refusing it. The agent still waits for the pipeline to finish green before calling it, as P5 requires.

## Azure DevOps

Client: the [`azure-devops`](https://learn.microsoft.com/en-us/azure/devops/cli/) extension of `az`. Issues are work items, and their type depends on the project's process (`Issue` in Basic, `User Story` or `Bug` in Agile).

| Operation      | Command                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create issue   | `az boards work-item create --type Issue --title "…" --description "…" --assigned-to <user> --fields "System.Tags=enhancement"`                                                                                       |
| Branch         | No single command. `git switch -c <n>-<slug> main`; the link to the work item is made by the pull request                                                                                                             |
| Open PR        | `az repos pr create --title "…" --description "…" --work-items <n> --source-branch <branch> --target-branch main`. Pull requests have reviewers, not assignees: add the maintainer with `--required-reviewers <user>` |
| Watch checks   | No watch command. Poll `az repos pr policy list --id <n>` until every evaluation is `approved`                                                                                                                        |
| Squash-merge   | `az repos pr update --id <n> --status completed --squash true --delete-source-branch true --transition-work-items true`; the last flag closes the work item                                                           |
| Protect `main` | [Branch policies](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies): a build validation policy, a merge strategy limited to squash, and the "Force push" permission denied                    |

Any branch policy on `main` makes pull requests mandatory for it.

## Forgejo and Gitea

Client: [`tea`](https://gitea.com/gitea/tea), which works with both. [Forgejo](https://forgejo.org/) also has [`fj`](https://codeberg.org/Cyborus/forgejo-cli).

| Operation      | Command                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create issue   | `tea issues create --title "…" --description "…" --assignees <user> --labels enhancement`                                                                                                |
| Branch         | No single command. `git switch -c <n>-<slug> main`                                                                                                                                       |
| Open PR        | `tea pulls create --title "…" --description "… Closes #<n>" --assignees <user> --base main --head <branch>`                                                                              |
| Watch checks   | No watch command. Poll `tea actions runs list` until the branch's runs have finished                                                                                                     |
| Squash-merge   | `tea pulls merge <n> --style squash`. The branch is deleted by the repository's "delete pull request branch after merge" setting, or afterwards with `git push origin --delete <branch>` |
| Protect `main` | [Branch protection](https://forgejo.org/docs/latest/user/protection/): push disabled, force-push off, required status checks; squash as the only merge style in the repository settings  |

## Adding a forge

Copy one of the sections above, fill each operation with the forge's command or its fallback, and open a pull request. A forge that cannot hold one of the `Protect main` rules can still run the flow at L1 and L2, but not at L3.
