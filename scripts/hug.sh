#!/usr/bin/env sh
# Turn HuG Flow on or off for Claude Code. `off` reverts only what `on` added.
# Usage: hug.sh scan | on [--comment <file>:<line>]... | status
# Spec: notes/hug-toggle-spec.md
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
CLAUDE_DIR=${CLAUDE_CONFIG_DIR:-$HOME/.claude}
STATE_DIR=${HUG_STATE_DIR:-$CLAUDE_DIR/hug/.state}
STATE=$STATE_DIR/state
INSTRUCTIONS=${HUG_INSTRUCTIONS:-$CLAUDE_DIR/CLAUDE.md}
SETTINGS=$CLAUDE_DIR/settings.json
INTAKE=$CLAUDE_DIR/skills/intake
IMPORT="@$ROOT/examples/minimal/CLAUDE.md"
DENY='["Bash(git add -A)","Bash(git add --all)","Bash(git add .)","Bash(git add -u)","Bash(git add --update)","Bash(git stage *)","Bash(git commit -a *)","Bash(git commit --all *)","Bash(git push origin main)","Bash(git push origin HEAD:main)","Bash(gh pr merge * --admin*)"]'
CONFLICTS='git (add|commit|push)|stag(e|ed|es|ing)|force[- ]?push|co-authored|generated with|--no-verify|(to|on) `?main`?'

have() { command -v "$1" >/dev/null 2>&1; }
die() { echo "hug: $*" >&2; exit 1; }

get() { [ -f "$STATE" ] && sed -n "s/^$1=//p" "$STATE" || true; }
set_state() {
  mkdir -p "$STATE_DIR"
  { [ -f "$STATE" ] && grep -v "^$1=" "$STATE" || true; } > "$STATE.tmp"
  printf '%s=%s\n' "$1" "$2" >> "$STATE.tmp"
  mv "$STATE.tmp" "$STATE"
}

hug_present() {
  [ -f "$INSTRUCTIONS" ] || return 1
  grep -qxF "$IMPORT" "$INSTRUCTIONS" || grep -qiE 'stage-then-commit' "$INSTRUCTIONS"
}

# Instruction files the maintainer's sessions load: global, then the current repository's.
instruction_files() {
  printf '%s\n' "$INSTRUCTIONS"
  top=$(git rev-parse --show-toplevel 2>/dev/null) || return 0
  for f in "$top/CLAUDE.md" "$top/.claude/CLAUDE.md"; do
    [ -f "$f" ] && [ "$f" != "$INSTRUCTIONS" ] && printf '%s\n' "$f"
  done
  return 0
}

# Candidate conflicts, as <file>:<line>:<text>. The /hug skill decides which really conflict.
cmd_scan() {
  instruction_files | while IFS= read -r f; do
    [ -f "$f" ] && grep -n -i -E "$CONFLICTS" "$f" | sed "s|^|$f:|" || true
  done
  if hug_present; then echo "note: $INSTRUCTIONS already has HuG rules; on skips the import"; fi
}

backup() {
  dir=$STATE_DIR/backup/$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p "$dir"
  i=0
  sep=
  {
    printf '{\n  "items": [\n'
    for item in "$INSTRUCTIONS" "$SETTINGS" "$INTAKE" "$@"; do
      i=$((i + 1))
      if [ -e "$item" ]; then cp -R "$item" "$dir/$i-$(basename "$item")"; e=true; else e=false; fi
      printf '%s    { "path": "%s", "copy": "%s", "existed": %s }' "$sep" "$item" "$i-$(basename "$item")" "$e"
      sep=',
'
    done
    printf '\n  ]\n}\n'
  } > "$dir/manifest.json"
  set_state backup "$dir"
}

comment_out() {
  awk -v n="$2" 'NR == n { $0 = "<!-- hug-off: " $0 " -->" } 1' "$1" > "$1.tmp"
  mv "$1.tmp" "$1"
  grep -qxF "$1" "$STATE_DIR/commented" 2>/dev/null || printf '%s\n' "$1" >> "$STATE_DIR/commented"
}

# Add the attribution keys and deny rules that are missing; record exactly what was added.
settings_on() {
  added=$STATE_DIR/added-settings.json
  in=$(cat "$SETTINGS" 2>/dev/null || echo '{}')
  if have jq; then
    printf '%s' "$in" | jq -c --argjson deny "$DENY" \
      '{keys: [("includeCoAuthoredBy", "gitAttribution") as $k | select(has($k) | not) | $k],
        deny: ($deny - (.permissions.deny // []))}' > "$added"
    printf '%s' "$in" | jq --slurpfile a "$added" \
      '$a[0] as $a | . + ($a.keys | map({(.): false}) | add // {})
       | if ($a.deny | length) > 0 then .permissions.deny = ((.permissions.deny // []) + $a.deny) else . end' \
      > "$SETTINGS.tmp"
  elif have node; then
    printf '%s' "$in" | node -e '
      const fs = require("fs");
      const [deny, added, out] = process.argv.slice(1);
      const s = JSON.parse(fs.readFileSync(0, "utf8"));
      const have = (s.permissions && s.permissions.deny) || [];
      const a = {
        keys: ["includeCoAuthoredBy", "gitAttribution"].filter((k) => !(k in s)),
        deny: JSON.parse(deny).filter((d) => !have.includes(d)),
      };
      for (const k of a.keys) s[k] = false;
      if (a.deny.length) s.permissions = { ...s.permissions, deny: [...have, ...a.deny] };
      fs.writeFileSync(added, JSON.stringify(a) + "\n");
      fs.writeFileSync(out, JSON.stringify(s, null, 2) + "\n");
    ' "$DENY" "$added" "$SETTINGS.tmp"
  else
    echo "hug: neither jq nor node found; $SETTINGS left unchanged" >&2
    return 0
  fi
  mv "$SETTINGS.tmp" "$SETTINGS"
}

cmd_on() {
  comments=
  while [ $# -gt 0 ]; do
    case $1 in
      --comment) comments="$comments $2"; shift 2 ;;
      *) die "unknown option: $1" ;;
    esac
  done
  if [ "$(get state)" = on ]; then echo "HuG Flow is already on"; return 0; fi

  files=
  for c in $comments; do [ "${c%:*}" = "$INSTRUCTIONS" ] || files="$files ${c%:*}"; done
  # shellcheck disable=SC2086
  backup $files
  set_state instructions_existed "$([ -e "$INSTRUCTIONS" ] && echo 1 || echo 0)"
  set_state settings_existed "$([ -e "$SETTINGS" ] && echo 1 || echo 0)"
  : > "$STATE_DIR/commented"
  for c in $comments; do comment_out "${c%:*}" "${c##*:}"; done

  if hug_present; then
    set_state import 0
  else
    mkdir -p "$(dirname "$INSTRUCTIONS")"
    if [ -s "$INSTRUCTIONS" ] && [ -n "$(tail -c 1 "$INSTRUCTIONS")" ]; then echo >> "$INSTRUCTIONS"; fi
    printf '%s\n' "$IMPORT" >> "$INSTRUCTIONS"
    set_state import 1
  fi

  if [ -e "$INTAKE" ]; then
    set_state intake 0
  else
    mkdir -p "$(dirname "$INTAKE")"
    cp -R "$ROOT/examples/minimal/skills/intake" "$INTAKE"
    set_state intake 1
  fi

  settings_on
  set_state state on
  echo "HuG Flow is on. Backup: $(get backup). Revert with: hug.sh off"
}

cmd_status() {
  echo "HuG Flow: $([ "$(get state)" = on ] && echo on || echo off)"
  [ -f "$STATE" ] || return 0
  echo "backup: $(get backup)"
  if grep -qxF "$IMPORT" "$INSTRUCTIONS" 2>/dev/null; then
    echo "rules: imported in $INSTRUCTIONS"
  elif [ "$(get import)" = 0 ]; then
    echo "rules: already in $INSTRUCTIONS, not imported"
  fi
  [ "$(get intake)" = 1 ] && echo "intake skill: installed in $INTAKE"
  [ -s "$STATE_DIR/added-settings.json" ] && echo "settings added: $(cat "$STATE_DIR/added-settings.json")"
  [ -s "$STATE_DIR/commented" ] && echo "commented out in: $(tr '\n' ' ' < "$STATE_DIR/commented")"
  return 0
}

cmd=${1:-status}
[ $# -gt 0 ] && shift
case $cmd in
  scan) cmd_scan ;;
  on) cmd_on "$@" ;;
  status) cmd_status ;;
  *) die "usage: hug.sh scan | on [--comment <file>:<line>]... | status" ;;
esac
