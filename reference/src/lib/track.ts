// A track's confirmation, in <git-common-dir>/hug/track.json. Only the
// UserPromptSubmit hook writes it, when the maintainer types
// `Start track #<n>`; it records the tracking issue and its open sub-issues
// at that moment. The guard lets the agent stage its own work only on a
// branch linked to one of them.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { currentBranch, git } from "./git.ts";

export interface Track {
  tracking: number;
  issues: number[];
}

export function file(cwd: string): string | null {
  const common = git(
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    cwd,
  );
  return common ? join(common, "hug", "track.json") : null;
}

export function read(cwd: string): Track | null {
  const path = file(cwd);
  if (!path) return null;
  try {
    const track = JSON.parse(readFileSync(path, "utf8"));
    return Number.isInteger(track.tracking) && Array.isArray(track.issues)
      ? track
      : null;
  } catch {
    return null;
  }
}

export function write(cwd: string, track: Track) {
  const path = file(cwd);
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(track, null, 2)}\n`);
}

export function remove(cwd: string) {
  const path = file(cwd);
  if (path) rmSync(path, { force: true });
}

// The hash of the file as it is now, or "none", so a change made during an
// agent's tool call can be detected and the track revoked.
export function fingerprint(cwd: string): string {
  const path = file(cwd);
  try {
    return createHash("sha256")
      .update(readFileSync(path ?? ""))
      .digest("hex");
  } catch {
    return "none";
  }
}

// Whether the branch checked out in cwd, `<n>-<slug>`, belongs to the track.
export function covers(cwd: string): boolean {
  const track = read(cwd);
  const issue = /^(\d+)-/.exec(currentBranch(cwd) ?? "")?.[1];
  return !!track && !!issue && track.issues.includes(Number(issue));
}
