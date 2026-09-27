// hug: the command-line half of the reference implementation.
//   node reference/src/cli/hug.ts init <owner/repo> [--checks a,b] [--dry-run]
//   node reference/src/cli/hug.ts audit <owner/repo> [--limit n] [--since sha]

import { audit } from "./audit.ts";
import { init } from "./init.ts";

const [command, ...args] = process.argv.slice(2);
const commands: Record<string, (args: string[]) => number> = { init, audit };

if (!command || !(command in commands)) {
  console.error(`usage: hug <${Object.keys(commands).join("|")}> <owner/repo>`);
  process.exit(2);
}
try {
  process.exitCode = commands[command](args);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
