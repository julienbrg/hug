# Set up HuG Flow

This page is written for a coding agent. A maintainer who types
"Switch me to HuG Flow: github.com/julienbrg/hug" wants you to follow it.

It targets [Claude Code](https://code.claude.com/docs). For another
agent, stop and say so: the rules in
[`examples/minimal/AGENTS.md`](examples/minimal/AGENTS.md) carry over,
and [`spec/bindings/agents.md`](spec/bindings/agents.md) says how to
set them up, but this setup does not.

It installs [HuG Flow](spec/hug-flow.md) as instructions (level L1),
reversibly. For hooks that enforce the flow (L2), point the maintainer
to the plugin instead: `/plugin marketplace add julienbrg/hug`, then
`/plugin install hug@hug`.

## 1. Ask first

Before running anything, tell the maintainer what will change, and wait
for a yes:

- this repository is cloned to `~/.claude/hug/`;
- the `/hug` skill is installed to `~/.claude/skills/hug/`;
- `/hug on` then records the current setup, reviews conflicting
  instructions with them, and adds:
  - one import line at the end of `~/.claude/CLAUDE.md`;
  - attribution settings and deny rules in `~/.claude/settings.json`,
    where missing;
  - the `/intake` skill, if absent;
- `/hug off` reverts exactly what `on` added. Nothing is replaced or
  rewritten.

Claude Code may also ask before the clone and before each write to
`~/.claude/`. That is expected.

## 2. Clone

```sh
git clone https://github.com/julienbrg/hug ~/.claude/hug
```

If `~/.claude/hug/` already exists, run `git -C ~/.claude/hug pull`
instead.

## 3. Install the skill

```sh
mkdir -p ~/.claude/skills
cp -R ~/.claude/hug/skills/hug ~/.claude/skills/hug
```

If `~/.claude/skills/hug/` already exists and differs, ask before
replacing it.

## 4. Turn it on

The skill loads in the next session. For now, read
`~/.claude/skills/hug/SKILL.md` and follow its **on** section. It scans for
conflicts, confirms the plan with the maintainer, and runs
`~/.claude/hug/scripts/hug.sh on`.

## Later

- `/hug status`: whether HuG Flow is on, and what was added;
- `/hug off`: revert;
- `git -C ~/.claude/hug pull`: update the rules;
- to uninstall, run `/hug off`, then delete `~/.claude/skills/hug/` and
  `~/.claude/hug/`.
