# Human-Gated Flow (HuG Flow)

| Field   | Value           |
| ------- | --------------- |
| Status  | Draft           |
| Version | 0.3.0           |
| Author  | Julien Béranger |
| Created | 2026-09-25      |
| License | MIT             |

## Abstract

HuG Flow is an issue-driven development lifecycle in which a coding agent executes every process step and a human maintainer approves every chunk of content by staging it in the Git index. This document specifies the roles, artifacts, phases, approval points and invariants of the flow. Its core is tool-neutral: each step is described by what it does, not by the command that runs it, with Git and GitHub as the worked example, and informative bindings in [`spec/bindings`](bindings/) map it onto other agents, forges, version control systems and review tools. Two example setups built on Claude Code and GitHub are provided: a generic one to adapt, in [`examples/minimal`](../examples/minimal/README.md), and a personal one, in [`examples/julien`](../examples/julien/README.md). A reference implementation that enforces the flow with hooks and forge rules is in [`reference`](../reference/README.md).

## 1. Purpose

The Human-Gated Flow (HuG Flow) is a development lifecycle for building software with a coding agent. It extends the [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow), first described by [Scott Chacon](http://scottchacon.com/2011/08/31/github-flow.html) in 2011, with an explicit division of labor between a human maintainer and an AI agent.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

This document is itself maintained under HuG Flow. Its version follows [semantic versioning](https://semver.org/), and every change to it is recorded in the repository's `CHANGELOG.md`.

## 2. Scope

HuG Flow applies to projects that meet three conditions:

- the deliverable is conventional software, whose behavior is validated by deterministic checks (format, lint, tests, build);
- the code is hosted on a forge and changes reach the default branch only through pull requests;
- a coding agent writes most of the code, and a human is accountable for everything that is merged.

HuG Flow is independent of the operating system. Every step relies on Git and the forge's command-line client, so the flow runs the same on macOS, Linux and Windows.

HuG Flow is also independent of the agent, the forge and the editor. This document names tools only as examples. The bindings, which are informative, say how each tool fills each step:

- [agents](bindings/agents.md): Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI;
- [forges](bindings/forges.md): GitHub, GitLab, Azure DevOps, Forgejo and Gitea;
- [version control](bindings/vcs.md): Git, Jujutsu, Mercurial and Sapling;
- [review tools](bindings/review-tools.md): editors and Git interfaces that stage hunks.

HuG Flow does not cover how to build an agent, how to deploy, or how to monitor in production. Section 11 explains how these relate to the Agent Development Lifecycle (ADLC).

## 3. Terminology

- **Chunk.** One logical, reviewable unit of change, small enough to read in one sitting. The unit of approval in HuG Flow.
- **Approval surface.** Where the reviewer approves a chunk. It has three properties: only the reviewer writes to it, it can hold a subset of the changes, and the author records exactly its contents. In [Git](https://git-scm.com/), the version control system this document assumes, the approval surface is the staging area (index). Other systems place it elsewhere, such as an empty change in [Jujutsu](https://github.com/jj-vcs/jj) (see the [version control bindings](bindings/vcs.md)).
- **Check pipeline.** The local, deterministic checks that gate every commit: the format check and the linter only. Tests, typecheck and build are not part of it; they run in CI (P5).
- **Fingerprint.** The identifier of the tree a checked chunk would commit as, recorded once the chunk is complete as unstaged changes and kept only if it passes the check pipeline. At commit time, a staged tree equal to the fingerprint was approved untouched and commits without a second pipeline run.
- **Forge.** The service that hosts the repository and provides issues, pull requests and CI, driven from its command-line client. [GitHub](https://github.com/) and [`gh`](https://cli.github.com/) are the worked example throughout this document; every forge command stands for an abstract operation (create an issue, open a pull request, watch checks, squash-merge) that any forge's client can fill, as the [forge bindings](bindings/forges.md) show.

## 4. Design principles

1. **Process autonomy, content control.** The agent runs the whole workflow (issue, branch, push, pull request, merge) without asking permission. It never decides alone what enters the history.
2. **Approval by staging.** The reviewer approves a chunk by writing it to the approval surface — in Git, by staging it. Staging a change means approving it.
3. **Cheap failure.** A branch costs nothing, so experiments are encouraged. A failed attempt is closed and deleted with no effect on `main`.
4. **End-to-end traceability.** Every change links back to an issue (the _why_). The commits record the _how_, and the pull request records the _discussion_.
5. **Validation before integration.** Checks run before code reaches `main`, never after.

## 5. Roles

| Role           | Held by                                                                      | Responsibilities                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Maintainer** | Human                                                                        | Confirms task specs, reviews and stages every chunk written by the agent, answers review questions, is the sole author of record           |
| **Agent**      | A coding agent, such as [Claude Code](https://code.claude.com/docs)          | Restates tasks as specs, writes code in reviewable chunks, runs the local check pipeline, commits what was staged, runs every process step |
| **CI**         | The forge's CI, such as [GitHub Actions](https://docs.github.com/en/actions) | Runs the full test suite, typecheck and build on every push to a pull request                                                              |
| **Reporter**   | Users, staff                                                                 | Supply feedback that becomes issues                                                                                                        |

The authorship rule is symmetric. Whoever did not write a chunk approves it by staging it, and the author then commits exactly what was staged.

Any coding agent can hold the Agent role if it can run shell commands, load persistent instructions, run a stored procedure only when the maintainer invokes it, watch the approval surface without losing its session, and be configured to leave its own attribution out of commits and pull requests. The [agent bindings](bindings/agents.md) say how each common agent meets these.

## 6. Artifacts

| Artifact                | Created in phase | Purpose                                                                                                                                                                                                          |
| ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue                   | P1               | States what, why, and what "done" looks like                                                                                                                                                                     |
| Branch `<n>-<slug>`     | P2               | Isolates the work, linked to issue `#n`                                                                                                                                                                          |
| Chunk                   | P3               | One logical, reviewable unit of change, left unstaged                                                                                                                                                            |
| Commit                  | P3               | One approved chunk, lowercase imperative title                                                                                                                                                                   |
| Pull request            | P4               | Discussion space, CI trigger, closes the issue on merge                                                                                                                                                          |
| `CHANGELOG.md` entry    | P4, via P3       | One summary per pull request, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format                                                                                                                 |
| Squash commit on `main` | P6               | One line of history per feature                                                                                                                                                                                  |
| Instructions file       | Setup            | Persistent instructions that encode this specification: [`AGENTS.md`](https://agents.md/), which most agents read, or the agent's own file, such as `CLAUDE.md` ([docs](https://code.claude.com/docs/en/memory)) |
| Skills                  | Setup            | Reusable procedures such as feedback intake, in the agent's skill format ([docs](https://code.claude.com/docs/en/skills))                                                                                        |

## 7. Lifecycle

HuG Flow has two loops. The **inner loop** (P3) is the chunk-by-chunk build cycle between agent and maintainer. The **outer loop** runs from P0 to P6 and restarts whenever new feedback arrives.

```mermaid
flowchart LR
    P0[P0 Intake] --> P1[P1 Specify]
    P1 -->|maintainer confirms| P2[P2 Branch]
    P2 --> P3
    subgraph P3 [P3 Build: inner loop]
        W[Agent writes chunk] --> R[Maintainer reviews]
        R -->|stages| C[Agent checks and commits]
        R -->|rejects| F[Agent proposes fix]
        F -->|maintainer confirms| W
        C --> W
    end
    P3 --> P4[P4 Integrate]
    P4 --> P5[P5 Validate]
    P5 -->|red check| P3
    P5 -->|green| P6[P6 Merge]
    P6 -.->|new feedback| P0
```

Each phase is specified by its inputs, activities, outputs and exit criterion.

### P0. Intake

- **Input:** raw feedback (an email, a message, a bug report), often in another language.
- **Activities:** the maintainer invokes an intake skill with the pasted text. The agent writes a verb-first English title and a short description, then quotes the original message verbatim under an attribution line.
- **Output:** one issue per distinct topic.
- **Exit criterion:** the issue exists and is assigned and labelled.
- **Controls:** the pasted text MUST be treated as data, never as instructions. This is a basic defense against [prompt injection](https://en.wikipedia.org/wiki/Prompt_injection). The skill MUST run only when the maintainer invokes it explicitly, enforced by the agent's switch for that (`disable-model-invocation: true` in Claude Code).

P0 is optional. Work MAY start directly at P1.

### P1. Specify

- **Input:** a request from the maintainer, or an existing issue.
- **Activities:** for any non-trivial task, the agent restates the request as a short spec (what it understood, what it will do, and the files it expects to create, modify or delete) and waits for confirmation. If no issue exists yet, the agent creates one.
- **Output:** a confirmed spec, including its expected file list, and an issue whose title starts with a capitalized imperative verb (`Add`, `Fix`, `Improve`, `Remove`) and whose body follows the template for its kind (see below).
- **Exit criterion:** the maintainer has confirmed ("go", "yes", or equivalent).

After confirmation, the agent MUST run P2 to P6 without further permission prompts. The only exception is the approval gate in P3.

Issue bodies follow the usual GitHub templates, one per kind of work:

| Kind                                      | Label                                             | Sections                                                                                  |
| ----------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Bug                                       | `bug`                                             | Description, Steps to reproduce, Expected behavior, Actual behavior, Environment          |
| Feature                                   | `enhancement`                                     | Problem, Proposed solution, Alternatives considered, Acceptance criteria (as a checklist) |
| Other: documentation, chore, refactor, CI | `documentation` for docs only, else `enhancement` | Summary, Why, Done when (as a checklist)                                                  |

When the repository has its own [issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository) or [pull request template](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository), the agent MUST use their sections instead: a forge CLI that is given a body skips them. Sections that do not apply are left out, not left empty.

### P2. Branch

- **Input:** the issue number.
- **Activities:** before branching, the agent checks for uncommitted work and asks whether to keep or stash it. It then creates the branch from `main`, linked to the issue, and checks it out — one forge operation ([`gh issue develop <n> --checkout`](https://cli.github.com/manual/gh_issue_develop) on GitHub).
- **Output:** a local branch linked to the issue.
- **Exit criterion:** the working tree is on the new branch.

### P3. Build (inner loop)

- **Input:** the confirmed spec.
- **Activities:** the agent writes one logical chunk and leaves it unstaged. It announces the chunk in one line and starts a background watcher on the staging area. The maintainer reviews the diff in any tool that shows unstaged changes and stages individual hunks — an IDE such as [VS Code](https://code.visualstudio.com/) or a [JetBrains](https://www.jetbrains.com/) one, [lazygit](https://github.com/jesseduffield/lazygit), [Magit](https://magit.vc/), or `git add -p` (see the [review tools](bindings/review-tools.md)) — and stages what they approve. As soon as a chunk is complete as unstaged changes, the agent records a fingerprint of it, the tree the chunk would commit as, and runs the local check pipeline (format and lint only) on it, so the check runs while the maintainer reads the diff rather than before. The fingerprint is kept only if the check passes. On a failure, the agent reports it and fixes the chunk as new unstaged changes. The watcher polls every second. Once something is staged, the agent commits exactly what is staged. It runs the pipeline again first only when the staged tree differs from the fingerprint, as with a partial stage or a chunk the maintainer wrote, and then on the staged content itself rather than the working tree.
- **Pipelining:** while chunk _N_ is under review, the agent writes chunk _N+1_ in a [linked worktree](https://git-scm.com/docs/git-worktree) (`git worktree add`), seeded with chunk _N_ from its fingerprint. Once _N_ is staged, a single command commits it, with no check wait when it was staged whole, fingerprints the worktree, and applies the difference between the two fingerprints to the repository as unstaged changes, whether or not _N+1_ is finished. The handoff costs the agent one round-trip, and the maintainer never waits for the next chunk to appear. The same command pushes _N_ last, once _N+1_ is on disk, so network latency never delays the handoff. If _N+1_ is unfinished, the agent says it is still in progress and finishes it in place, in the repository, while the maintainer starts reading. Once it is complete, the agent fingerprints and checks it, announces it as ready for review, carries it into the worktree and starts _N+2_ there. A diff between two trees carries new, deleted and renamed files, and still applies once _N_ is committed, and the worktree installs its own dependencies rather than sharing them through a link.
- **Output:** a series of small commits.
- **Exit criterion:** the spec is fully implemented.

Rules for this phase:

- The agent MUST NOT stage its own work, including with `git add -A` or `git add .`.
- A partial stage MUST be committed as-is. The remainder stays unstaged.
- The maintainer MAY stage part of a chunk that is still in progress. It has no fingerprint yet, so the agent runs the check pipeline on the staged content before committing it.
- The agent MUST NOT commit staged content that has not passed the check pipeline, either while it was under review or at commit time.
- If a check fails, the agent unstages the affected files and reports the failure. It MUST NOT modify staged changes it did not write.
- If the maintainer rejects a chunk, the agent proposes a fix and waits for confirmation before rewriting.
- The agent SHOULD NOT prepare more than one chunk ahead. A queue of chunks pressures the maintainer to hurry the review.
- A question from the maintainer does not pause the loop. The agent answers it, then checks the staging area within the same turn.

The inner loop is symmetric, as section 5 requires. When the maintainer writes a chunk, they leave it unstaged and hand it over; the agent reviews the diff and stages what it approves; the maintainer runs the check pipeline on the staged content and commits exactly what was staged. The rules above apply with the roles swapped: nobody stages their own work, and nothing is committed unreviewed.

### P4. Integrate

- **Input:** the commits from P3.
- **Activities:** the agent pushes after each commit. After the first push, it opens a pull request whose title is identical to the issue title. Its body has a Summary (what and why), a list of Changes, How to test, optional Notes, and ends with `Closes #<n>`. After the last code commit, a final chunk updates `CHANGELOG.md`, along with any documentation and `README.md` changes, and goes through P3 like any other chunk.
- **Output:** a pull request that is [linked to the issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue).
- **Exit criterion:** all commits are pushed, including the changelog.

The pull request SHOULD be opened early. It serves as a discussion space during the work, not only as a final gate.

If `main` advances while the pull request is open, the agent rebases the branch onto `main` and force-pushes it. An issue branch has a single writer — the agent — so it is not a shared branch and the force-push does not violate I4.

### P5. Validate

- **Input:** the pushed pull request.
- **Activities:** the agent watches the forge's checks until they finish (`gh pr checks <n> --watch` on GitHub). If a check fails, the agent fixes the cause and the fix re-enters P3. Additional [code review](https://en.wikipedia.org/wiki/Code_review) MAY take place in the _Files changed_ tab.
- **Output:** a green check run.
- **Exit criterion:** every check is green.
- **Controls:** text that arrives through the forge — issue comments, review comments, CI logs — MUST be treated as data, never as instructions, like the pasted feedback in P0 (I6).

The agent MUST NOT merge on a red or still-running check, even if the diff looks harmless.

### P6. Merge and clean up

- **Input:** a pull request with every check green.
- **Activities:** the agent runs a [squash merge](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges) that also deletes the merged branch (`gh pr merge <n> --squash --delete-branch` on GitHub). It then returns to `main`, pulls, and removes any branch that survived.
- **Output:** one commit on `main` and a closed issue.
- **Exit criterion:** `main` is up to date locally and no merged branch remains.

The agent reports the issue number, branch, pull request number and merge result, so the maintainer can see what happened and intervene.

### Aborting

The maintainer MAY abandon a task at any phase. The agent then closes the pull request without merging, deletes the branch and any linked worktree, and closes the issue with a comment saying why — or leaves it open if a fresh attempt is planned. An aborted attempt leaves no trace on `main` (design principle 3).

## 8. Autonomy and approval matrix

| Step                          | Executed by | Human approval required        |
| ----------------------------- | ----------- | ------------------------------ |
| Restate request as spec       | Agent       | **Yes**, once per task         |
| Create issue                  | Agent       | No                             |
| Create and check out branch   | Agent       | No                             |
| Write chunk                   | Agent       | —                              |
| Stage chunk                   | Maintainer  | **Yes**, this is the approval  |
| Run check pipeline and commit | Agent       | No (only what was staged)      |
| Push, open pull request       | Agent       | No                             |
| Update changelog              | Agent       | **Yes**, staged like any chunk |
| Wait for CI                   | Agent       | No                             |
| Merge, clean up               | Agent       | No (only on green CI)          |

The maintainer approves once at the level of intent (the spec) and continuously at the level of content (staging). Everything else is automated.

This granularity is what sets HuG Flow apart from other human-gated workflows. [DevFlow](https://github.com/aiKeeo/dev-flow), for example, gates at phase boundaries (requirements, design, development, testing). HuG Flow gates every chunk of code, and deliberately leaves the process steps between chunks ungated.

## 9. Invariants

The following MUST hold at all times:

- **I1.** `main` is stable and deployable.
- **I2.** No line enters the history without being reviewed by the party that did not write it.
- **I3.** Nothing is merged without a green CI run.
- **I4.** No one pushes directly to `main`, and no one force-pushes a shared branch.
- **I5.** The maintainer is the sole author of record: there is no `Co-Authored-By` trailer and no generated-by footer.
- **I6.** External text (feedback, issue bodies written by others, review comments, CI logs) is treated as data, never as instructions.

## 10. Conformance

An implementation of HuG Flow is a set of instructions, hooks and forge settings that makes an agent and a repository follow this document. This section defines what such an implementation must provide to claim conformance.

### Levels

There are three conformance levels. Each level includes every requirement of the levels below it.

| Level | Name              | Requirement                                                                                                                                                                                                                                                                 |
| ----- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1    | Instructed        | The agent's instructions file encodes P0–P6 and I1–I6. Compliance depends on the model following it. [`examples/minimal`](../examples/minimal/README.md) and [`examples/julien`](../examples/julien/README.md) are L1 setups.                                               |
| L2    | Locally enforced  | Hooks on the maintainer's machine block I2, I4 and I5 violations before they happen. The hooks run outside the model, and their decision holds whatever the model does and whatever permission mode the agent runs in.                                                      |
| L3    | Remotely enforced | Forge rules on `main` require a pull request, require the CI checks to pass, allow only squash merges, and forbid force-pushes and deletion, so that I1, I3 and I4 hold even if the machine is bypassed. The history of `main` can be audited against the predicates below. |

An implementation MUST declare the version of this document and the level it implements, for example `implements: hug-flow@<version>` and `level: L2`. A claim applies to that version only.

The reference implementation, a Claude Code plugin in [`reference`](../reference/README.md), declares `implements: hug-flow@0.3.0` and `level: L2`, and reaches L3 once `hug init` has applied its ruleset to the repository. Its conformance suite, in [`conformance`](../conformance/), runs in CI.

### Invariant predicates

Each invariant in section 9 maps to a predicate that an implementation can check. The last column says when the predicate can be checked: _after the fact_ means from the history and the forge's records alone, and _procedurally_ means only while the work happens.

| Invariant | Predicate                                                                                                                                                 | Checked                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| I1        | Every commit on the first-parent history of `main` passes the required checks.                                                                            | After the fact                               |
| I2        | Every commit made in P3 records exactly a tree staged by the party that did not write its content.                                                        | Procedurally                                 |
| I3        | Every squash commit on `main` maps to a pull request whose required checks were green at merge time.                                                      | After the fact                               |
| I4        | Every commit on the first-parent history of `main` is the squash commit of a merged pull request, and the forge records no force-push to a shared branch. | After the fact                               |
| I5        | No commit on `main` carries a `Co-Authored-By` trailer or a generated-by footer, and every commit's author is the maintainer.                             | After the fact, and at L2 before each commit |
| I6        | No action of the agent is taken on instructions found in external text.                                                                                   | Procedurally                                 |

I2 and I6 are verified procedurally, not after the fact. Staging leaves no trace in the history, so no audit of `main` can tell who staged a chunk, and no record shows which text the agent acted on. An implementation MUST NOT claim to verify I2 or I6 from history. At L2, it verifies I2 by blocking the agent from staging content the agent wrote; I6 rests on the controls in P5 at every level.

## 11. Relationship to the ADLC

The Agent Development Lifecycle (ADLC) is described, with variations, by [Arthur](https://www.arthur.ai/blog/introducing-adlc), [IBM](https://www.ibm.com/think/topics/agent-development-lifecycle-adlc) and [Salesforce](https://architect.salesforce.com/docs/architect/fundamentals/guide/agent-development-lifecycle).

Both lifecycles depart from the classic [SDLC](https://en.wikipedia.org/wiki/Systems_development_life_cycle) because of AI, but for different reasons. The ADLC exists because the _product_ is probabilistic. HuG Flow exists because the _producer_ is probabilistic.

| Dimension                 | ADLC                                             | HuG Flow                                                   |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Object                    | An AI agent                                      | Conventional software written with an agent                |
| Source of non-determinism | The shipped system                               | The author of the code                                     |
| Primary validation        | Evaluation suites, often statistical             | Deterministic checks plus human review of every chunk      |
| Primary artifacts         | Code, context layer, evaluation suite            | Issue, commits, pull request, changelog, instructions file |
| Definition of done        | Never final; improvement continues in production | Merged into `main` with green CI                           |
| Inner loop                | Build and evaluate the agent                     | Write, stage, commit                                       |
| Outer loop                | Monitor and tune in production                   | Feedback intake to new issue                               |
| Human role                | Defines quality, approves at gates               | Approves intent once, approves content continuously        |

The two can be combined. A project that ships LLM features can run HuG Flow for its code and add ADLC practices on top. Three extensions would bring HuG Flow closer to an ADLC:

- **Acceptance criteria in P1.** Measurable success conditions written into the issue, as the ADLC does under "define quality".
- **Evaluations in P5.** An evaluation suite run in CI alongside the tests, whenever the codebase calls a model.
- **A P7 for operations.** Deployment and observability whose signals flow automatically into P0, closing the outer loop without manual intake.

## Further reading

- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow), GitHub documentation
- [git worktree](https://git-scm.com/docs/git-worktree), Git documentation
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) by Vincent Driessen, and [trunk-based development](https://trunkbaseddevelopment.com/), the two main alternatives
- [Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119), RFC 2119, and its update [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [The Agent Development Lifecycle](https://www.arthur.ai/blog/introducing-adlc), Arthur
- [Agent Development Lifecycle guide](https://architect.salesforce.com/docs/architect/fundamentals/guide/agent-development-lifecycle), Salesforce Architects
- [Agent development lifecycle](https://docs.glean.com/agents/agent-development-lifecycle/adlc), Glean documentation
- [ADLC vs SDLC](https://atlan.com/know/ai-agent/adlc-vs-sdlc/), Atlan
