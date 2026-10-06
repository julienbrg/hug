#!/bin/sh
# SessionStart: load the rickub commands only in repositories hosted on rickub.
url=$(git -C "${CLAUDE_PROJECT_DIR:-.}" remote get-url origin 2>/dev/null) || exit 0
case "$url" in
  *git.rickub.com*) cat "$HOME/.claude/instructions/RICKUB.md" ;;
esac
