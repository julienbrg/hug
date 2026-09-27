// Throwaway repositories and hook runners for the scenario tests. `gh` is
// replaced by conformance/stubs/gh, which answers from HUG_STUB_CHECKS.

import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const root = join(import.meta.dirname, "..");
const stubs = join(import.meta.dirname, "stubs");

Object.assign(process.env, {
  GIT_AUTHOR_NAME: "Maintainer",
  GIT_AUTHOR_EMAIL: "maintainer@example.com",
  GIT_COMMITTER_NAME: "Maintainer",
  GIT_COMMITTER_EMAIL: "maintainer@example.com",
  GIT_CONFIG_NOSYSTEM: "1",
});

export function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

// A clone of a bare remote, with one commit on main pushed.
export function repo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "hug-")));
  git(dir, "init", "--quiet", "--bare", "--initial-branch=main", "remote.git");
  git(dir, "clone", "--quiet", "remote.git", "work");
  const work = join(dir, "work");
  git(work, "switch", "--quiet", "-c", "main");
  git(work, "commit", "--quiet", "--allow-empty", "-m", "init");
  git(work, "push", "--quiet", "-u", "origin", "main");
  git(work, "remote", "set-head", "origin", "main");
  return work;
}

export interface Outcome {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function hook(
  name: string,
  payload: object,
  env: Record<string, string> = {},
): Outcome {
  const result = spawnSync(
    process.execPath,
    [join(root, "reference", "src", "hooks", `${name}.ts`)],
    {
      input: JSON.stringify(payload),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${stubs}${delimiter}${process.env.PATH}`,
        ...env,
      },
    },
  );
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function bash(
  cwd: string,
  command: string,
  env: Record<string, string> = {},
): Outcome {
  return hook(
    "guard",
    { tool_name: "Bash", tool_input: { command }, cwd },
    env,
  );
}
