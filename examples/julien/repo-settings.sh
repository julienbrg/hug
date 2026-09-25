#!/usr/bin/env sh
# Apply the GitHub repository settings HuG Flow relies on in P6.
# Usage: ./repo-settings.sh <owner>/<repo>
set -eu

repo="${1:?usage: $0 <owner>/<repo>}"

# Squash-only merges, delete the head branch on merge.
gh repo edit "$repo" \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --enable-squash-merge \
  --delete-branch-on-merge

# Squash commit title = pull request title, body = the lowercase commits.
gh api -X PATCH "repos/$repo" \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=COMMIT_MESSAGES
