# Agent bindings

This document maps the Agent role of [HuG Flow](../hug-flow.md) onto real coding agents. It is informative: the spec defines what the agent must be able to do, and a binding only says how a given agent does it. Claude Code is the spec's worked example.

## Capabilities

An agent can hold the Agent role (§5) if it can:

1. **Run shell commands**, to drive Git, the forge's client and the check pipeline.
2. **Load persistent instructions**, which encode the flow for every session.
3. **Run a procedure only when the maintainer invokes it**, for the intake skill in P0.
4. **Wait for the staging event without losing its session**, for the watcher in P3.
5. **Leave its own attribution out**, for I5.

## Instructions file

[`AGENTS.md`](https://agents.md/) is the canonical instructions file. Codex, Cursor, GitHub Copilot and Zed read it natively. An agent with its own file points that file at `AGENTS.md` rather than keeping a second copy:

- Claude Code reads `CLAUDE.md`. A `CLAUDE.md` holding the single line `@AGENTS.md` [imports](https://code.claude.com/docs/en/memory) it.
- Gemini CLI reads `GEMINI.md`. Setting `"context": { "fileName": ["AGENTS.md", "GEMINI.md"] }` in its [`settings.json`](https://geminicli.com/docs/cli/gemini-md/) makes it read `AGENTS.md` too.

[`examples/minimal`](../../examples/minimal/README.md) follows this layout.

## Invocation-only procedures

P0 requires that the intake skill run only when the maintainer invokes it. Most agents now read skills in the [`SKILL.md`](https://agentskills.io/) format, but each one has its own switch for this:

| Agent          | Switch                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Code    | `disable-model-invocation: true` in the skill's frontmatter                                                                                            |
| Codex          | `policy: { allow_implicit_invocation: false }` in the skill's [`agents/openai.yaml`](https://developers.openai.com/codex/skills); invoked as `$intake` |
| GitHub Copilot | `disable-model-invocation: true` in the skill's frontmatter                                                                                            |
| Cursor         | `disable-model-invocation: true` in the skill's [frontmatter](https://cursor.com/docs/skills)                                                          |
| Gemini CLI     | A [custom command](https://geminicli.com/docs/cli/custom-commands/) in `.gemini/commands/intake.toml`, which only the maintainer can run               |

A skill that sets several switches works across agents: Codex ignores `disable-model-invocation`, and the others ignore `agents/openai.yaml`. Some clients have had bugs where the switch hides the skill from explicit invocation too; if that happens, the skill's own text MUST still tell the agent to run it only when invoked by name.

## Watcher

In P3 the agent waits for the maintainer to stage, then commits. The watcher is the command that waits:

```sh
until [ -n "$(git diff --cached --name-only)" ]; do sleep 1; done
```

What matters is how the agent runs it:

- **Background task that wakes the agent.** The best fit: the agent keeps answering questions while it waits, and is woken the moment something is staged. Claude Code does this with a background Bash task (`run_in_background`).
- **Foreground wait.** The agent runs the loop as an ordinary command and its turn stays open until staging. It cannot answer questions meanwhile, and the loop must fit within the agent's command timeout. On a timeout, the agent runs it again.
- **Manual.** The maintainer says "staged", and the agent checks the staging area. It works with any agent, at the cost of one message per chunk.

A watcher outside the agent, which polls the index and then calls the agent headlessly (`claude -p`, `codex exec`, `gemini -p`), would make the first mode available to every agent. It is not specified yet.

## Attribution

I5 bars `Co-Authored-By` trailers and generated-by footers. Agents add them by default, and not all of them can be told to stop:

| Agent          | Setting                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code    | `"includeCoAuthoredBy": false` and `"gitAttribution": false` in `settings.json`                                                                            |
| Codex          | `commit_attribution = ""` in `~/.codex/config.toml`                                                                                                        |
| Cursor         | Settings › Git & Pull Requests › Commit Attribution off; for the CLI, `"attribution": { "attributeCommitsToAgent": false }` in `~/.cursor/cli-config.json` |
| GitHub Copilot | In VS Code, `"git.addAICoAuthor": "off"`. The Copilot CLI has no setting                                                                                   |
| Gemini CLI     | No documented setting; rely on the hook below                                                                                                              |

A setting only covers one agent, and only while it stays set. A Git [`commit-msg` hook](https://git-scm.com/docs/githooks#_commit_msg) that rejects these lines covers every agent at once, and the maintainer's own commits too. [`examples/minimal/hooks/commit-msg`](../../examples/minimal/hooks/commit-msg) is one. An agent that appends a trailer it cannot be told to omit, such as the Copilot CLI today, is then blocked from committing: it cannot hold the Agent role until it offers an opt-out.

## Adding an agent

Add a row to each table above, or say where the agent falls short of a capability, and open a pull request.
