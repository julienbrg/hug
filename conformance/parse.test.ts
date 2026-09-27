import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { mentionsGitOrGh, parse } from "../reference/src/lib/parse.ts";

function commands(line: string) {
  const result = parse(line);
  assert.ok(result.ok, `expected ${JSON.stringify(line)} to parse`);
  return result.commands;
}

function git(line: string) {
  return commands(line)
    .filter((c) => c.tool === "git")
    .map((c) => [c.subcommand, ...c.args.map((a) => a.value)].join(" "));
}

test("a plain command", () => {
  assert.deepEqual(git("git add -A"), ["add -A"]);
});

test("compound commands are split", () => {
  assert.deepEqual(git("git status && git add a; git add b || git add c"), [
    "status",
    "add a",
    "add b",
    "add c",
  ]);
  assert.deepEqual(git("git add a\ngit add b & git add c"), [
    "add a",
    "add b",
    "add c",
  ]);
  assert.deepEqual(git("git diff | git apply"), ["diff", "apply"]);
});

test("git global options are stripped", () => {
  const [add] = commands("git -C sub -c user.name=x --no-pager add .");
  assert.equal(add.subcommand, "add");
  assert.equal(add.cwd, "sub");
  assert.deepEqual(add.config, ["user.name=x"]);
  const [dir] = commands("git --git-dir=.git --work-tree . add .");
  assert.equal(dir.subcommand, "add");
  assert.equal(dir.cwd, null);
});

test("shells, eval, env and wrappers are unwrapped", () => {
  for (const line of [
    "sh -c 'git add .'",
    'bash -lc "git add ."',
    "zsh -c 'sh -c \"git add .\"'",
    "eval 'git add .'",
    "env FOO=1 -u BAR git add .",
    "FOO=1 git add .",
    "command git add .",
    "nohup git add .",
    "time git add .",
    "sudo -u me git add .",
    "timeout 5 git add .",
    "/usr/bin/git add .",
    "git.exe add .",
    "{ git add .; }",
    "(git add .)",
    "if true; then git add .; fi",
    "bash <<'EOF'\ngit add .\nEOF",
    "echo 'git add .' | sh",
  ]) {
    assert.deepEqual(git(line), ["add ."], line);
  }
});

test("command substitutions are parsed", () => {
  assert.deepEqual(git("echo $(git push origin main)"), ["push origin main"]);
  assert.deepEqual(git("echo `git push origin main`"), ["push origin main"]);
  assert.deepEqual(git('x="$(git add .)"'), ["add ."]);
  assert.deepEqual(git("diff <(git show :a) a"), ["show :a"]);
});

test("a heredoc message is resolved", () => {
  const line = `git commit -m "$(cat <<'EOF'\nfix it\n\nCo-Authored-By: C <c@x>\nEOF\n)"`;
  const [commit] = commands(line);
  assert.equal(commit.args[1].value, "fix it\n\nCo-Authored-By: C <c@x>");
  assert.equal(commit.args[1].dynamic, false);
});

test("stdin is resolved from heredocs, here-strings and echo", () => {
  const cases: [string, string][] = [
    ["git commit -F - <<EOF\nmsg\nEOF", "msg\n"],
    ["git commit -F - <<-EOF\n\tmsg\n\tEOF", "msg\n"],
    ["git commit -F - <<< 'msg'", "msg\n"],
    ["echo msg | git commit -F -", "msg\n"],
    ["printf 'msg' | git commit -F -", "msg"],
  ];
  for (const [line, stdin] of cases) {
    const commit = commands(line).find((c) => c.tool === "git");
    assert.equal(commit?.stdin, stdin, line);
  }
  assert.equal(commands("git commit -F - < file")[0].stdin, null);
});

test("expansions are marked dynamic", () => {
  for (const line of [
    'git add "$f"',
    "git add ${f}",
    "git add $(pick)",
    "git add $((1 + 1))",
  ]) {
    const add = commands(line).find((c) => c.tool === "git");
    assert.equal(add?.args[0].dynamic, true, line);
  }
  assert.equal(commands("git add '$f'")[0].args[0].dynamic, false);
});

test("globs are marked", () => {
  assert.equal(commands("git add src/*.ts")[0].args[0].glob, true);
  assert.equal(commands("git add {a,b}.ts")[0].args[0].glob, true);
  assert.equal(commands("git add 'src/*.ts'")[0].args[0].glob, false);
});

test("cd is tracked, and scoped to subshells", () => {
  const cwds = commands("cd a && git add x; (cd b; git add y); git add z")
    .filter((c) => c.tool === "git")
    .map((c) => c.cwd);
  assert.deepEqual(cwds, ["a", join("a", "b"), "a"]);
  assert.equal(commands("cd; git add x")[1].cwd, null);
  assert.equal(commands('cd "$d"; git add x')[1].cwd, null);
});

test("gh keeps its subcommand first", () => {
  const [merge] = commands("gh -R o/r pr merge 3 --squash");
  assert.equal(merge.tool, "gh");
  assert.equal(merge.subcommand, "pr");
  assert.deepEqual(
    merge.args.map((a) => a.value),
    ["merge", "3", "--squash", "-R", "o/r"],
  );
});

test("redirections and comments are not arguments", () => {
  assert.deepEqual(git("git status 2>&1 >/dev/null # git add ."), ["status"]);
  assert.deepEqual(git("git log &> out"), ["log"]);
});

test("what cannot be read with confidence fails", () => {
  for (const line of [
    "echo 'open",
    'echo "open',
    "echo $(git add .",
    "echo `git add .",
    "(git add .",
    "git add .)",
    "xargs git add < list",
    "find . -name '*.ts' -exec git add {} +",
    "$GIT add .",
    "git $SUB .",
    'eval "$CMD"',
    'sh -c "$CMD"',
    "cat script | bash",
    "env -S 'git add .'",
    "case $x in a) git add .;; esac",
  ]) {
    assert.equal(parse(line).ok, false, line);
  }
});

test("mentions of git or gh are detected", () => {
  assert.equal(mentionsGitOrGh("xargs git add"), true);
  assert.equal(mentionsGitOrGh("gh pr merge"), true);
  assert.equal(mentionsGitOrGh("/usr/bin/git.exe"), true);
  assert.equal(mentionsGitOrGh("digit high .gitignore"), false);
});
