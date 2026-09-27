// The ledger lists the paths the agent wrote, relative to the repository's
// top level, in <git-dir>/hug/ledger.json. The guard refuses to let the agent
// stage them, so its own work only enters the index through the maintainer.

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { gitDir, toplevel } from "./git.ts";

const caseInsensitive =
  process.platform === "darwin" || process.platform === "win32";

// Resolves symlinks, such as macOS's /tmp, even for a path that is gone.
function real(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : join(real(parent), basename(path));
  }
}

export interface Repo {
  top: string;
  file: string;
}

export function repo(cwd: string): Repo | null {
  const top = toplevel(cwd);
  const dir = gitDir(cwd);
  if (!top || !dir) return null;
  return { top: real(resolve(top)), file: join(dir, "hug", "ledger.json") };
}

export function key(repo: Repo, path: string): string {
  const rel = relative(repo.top, real(resolve(path)))
    .split(sep)
    .join("/");
  return caseInsensitive ? rel.toLowerCase() : rel;
}

export function read(repo: Repo): Set<string> {
  try {
    return new Set(JSON.parse(readFileSync(repo.file, "utf8")) as string[]);
  } catch {
    return new Set();
  }
}

export function write(repo: Repo, paths: Set<string>) {
  mkdirSync(dirname(repo.file), { recursive: true });
  writeFileSync(repo.file, `${JSON.stringify([...paths].sort(), null, 2)}\n`);
}
