import { spawnSync } from "node:child_process";

export interface Run {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export function run(program: string, args: string[], cwd: string): Run {
  const result = spawnSync(program, args, {
    cwd,
    encoding: "utf8",
    // gh can be a .cmd shim on Windows, which only a shell resolves.
    shell: program === "gh" && process.platform === "win32",
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function git(args: string[], cwd: string): string | null {
  const result = run("git", args, cwd);
  return result.ok ? result.stdout.trim() : null;
}

export function toplevel(cwd: string): string | null {
  return git(["rev-parse", "--show-toplevel"], cwd);
}

export function gitDir(cwd: string): string | null {
  return git(["rev-parse", "--absolute-git-dir"], cwd);
}

export function currentBranch(cwd: string): string | null {
  return git(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd);
}

export function defaultBranch(cwd: string): string {
  const head = git(
    ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
    cwd,
  );
  return head ? head.replace(/^[^/]+\//, "") : "main";
}

// A revision holds reviewed content when it is already in the current
// branch's history or on a remote.
export function reviewed(rev: string, cwd: string): boolean {
  if (git(["merge-base", "--is-ancestor", rev, "HEAD"], cwd) !== null) {
    return true;
  }
  return !!git(["branch", "-r", "--contains", rev], cwd);
}
