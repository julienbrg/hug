#!/usr/bin/env sh
# Turn HuG Flow on or off for Claude Code. `off` reverts only what `on` added.
# Usage: hug.sh scan | on [--comment <file>:<line>]... [--repo <owner>/<repo>] | off | status
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
# Write <file>.tmp over <file> in place, so a symlinked dotfile stays a symlink.
replace() { cat "$1.tmp" > "$1"; rm -f "$1.tmp"; }

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
  replace "$1"
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
  replace "$SETTINGS"
}

# Remove exactly the keys and deny rules settings_on added.
settings_off() {
  added=$STATE_DIR/added-settings.json
  [ -f "$added" ] && [ -f "$SETTINGS" ] || return 0
  if have jq; then
    jq --slurpfile a "$added" \
      '$a[0] as $a | reduce $a.keys[] as $k (.; del(.[$k]))
       | if .permissions.deny then .permissions.deny -= $a.deny else . end
       | if .permissions.deny == [] then del(.permissions.deny) else . end
       | if .permissions == {} then del(.permissions) else . end' \
      "$SETTINGS" > "$SETTINGS.tmp"
  elif have node; then
    node -e '
      const fs = require("fs");
      const [file, added] = process.argv.slice(1);
      const s = JSON.parse(fs.readFileSync(file, "utf8"));
      const a = JSON.parse(fs.readFileSync(added, "utf8"));
      for (const k of a.keys) delete s[k];
      if (s.permissions && s.permissions.deny) {
        s.permissions.deny = s.permissions.deny.filter((d) => !a.deny.includes(d));
        if (!s.permissions.deny.length) delete s.permissions.deny;
        if (!Object.keys(s.permissions).length) delete s.permissions;
      }
      fs.writeFileSync(file + ".tmp", JSON.stringify(s, null, 2) + "\n");
    ' "$SETTINGS" "$added"
  else
    die "neither jq nor node found; remove the entries in $added from $SETTINGS by hand"
  fi
  replace "$SETTINGS"
  if [ "$(get settings_existed)" = 0 ] && [ "$(tr -d ' \n' < "$SETTINGS")" = "{}" ]; then rm -f "$SETTINGS"; fi
  rm -f "$added"
}

# Squash-only merges and the hug-flow ruleset, through `hug init`. Needs admin rights on the repository.
repo_on() {
  have gh || die "--repo needs gh, logged in"
  dir=$(get backup)
  gh api "repos/$1" > "$dir/repo.json"
  gh api "repos/$1/rulesets" > "$dir/rulesets.json"
  merge=$(gh api "repos/$1" --jq '[.allow_merge_commit, .allow_rebase_merge, .allow_squash_merge, .delete_branch_on_merge, .squash_merge_commit_title, .squash_merge_commit_message] | map(tostring) | join(" ")')
  if gh api "repos/$1/rulesets" --jq '.[].name' | grep -qx hug-flow; then
    echo "hug: $1 already has a hug-flow ruleset; left as is"
    return 0
  fi
  node "$ROOT/reference/src/cli/hug.ts" init "$1" >/dev/null || die "hug init $1 failed; nothing was changed"
  set_state repo "$1"
  set_state repo_merge "$merge"
  set_state ruleset "$(gh api "repos/$1/rulesets" --jq '.[] | select(.name == "hug-flow") | .id')"
}

repo_off() {
  repo=$(get repo)
  [ -n "$repo" ] || return 0
  id=$(get ruleset)
  if [ -n "$id" ]; then gh api -X DELETE "repos/$repo/rulesets/$id" >/dev/null; fi
  # shellcheck disable=SC2046
  set -- $(get repo_merge)
  gh api -X PATCH "repos/$repo" -F allow_merge_commit="$1" -F allow_rebase_merge="$2" \
    -F allow_squash_merge="$3" -F delete_branch_on_merge="$4" >/dev/null
  if [ "$5" != null ]; then
    gh api -X PATCH "repos/$repo" -f squash_merge_commit_title="$5" -f squash_merge_commit_message="$6" >/dev/null
  fi
  set_state repo ""
  set_state ruleset ""
}

cmd_on() {
  comments=
  repo=
  while [ $# -gt 0 ]; do
    case $1 in
      --comment) comments="$comments $2"; shift 2 ;;
      --repo) repo=$2; shift 2 ;;
      *) die "unknown option: $1" ;;
    esac
  done
  if [ "$(get state)" = on ]; then echo "HuG Flow is already on"; return 0; fi

  files=
  for c in $comments; do [ "${c%:*}" = "$INSTRUCTIONS" ] || files="$files ${c%:*}"; done
  # shellcheck disable=SC2086
  backup $files
  set_state repo ""
  if [ -n "$repo" ]; then repo_on "$repo"; fi
  set_state instructions_existed "$([ -e "$INSTRUCTIONS" ] && echo 1 || echo 0)"
  set_state settings_existed "$([ -e "$SETTINGS" ] && echo 1 || echo 0)"
  : > "$STATE_DIR/commented"
  # Editing a file whose last line has no newline adds one; off takes it back out.
  : > "$STATE_DIR/no-final-newline"
  for f in "$INSTRUCTIONS" $files; do
    if [ -s "$f" ] && [ -n "$(tail -c 1 "$f")" ]; then printf '%s\n' "$f" >> "$STATE_DIR/no-final-newline"; fi
  done
  for c in $comments; do comment_out "${c%:*}" "${c##*:}"; done

  if hug_present; then
    set_state import 0
  else
    mkdir -p "$(dirname "$INSTRUCTIONS")"
    if [ -s "$INSTRUCTIONS" ] && [ -n "$(tail -c 1 "$INSTRUCTIONS")" ]; then echo >> "$INSTRUCTIONS"; fi
    printf '%s\n' "$IMPORT" >> "$INSTRUCTIONS"
    set_state import 1
  fi

  set_state skills_existed "$([ -e "$(dirname "$INTAKE")" ] && echo 1 || echo 0)"
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

cmd_off() {
  if [ "$(get state)" != on ]; then echo "HuG Flow is already off"; return 0; fi

  if [ "$(get import)" = 1 ] && [ -f "$INSTRUCTIONS" ]; then
    grep -vxF "$IMPORT" "$INSTRUCTIONS" > "$INSTRUCTIONS.tmp" || true
    replace "$INSTRUCTIONS"
    if [ "$(get instructions_existed)" = 0 ] && [ ! -s "$INSTRUCTIONS" ]; then rm -f "$INSTRUCTIONS"; fi
  fi

  while IFS= read -r f; do
    [ -f "$f" ] || continue
    sed 's/^<!-- hug-off: \(.*\) -->$/\1/' "$f" > "$f.tmp"
    replace "$f"
  done < "$STATE_DIR/commented"
  : > "$STATE_DIR/commented"

  while IFS= read -r f; do
    [ -f "$f" ] || continue
    printf '%s' "$(cat "$f")" > "$f.tmp"
    replace "$f"
  done < "$STATE_DIR/no-final-newline"
  : > "$STATE_DIR/no-final-newline"

  if [ "$(get intake)" = 1 ]; then rm -rf "$INTAKE"; fi
  if [ "$(get skills_existed)" = 0 ]; then rmdir "$(dirname "$INTAKE")" 2>/dev/null || true; fi
  settings_off
  repo_off
  set_state state off
  echo "HuG Flow is off. The backup stays in $(get backup)"
}

cmd_status() {
  echo "HuG Flow: $([ "$(get state)" = on ] && echo on || echo off)"
  [ "$(get state)" = on ] || return 0
  echo "backup: $(get backup)"
  if grep -qxF "$IMPORT" "$INSTRUCTIONS" 2>/dev/null; then
    echo "rules: imported in $INSTRUCTIONS"
  elif [ "$(get import)" = 0 ]; then
    echo "rules: already in $INSTRUCTIONS, not imported"
  fi
  [ "$(get intake)" = 1 ] && echo "intake skill: installed in $INTAKE"
  [ -s "$STATE_DIR/added-settings.json" ] && echo "settings added: $(cat "$STATE_DIR/added-settings.json")"
  [ -s "$STATE_DIR/commented" ] && echo "commented out in: $(tr '\n' ' ' < "$STATE_DIR/commented")"
  repo=$(get repo)
  if [ -n "$repo" ]; then
    id=$(gh api "repos/$repo/rulesets" --jq '.[] | select(.name == "hug-flow") | .id' 2>/dev/null || true)
    echo "repository: $repo, hug-flow ruleset ${id:-missing}"
  fi
  return 0
}

cmd=${1:-status}
[ $# -gt 0 ] && shift
case $cmd in
  scan) cmd_scan ;;
  on) cmd_on "$@" ;;
  off) cmd_off ;;
  status) cmd_status ;;
  *) die "usage: hug.sh scan | on [--comment <file>:<line>]... [--repo <owner>/<repo>] | off | status" ;;
esac
