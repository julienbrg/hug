// scripts/hug.sh: `on` applies the minimal setup, and `off` leaves the
// maintainer's setup exactly as it found it.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = join(import.meta.dirname, "..", "scripts", "hug.sh");
const skip =
  process.platform === "win32" || spawnSync("sh", ["-c", "true"]).error
    ? "needs a POSIX sh"
    : false;

function home(files: Record<string, string> = {}): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "hug-home-")));
  mkdirSync(join(dir, ".claude"));
  for (const [path, content] of Object.entries(files)) {
    writeFileSync(join(dir, ".claude", path), content);
  }
  return dir;
}

function hug(dir: string, ...args: string[]): string {
  const result = spawnSync("sh", [script, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, HOME: dir, CLAUDE_CONFIG_DIR: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const read = (dir: string, path: string) =>
  readFileSync(join(dir, ".claude", path), "utf8");

const mine = "# Mine\n\nAlways git add -A before committing.";
const settings = { model: "opus", permissions: { deny: ["Bash(git add .)"] } };

test(
  "on imports the rules, installs intake and adds only missing settings",
  { skip },
  () => {
    const dir = home({
      "CLAUDE.md": mine,
      "settings.json": JSON.stringify({ ...settings, gitAttribution: true }),
    });
    hug(dir, "on", "--comment", `${join(dir, ".claude", "CLAUDE.md")}:3`);

    const lines = read(dir, "CLAUDE.md").split("\n");
    assert.equal(
      lines[2],
      "<!-- hug-off: Always git add -A before committing. -->",
    );
    assert.match(lines[3], /^@.*examples\/minimal\/CLAUDE\.md$/);
    assert.ok(existsSync(join(dir, ".claude", "skills", "intake", "SKILL.md")));

    const after = JSON.parse(read(dir, "settings.json"));
    assert.equal(after.gitAttribution, true);
    assert.equal(after.includeCoAuthoredBy, false);
    assert.equal(
      after.permissions.deny.filter((d: string) => d === "Bash(git add .)")
        .length,
      1,
    );
    assert.ok(after.permissions.deny.includes("Bash(git add -A)"));
    assert.match(hug(dir, "status"), /HuG Flow: on/);
  },
);

test("off restores the setup on returns to", { skip }, () => {
  const dir = home({
    "CLAUDE.md": mine,
    "settings.json": JSON.stringify(settings),
  });
  hug(dir, "on", "--comment", `${join(dir, ".claude", "CLAUDE.md")}:3`);
  hug(dir, "off");

  assert.equal(read(dir, "CLAUDE.md"), mine);
  assert.deepEqual(JSON.parse(read(dir, "settings.json")), settings);
  assert.ok(!existsSync(join(dir, ".claude", "skills")));
  assert.match(hug(dir, "status"), /HuG Flow: off/);
});

test("off deletes what on created from nothing", { skip }, () => {
  const dir = home();
  hug(dir, "on");
  hug(dir, "off");

  for (const path of ["CLAUDE.md", "settings.json", "skills"]) {
    assert.ok(!existsSync(join(dir, ".claude", path)), path);
  }
});

test(
  "on twice keeps the first backup, and adds the import once",
  { skip },
  () => {
    const dir = home({ "CLAUDE.md": mine });
    hug(dir, "on");
    const first = /backup: (\S+)/.exec(hug(dir, "status"))?.[1];
    assert.match(hug(dir, "on"), /already on/);

    assert.equal(read(dir, "CLAUDE.md").match(/^@/gm)?.length, 1);
    assert.equal(/backup: (\S+)/.exec(hug(dir, "status"))?.[1], first);
  },
);

test(
  "rules already in the instructions are not imported again",
  { skip },
  () => {
    const dir = home({ "CLAUDE.md": "## Stage-then-commit loop\n" });
    hug(dir, "on");
    assert.equal(read(dir, "CLAUDE.md"), "## Stage-then-commit loop\n");
    hug(dir, "off");
    assert.equal(read(dir, "CLAUDE.md"), "## Stage-then-commit loop\n");
  },
);
