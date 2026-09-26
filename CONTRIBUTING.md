# Contributing

Thanks for your interest in HuG Flow. This repository is maintained with the flow it describes, so contributing is also a way to try it.

## Requirements

- [Node.js](https://nodejs.org/) 22, the version CI runs on;
- [pnpm](https://pnpm.io/) 10, pinned in `package.json` (`corepack enable` picks it up);
- [`git`](https://git-scm.com/), and [`gh`](https://cli.github.com/) logged in to GitHub;
- [Claude Code](https://code.claude.com/docs), or another coding agent you can configure the same way;
- an editor that shows the unstaged diff and lets you stage hunks, such as [VS Code](https://code.visualstudio.com/).

Then install the dependencies:

```sh
pnpm install
```

## Respect the flow

Every change follows [HuG Flow](spec/hug-flow.md), from issue to merge:

1. Open an issue first. Its title starts with a capitalized verb: `Add …`, `Fix …`, `Improve …`, `Remove …`.
2. Work on a branch linked to that issue, off `main`.
3. Commit in small chunks, each one reviewed and staged by a human before it is committed. Commit titles are short, lowercase and imperative, with no trailing period.
4. Open a pull request early, with the same title as the issue, and `closes #<number>` in its body.
5. Update [`CHANGELOG.md`](CHANGELOG.md) once, in the last commit of the pull request.
6. Wait for CI to pass. Nothing is merged on a red or running check.

Before each commit, run the check pipeline:

```sh
pnpm format:check
```

CI also runs `pnpm typecheck` on Ubuntu, macOS and Windows.

[`article/hug-flow.md`](article/hug-flow.md) is the verbatim copy of the [published post](https://julienberanger.com/hug-flow). Don't reformat it: it must stay byte-identical to the live version. If your change makes the post incomplete or out of date, say so in the pull request.

## Add your own setup

The spec says what HuG Flow requires. The setups in [`examples/`](examples/) show how people actually run it. If you use HuG Flow with your own tools, conventions or forge, add yours:

1. Create `examples/<your-handle>/`.
2. Add a `README.md` that says what the setup is, which files go where, and how they map to the spec (phases P0 to P6, invariants I1 to I6).
3. Add the files themselves: `CLAUDE.md`, skills, settings, rulesets, scripts, CI.
4. Add a row for it in the Contents table of the [README](README.md).

[`examples/minimal/`](examples/minimal/README.md) is a good starting point, and [`examples/julien/`](examples/julien/README.md) shows a complete personal setup.
