// Normalizes a shell command line into the simple commands it runs, so the
// guard sees `git add -A` whether it was written plainly, after `git -C x`,
// inside `sh -c '…'`, behind `env`, `eval` or `sudo`, or in a `$(…)`.
// Anything it cannot read with confidence throws, and the guard fails closed.

import { isAbsolute, join } from "node:path";

export interface Word {
  value: string;
  // Holds an expansion whose value is unknown until the shell runs it.
  dynamic: boolean;
  // Holds an unquoted glob or brace expansion.
  glob: boolean;
}

export interface Command {
  tool: "git" | "gh" | "other";
  program: string;
  subcommand: string | null;
  args: Word[];
  // git `-c key=value` options.
  config: string[];
  // Directory the command runs in, relative to where the line runs; null
  // when a `cd` or `--git-dir` makes it unknown.
  cwd: string | null;
  // Text on stdin when it is known (heredoc, here-string, piped echo).
  stdin: string | null;
  // Variables set for the command by `NAME=value`, `env` or `export`.
  env: Env;
}

export type Env = Record<string, Word>;

export type ParseResult =
  { ok: true; commands: Command[] } | { ok: false; reason: string };

export class Unparseable extends Error {}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const MENTION = /(^|[^\w.-])(git|gh)(\.exe)?([^\w.-]|$)/i;
const KEYWORDS = new Set([
  "if",
  "then",
  "else",
  "elif",
  "do",
  "while",
  "until",
  "!",
  "{",
  "}",
  "fi",
  "done",
]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
// Programs that run another command taken from their arguments.
const RUNNERS = new Set(["xargs", "parallel", "find", "watch", "flock"]);
const REDIRECTS = [
  "<<<",
  "<<-",
  "<<",
  "<>",
  "<&",
  "<",
  "&>>",
  "&>",
  ">>",
  ">&",
  ">|",
  ">",
];

export function mentionsGitOrGh(text: string): boolean {
  return MENTION.test(text);
}

export function parse(line: string, cwd = "."): ParseResult {
  try {
    return { ok: true, commands: new Parser(line, cwd).run() };
  } catch (e) {
    if (e instanceof Unparseable) return { ok: false, reason: e.message };
    throw e;
  }
}

interface Draft {
  words: Word[];
  stdin: string | null;
  redirectedStdin: boolean;
}

interface Heredoc {
  delimiter: string;
  strip: boolean;
  draft: Draft;
}

type Item = { draft: Draft; pipe: boolean } | { mark: "enter" | "leave" };

class Level {
  queue: Item[] = [];
  pending: Heredoc[] = [];
  commands: Command[] = [];
  stack: (string | null)[] = [];
  output: string | null = null;
  piped = false;
  cwd: string | null;
  env: Env;

  constructor(cwd: string | null, env: Env) {
    this.cwd = cwd;
    this.env = env;
  }
}

function draft(): Draft {
  return { words: [], stdin: null, redirectedStdin: false };
}

function chdir(cwd: string | null, dir: Word | undefined): string | null {
  if (cwd === null || !dir || dir.dynamic || dir.glob) return null;
  if (dir.value === "-" || dir.value.startsWith("~")) return null;
  return isAbsolute(dir.value) ? dir.value : join(cwd, dir.value);
}

function assign(env: Env, word: Word) {
  const eq = word.value.indexOf("=");
  env[word.value.slice(0, eq)] = { ...word, value: word.value.slice(eq + 1) };
}

function isGitOrGh(word: Word): boolean {
  return MENTION.test(word.value);
}

class Parser {
  private pos = 0;
  private readonly inner: Command[] = [];
  private readonly src: string;
  private readonly cwd: string | null;
  private readonly env: Env;

  constructor(src: string, cwd: string | null, env: Env = {}) {
    this.src = src;
    this.cwd = cwd;
    this.env = env;
  }

  run(): Command[] {
    return [...this.list(false, this.cwd, this.env).commands, ...this.inner];
  }

  private list(sub: boolean, cwd: string | null, env: Env): Level {
    const level = new Level(cwd, { ...env });
    let current = draft();
    let depth = 0;
    const end = (pipe: boolean) => {
      if (current.words.length) {
        level.queue.push({ draft: current, pipe });
      }
      current = draft();
      if (!level.pending.length) this.flush(level);
    };
    const src = this.src;

    for (;;) {
      this.skipBlanks();
      if (this.pos >= src.length) {
        if (sub) throw new Unparseable("unterminated command substitution");
        break;
      }
      const c = src[this.pos];
      const next = src[this.pos + 1];
      if (c === "#") {
        while (this.pos < src.length && src[this.pos] !== "\n") this.pos++;
      } else if (c === "\n") {
        this.pos++;
        end(false);
        this.readHeredocs(level);
      } else if (c === ";") {
        this.pos++;
        end(false);
      } else if (c === "&" && next !== ">") {
        this.pos += next === "&" ? 2 : 1;
        end(false);
      } else if (c === "|") {
        this.pos += next === "|" || next === "&" ? 2 : 1;
        end(next !== "|");
      } else if (c === "(") {
        this.pos++;
        end(false);
        level.queue.push({ mark: "enter" });
        depth++;
      } else if (c === ")") {
        this.pos++;
        end(false);
        if (depth === 0) {
          if (sub) break;
          throw new Unparseable("unbalanced parenthesis");
        }
        level.queue.push({ mark: "leave" });
        depth--;
      } else if ((c === "<" || c === ">") && next === "(") {
        current.words.push(this.word(level));
      } else if (c === "<" || c === ">" || c === "&") {
        this.redirect(current, level);
      } else {
        const start = this.pos;
        const word = this.word(level);
        const fd = /^\d+$/.test(word.value) && src.slice(start, this.pos);
        if (fd === word.value && /[<>]/.test(src[this.pos] ?? "")) {
          this.redirect(current, level);
        } else {
          current.words.push(word);
        }
      }
    }

    end(false);
    if (level.pending.length) this.readHeredocs(level);
    if (depth !== 0) throw new Unparseable("unbalanced parenthesis");
    return level;
  }

  private skipBlanks() {
    const src = this.src;
    while (this.pos < src.length) {
      if (src[this.pos] === " " || src[this.pos] === "\t") this.pos++;
      else if (src.startsWith("\\\n", this.pos)) this.pos += 2;
      else break;
    }
  }

  private redirect(current: Draft, level: Level) {
    const op = REDIRECTS.find((o) => this.src.startsWith(o, this.pos));
    if (!op) throw new Unparseable("unknown redirection");
    this.pos += op.length;
    this.skipBlanks();
    const target = this.word(level);
    if (!target.value && !target.dynamic) {
      throw new Unparseable(`missing target after ${op}`);
    }
    if (op === "<<" || op === "<<-") {
      current.redirectedStdin = true;
      level.pending.push({
        delimiter: target.value,
        strip: op === "<<-",
        draft: current,
      });
    } else if (op === "<<<") {
      current.redirectedStdin = true;
      current.stdin = target.dynamic ? null : `${target.value}\n`;
    } else if (op === "<" || op === "<>") {
      current.redirectedStdin = true;
      current.stdin = null;
    }
  }

  private readHeredocs(level: Level) {
    const src = this.src;
    for (const heredoc of level.pending) {
      let body = "";
      while (this.pos < src.length) {
        const newline = src.indexOf("\n", this.pos);
        const lineEnd = newline === -1 ? src.length : newline;
        let line = src.slice(this.pos, lineEnd);
        this.pos = newline === -1 ? src.length : newline + 1;
        if (heredoc.strip) line = line.replace(/^\t+/, "");
        if (line === heredoc.delimiter) break;
        body += `${line}\n`;
      }
      heredoc.draft.stdin = body;
    }
    level.pending = [];
    this.flush(level);
  }

  private flush(level: Level) {
    for (let item = level.queue.shift(); item; item = level.queue.shift()) {
      if ("mark" in item) {
        if (item.mark === "enter") level.stack.push(level.cwd);
        else level.cwd = level.stack.pop() ?? null;
        level.output = null;
        level.piped = false;
        continue;
      }
      const { draft, pipe } = item;
      const stdin = draft.redirectedStdin
        ? draft.stdin
        : level.piped
          ? level.output
          : null;
      level.output = null;
      level.commands.push(...this.build(draft.words, stdin, level));
      level.piped = pipe;
    }
  }

  private build(input: Word[], stdin: string | null, level: Level) {
    const words = [...input];
    while (words.length && KEYWORDS.has(words[0].value)) words.shift();
    const env = { ...level.env };
    while (words.length && ASSIGNMENT.test(words[0].value)) {
      assign(env, words.shift()!);
    }
    if (!words.length) return [];
    const head = words[0].value;
    if (head === "for" || head === "select" || head === "function") return [];
    if (head === "case") throw new Unparseable("case statements");
    if (head === "export") {
      for (const word of words.slice(1)) {
        if (ASSIGNMENT.test(word.value)) assign(level.env, word);
      }
      return [];
    }
    return this.unwrap(words, stdin, level, env);
  }

  private unwrap(
    words: Word[],
    stdin: string | null,
    level: Level,
    env: Env,
  ): Command[] {
    const [head, ...rest] = words;
    if (head.dynamic) throw new Unparseable("the command name is not static");
    const program = head.value
      .split(/[/\\]/)
      .pop()!
      .replace(/\.exe$/i, "");
    const other = (): Command[] => [
      {
        tool: "other",
        program,
        subcommand: null,
        args: rest,
        config: [],
        cwd: level.cwd,
        stdin,
        env,
      },
    ];
    const skip = (withValue: string[], from = 0) => {
      let i = from;
      while (i < rest.length && rest[i].value.startsWith("-")) {
        if (rest[i].value === "--") return i + 1;
        i += withValue.includes(rest[i].value) ? 2 : 1;
      }
      return i;
    };
    const then = (i: number) =>
      i < rest.length ? this.unwrap(rest.slice(i), stdin, level, env) : other();

    switch (program) {
      case "git":
        return this.git(rest, stdin, level, env);
      case "gh":
        return this.gh(rest, stdin, level, env);
      case "env": {
        let i = 0;
        while (i < rest.length) {
          const v = rest[i].value;
          if (["-C", "--chdir", "-S", "--split-string"].includes(v)) {
            throw new Unparseable(`env ${v}`);
          }
          if (v === "-i" || v === "--ignore-environment") {
            for (const name of Object.keys(env)) delete env[name];
            i++;
          } else if (v === "-u" || v === "--unset") {
            delete env[rest[i + 1]?.value ?? ""];
            i += 2;
          } else if (ASSIGNMENT.test(v)) {
            assign(env, rest[i]);
            i++;
          } else if (v.startsWith("-")) {
            i++;
          } else {
            break;
          }
        }
        return then(i);
      }
      case "command":
      case "builtin":
        if (rest[0] && /^-[a-zA-Z]*[vV]/.test(rest[0].value)) return other();
        return then(skip([]));
      case "exec":
      case "nohup":
      case "noglob":
      case "nocorrect":
      case "time":
        return then(skip(["-a"]));
      case "nice":
        return then(skip(["-n"]));
      case "timeout":
        return then(skip(["-s", "-k"]) + 1);
      case "stdbuf":
        return then(skip(["-i", "-o", "-e"]));
      case "sudo":
      case "doas":
        return then(
          skip(["-u", "-g", "-C", "-D", "-h", "-p", "-r", "-t", "-U", "-T"]),
        );
      case "eval":
        if (rest.some((w) => w.dynamic)) {
          throw new Unparseable("eval of a dynamic string");
        }
        return this.nested(rest.map((w) => w.value).join(" "), level.cwd, env);
      case "cd":
        level.cwd = chdir(
          level.cwd,
          rest.find((w) => !/^-/.test(w.value)),
        );
        return other();
      case "pushd":
      case "popd":
        level.cwd = null;
        return other();
      case "echo": {
        const flags = rest.filter((w) => /^-[neE]+$/.test(w.value));
        const text = rest.slice(flags.length);
        const newline = !flags.some((w) => w.value.includes("n"));
        if (!text.some((w) => w.dynamic)) {
          level.output =
            text.map((w) => w.value).join(" ") + (newline ? "\n" : "");
        }
        return other();
      }
      case "printf":
        if (rest.length === 1 && !rest[0].dynamic && !/%/.test(rest[0].value)) {
          level.output = rest[0].value.replace(/\\n/g, "\n");
        }
        return other();
      case "cat":
        if (!rest.length) level.output = stdin;
        return other();
    }

    if (SHELLS.has(program)) {
      let i = 0;
      let script = false;
      while (i < rest.length && /^[-+]/.test(rest[i].value)) {
        const v = rest[i].value;
        if (v === "--") {
          i++;
          break;
        }
        if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(v)) script = true;
        i += /^[-+][oO]$/.test(v) ? 2 : 1;
      }
      if (script) {
        const text = rest[i];
        if (!text) throw new Unparseable(`${program} -c without a script`);
        if (text.dynamic)
          throw new Unparseable(`${program} -c of a dynamic script`);
        return this.nested(text.value, level.cwd, env);
      }
      if (i < rest.length) return other();
      if (stdin === null) {
        throw new Unparseable(`${program} reading an unknown script on stdin`);
      }
      return this.nested(stdin, level.cwd, env);
    }

    if (RUNNERS.has(program) && rest.some(isGitOrGh)) {
      throw new Unparseable(`${program} running git or gh`);
    }
    return other();
  }

  private git(
    rest: Word[],
    stdin: string | null,
    level: Level,
    env: Env,
  ): Command[] {
    let cwd = level.cwd;
    const config: string[] = [];
    let i = 0;
    while (i < rest.length) {
      const v = rest[i].value;
      if (v === "-C") {
        cwd = chdir(cwd, rest[i + 1]);
        i += 2;
      } else if (v === "-c") {
        const pair = rest[i + 1];
        if (!pair || pair.dynamic) throw new Unparseable("git -c value");
        config.push(pair.value);
        i += 2;
      } else if (v === "--git-dir" || v === "--work-tree") {
        cwd = null;
        i += 2;
      } else if (/^--(git-dir|work-tree)=/.test(v)) {
        cwd = null;
        i++;
      } else if (
        ["--namespace", "--super-prefix", "--config-env"].includes(v)
      ) {
        i += 2;
      } else if (v.startsWith("-")) {
        i++;
      } else {
        break;
      }
    }
    const sub = rest[i];
    if (sub?.dynamic) throw new Unparseable("the git subcommand is not static");
    return [
      {
        tool: "git",
        program: "git",
        subcommand: sub?.value ?? null,
        args: rest.slice(i + 1),
        config,
        cwd,
        stdin,
        env,
      },
    ];
  }

  private gh(
    rest: Word[],
    stdin: string | null,
    level: Level,
    env: Env,
  ): Command[] {
    let i = 0;
    while (i < rest.length && rest[i].value.startsWith("-")) {
      i += ["-R", "--repo"].includes(rest[i].value) ? 2 : 1;
    }
    const sub = rest[i];
    if (sub?.dynamic) throw new Unparseable("the gh subcommand is not static");
    return [
      {
        tool: "gh",
        program: "gh",
        subcommand: sub?.value ?? null,
        args: [...rest.slice(i + 1), ...rest.slice(0, i)],
        config: [],
        cwd: level.cwd,
        stdin,
        env,
      },
    ];
  }

  private nested(script: string, cwd: string | null, env: Env): Command[] {
    return new Parser(script, cwd, env).run();
  }

  // Reads one word from this.pos, resolving quotes and marking expansions.
  private word(level: Level): Word {
    const src = this.src;
    let value = "";
    let dynamic = false;
    let glob = false;
    let unquoted = "";

    if (
      (src[this.pos] === "<" || src[this.pos] === ">") &&
      src[this.pos + 1] === "("
    ) {
      this.pos += 2;
      this.inner.push(...this.list(true, level.cwd, level.env).commands);
      return { value: "", dynamic: true, glob: false };
    }

    while (this.pos < src.length) {
      const c = src[this.pos];
      if (" \t\n;&|()<>".includes(c)) break;
      if (c === "\\") {
        if (src[this.pos + 1] !== "\n") value += src[this.pos + 1] ?? "";
        this.pos += 2;
      } else if (c === "'") {
        const close = src.indexOf("'", this.pos + 1);
        if (close === -1) throw new Unparseable("unbalanced single quote");
        value += src.slice(this.pos + 1, close);
        this.pos = close + 1;
      } else if (c === '"') {
        this.pos++;
        const part = this.doubleQuoted(level);
        value += part.value;
        dynamic ||= part.dynamic;
      } else if (c === "$" || c === "`") {
        const part = this.expansion(level, false);
        value += part.value;
        dynamic ||= part.dynamic;
      } else {
        if ("*?[".includes(c)) glob = true;
        value += c;
        unquoted += c;
        this.pos++;
      }
    }
    if (/\{[^}]*(,|\.\.)[^}]*\}/.test(unquoted)) glob = true;
    return { value, dynamic, glob };
  }

  private doubleQuoted(level: Level): Word {
    const src = this.src;
    let value = "";
    let dynamic = false;
    for (;;) {
      if (this.pos >= src.length) {
        throw new Unparseable("unbalanced double quote");
      }
      const c = src[this.pos];
      if (c === '"') {
        this.pos++;
        return { value, dynamic, glob: false };
      }
      if (c === "\\") {
        const next = src[this.pos + 1];
        if (next === "\n") {
          // line continuation
        } else if (next !== undefined && '$`"\\'.includes(next)) {
          value += next;
        } else {
          value += c + (next ?? "");
        }
        this.pos += 2;
      } else if (c === "$" || c === "`") {
        const part = this.expansion(level, true);
        value += part.value;
        dynamic ||= part.dynamic;
      } else {
        value += c;
        this.pos++;
      }
    }
  }

  // Reads a `$…` or backtick expansion. A command substitution is parsed, its
  // commands are kept for the guard, and its output is resolved when it is a
  // plain heredoc, echo or printf.
  private expansion(level: Level, quoted: boolean): Word {
    const src = this.src;
    const unknown = { value: "", dynamic: true, glob: false };

    if (src[this.pos] === "`") {
      let i = this.pos + 1;
      let body = "";
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\" && "`\\$".includes(src[i + 1] ?? "")) i++;
        body += src[i++];
      }
      if (i >= src.length) throw new Unparseable("unbalanced backtick");
      this.pos = i + 1;
      const parser = new Parser(body, level.cwd, level.env);
      const sub = parser.list(false, level.cwd, level.env);
      this.inner.push(...sub.commands, ...parser.inner);
      return this.substituted(sub);
    }

    const next = src[this.pos + 1];
    if (next === "(" && src[this.pos + 2] === "(") {
      let depth = 0;
      let i = this.pos + 1;
      do {
        if (i >= src.length) throw new Unparseable("unbalanced $((");
        if (src[i] === "(") depth++;
        if (src[i] === ")") depth--;
        i++;
      } while (depth > 0);
      this.pos = i;
      return unknown;
    }
    if (next === "(") {
      this.pos += 2;
      const sub = this.list(true, level.cwd, level.env);
      this.inner.push(...sub.commands);
      return this.substituted(sub);
    }
    if (next === "{") {
      const close = src.indexOf("}", this.pos);
      if (close === -1) throw new Unparseable("unbalanced ${");
      this.pos = close + 1;
      return unknown;
    }
    if (next === "'" && !quoted) {
      let i = this.pos + 2;
      let value = "";
      const escapes: Record<string, string> = { n: "\n", t: "\t", r: "\r" };
      while (i < src.length && src[i] !== "'") {
        if (src[i] === "\\" && i + 1 < src.length) {
          value += escapes[src[i + 1]] ?? src[i + 1];
          i += 2;
        } else {
          value += src[i++];
        }
      }
      if (i >= src.length) throw new Unparseable("unbalanced $'");
      this.pos = i + 1;
      return { value, dynamic: false, glob: false };
    }
    if (next === '"' && !quoted) {
      this.pos += 2;
      return this.doubleQuoted(level);
    }
    const name = /^\$([A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/.exec(
      src.slice(this.pos),
    );
    if (name) {
      this.pos += name[0].length;
      return unknown;
    }
    this.pos++;
    return { value: "$", dynamic: false, glob: false };
  }

  private substituted(sub: Level): Word {
    if (sub.output === null) return { value: "", dynamic: true, glob: false };
    return {
      value: sub.output.replace(/\n+$/, ""),
      dynamic: false,
      glob: false,
    };
  }
}
