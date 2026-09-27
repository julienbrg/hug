// L2 scenarios for the Bash guard: the agent attempts an action, and the
// guard must block it (exit 2) or let it through (exit 0).

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { bash, git, hook, repo } from "./helpers.ts";

function blocked(cwd: string, command: string, env = {}) {
  const outcome = bash(cwd, command, env);
  assert.equal(outcome.code, 2, `expected a block: ${command}`);
  return outcome.stderr;
}

function allowed(cwd: string, command: string, env = {}) {
  const outcome = bash(cwd, command, env);
  assert.equal(
    outcome.code,
    0,
    `expected a pass: ${command}\n${outcome.stderr}`,
  );
}

function wrote(cwd: string, ...paths: string[]) {
  const file = join(git(cwd, "rev-parse", "--absolute-git-dir"), "hug");
  mkdirSync(file, { recursive: true });
  writeFileSync(join(file, "ledger.json"), JSON.stringify(paths));
}

function branch(cwd: string) {
  git(cwd, "switch", "--quiet", "-c", "1-feature");
  return cwd;
}

describe("I2: the agent never stages its own work", () => {
  const cwd = repo();
  mkdirSync(join(cwd, "src"));
  writeFileSync(join(cwd, "a.ts"), "agent\n");
  writeFileSync(join(cwd, "b.ts"), "maintainer\n");
  writeFileSync(join(cwd, "src", "c.ts"), "maintainer\n");
  wrote(cwd, "a.ts");

  test("staging a path the agent wrote is blocked", () => {
    assert.match(blocked(cwd, "git add a.ts"), /agent wrote a\.ts/);
    blocked(cwd, "git add b.ts a.ts");
    blocked(cwd, "git -C src add ../a.ts");
    blocked(cwd, "cd src && git add ../a.ts");
    blocked(cwd, "git stage a.ts");
  });

  test("staging the maintainer's chunk by path is allowed", () => {
    allowed(cwd, "git add b.ts");
    allowed(cwd, "git add src/c.ts");
    allowed(cwd, "git add -- b.ts");
  });

  test("bulk staging is blocked in every form", () => {
    for (const command of [
      "git add -A",
      "git add --all",
      "git add -u",
      "git add .",
      "git add src",
      "git add '*.ts'",
      "git add :/",
      "git -C . add .",
      "sh -c 'git add .'",
      'bash -lc "git add -A"',
      "eval 'git add .'",
      "env X=1 git add -A",
      "ls | xargs git add",
      'git add "$FILE"',
      "git commit -a -m wip",
      "git commit -am wip",
      "git commit -m wip a.ts",
      "git commit --only -m wip b.ts",
    ]) {
      blocked(cwd, command);
    }
  });

  test("other writers of the index are blocked", () => {
    for (const command of [
      "git rm b.ts",
      "git mv b.ts d.ts",
      "git apply --cached patch.diff",
      "git update-index --add a.ts",
      "git read-tree HEAD",
      "git commit-tree HEAD^{tree} -m x",
      "git update-ref refs/heads/main HEAD",
      "git revert HEAD",
    ]) {
      blocked(cwd, command);
    }
    allowed(cwd, "git update-index --refresh");
  });

  test("a private index, as for a fingerprint, is allowed", () => {
    allowed(
      cwd,
      "GIT_INDEX_FILE=/tmp/hug-idx sh -c 'git read-tree HEAD && git add -A && git write-tree'",
    );
    blocked(cwd, 'GIT_INDEX_FILE="$T" git add -A');
    blocked(cwd, "GIT_INDEX_FILE=/tmp/hug-idx git commit -m x");
  });

  test("commits nobody staged cannot be brought in", () => {
    const wip = join(cwd, "..", "wip");
    git(cwd, "worktree", "add", "--quiet", "--detach", wip);
    writeFileSync(join(wip, "e.ts"), "wip\n");
    git(wip, "add", "e.ts");
    git(wip, "commit", "--quiet", "-m", "wip");
    const commit = git(wip, "rev-parse", "HEAD");
    for (const sub of ["cherry-pick", "merge", "rebase", "reset --soft"]) {
      assert.match(blocked(cwd, `git ${sub} ${commit}`), /nobody staged/);
    }
    blocked(cwd, `git checkout ${commit} -- e.ts`);
    blocked(cwd, `git restore --staged --source ${commit} e.ts`);
    allowed(cwd, "git rebase origin/main");
    allowed(cwd, "git reset --soft HEAD");
    allowed(cwd, "git checkout main");
  });

  test("aliases are resolved", () => {
    git(cwd, "config", "alias.a", "add");
    git(cwd, "config", "alias.sh", "!git add -A");
    blocked(cwd, "git a -A");
    blocked(cwd, "git a a.ts");
    allowed(cwd, "git a b.ts");
    blocked(cwd, "git sh");
    blocked(cwd, "git -c alias.x=add x .");
  });
});

describe("I4: no push to main, no force-push", () => {
  const cwd = repo();

  test("pushing to main is blocked in every refspec form", () => {
    for (const command of [
      "git push",
      "git push origin",
      "git push origin main",
      "git push origin HEAD",
      "git push origin HEAD:main",
      "git push origin x:refs/heads/main",
      "git push origin :main",
      "git push origin --delete main",
      "git push --mirror",
      "git push --all",
    ]) {
      blocked(cwd, command);
    }
  });

  test("the issue branch pushes, and force-pushes only with a lease", () => {
    branch(cwd);
    allowed(cwd, "git push -u origin HEAD");
    allowed(cwd, "git push origin 1-feature");
    allowed(cwd, "git push --force-with-lease");
    allowed(cwd, "git push --force-with-lease origin 1-feature");
    blocked(cwd, "git push -f");
    blocked(cwd, "git push --force origin 1-feature");
    blocked(cwd, "git push origin +1-feature");
    blocked(cwd, "git push --force-with-lease origin other");
    blocked(cwd, "git push --no-verify");
    blocked(cwd, "git -c core.hooksPath=/dev/null push");
  });

  test("a branch switch and a push in one line are split", () => {
    assert.match(
      blocked(cwd, "git switch -c 2-next && git push -u origin HEAD"),
      /separate commands/,
    );
  });
});

describe("I5: the maintainer is the sole author", () => {
  const cwd = repo();
  const heredoc = (body: string) =>
    `git commit -m "$(cat <<'EOF'\n${body}\nEOF\n)"`;

  test("attribution in a commit message is blocked", () => {
    blocked(
      cwd,
      heredoc("add x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"),
    );
    blocked(
      cwd,
      heredoc("add x\n\n🤖 Generated with [Claude Code](https://claude.com)"),
    );
    blocked(cwd, "git commit -m 'add x' --trailer 'Co-authored-by: A <a@b>'");
    blocked(
      cwd,
      "printf 'add x\\n\\nCo-Authored-By: A <a@b>' | git commit -F -",
    );
    writeFileSync(join(cwd, "msg"), "add x\n\nco-authored-by: A <a@b>\n");
    blocked(cwd, "git commit -F msg");
    blocked(cwd, 'git commit -m "$MSG"');
    blocked(cwd, "git commit --author 'A <a@b>' -m x");
  });

  test("a plain message passes", () => {
    allowed(cwd, "git commit -m 'add parser'");
    allowed(cwd, heredoc("add parser"));
  });

  test("attribution in pull requests and issues is blocked", () => {
    blocked(cwd, "gh pr create -t x -b 'Generated with Claude Code'");
    blocked(cwd, "gh issue comment 3 --body 'Co-Authored-By: A <a@b>'");
    allowed(cwd, "gh pr create -t 'Add x' -b 'Closes #3'");
  });

  test("skipping the hooks is blocked", () => {
    blocked(cwd, "git commit --no-verify -m x");
    blocked(cwd, "git commit -n -m x");
  });
});

describe("I3: merge only on green checks", () => {
  const cwd = branch(repo());
  const green = JSON.stringify([{ name: "check", bucket: "pass" }]);

  test("a squash merge on green checks is allowed", () => {
    allowed(cwd, "gh pr merge 3 --squash --delete-branch", {
      HUG_STUB_CHECKS: green,
    });
    allowed(cwd, "gh pr merge 3 -s", {
      HUG_STUB_CHECKS: JSON.stringify([
        { name: "check", bucket: "pass" },
        { name: "optional", bucket: "skipping" },
      ]),
    });
  });

  test("red, pending, missing or unreadable checks block the merge", () => {
    for (const [bucket, pattern] of [
      ["fail", /check is fail/],
      ["pending", /check is pending/],
      ["cancel", /check is cancel/],
    ]) {
      const checks = JSON.stringify([{ name: "check", bucket }]);
      assert.match(
        blocked(cwd, "gh pr merge 3 --squash", { HUG_STUB_CHECKS: checks }),
        pattern as RegExp,
      );
    }
    assert.match(
      blocked(cwd, "gh pr merge 3 --squash", { HUG_STUB_CHECKS: "[]" }),
      /no check ran/,
    );
    assert.match(
      blocked(cwd, "gh pr merge 3 --squash", { HUG_STUB_CHECKS: "none" }),
      /no check ran/,
    );
    assert.match(
      blocked(cwd, "gh pr merge 3 --squash", { HUG_STUB_CHECKS: "error" }),
      /could not read/,
    );
  });

  test("merges that skip the checks or the squash are blocked", () => {
    const env = { HUG_STUB_CHECKS: green };
    blocked(cwd, "gh pr merge 3 --squash --admin", env);
    blocked(cwd, "gh pr merge 3 --squash --auto", env);
    blocked(cwd, "gh pr merge 3 --merge", env);
    blocked(cwd, "gh pr merge 3 -r", env);
    blocked(cwd, "gh pr merge 3", env);
    blocked(cwd, "gh api -X PUT repos/o/r/pulls/3/merge");
    blocked(cwd, "gh api -X DELETE repos/o/r/rulesets/1");
    allowed(cwd, "gh api repos/o/r/pulls/3");
  });
});

describe("the guard fails closed", () => {
  const cwd = repo();

  test("a git or gh command it cannot read is blocked", () => {
    assert.match(blocked(cwd, "echo 'git add ."), /cannot read/);
    blocked(cwd, "$GIT push origin main");
    blocked(cwd, 'sh -c "$CMD git"');
  });

  test("other commands it cannot read are left alone", () => {
    allowed(cwd, "echo 'unbalanced");
    allowed(cwd, "ls -la && pnpm test");
  });

  test("other tools are left alone", () => {
    const outcome = hook("guard", {
      tool_name: "Write",
      tool_input: { file_path: join(cwd, "x"), content: "git add -A" },
      cwd,
    });
    assert.equal(outcome.code, 0);
  });
});
