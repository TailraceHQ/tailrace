/**
 * Minimal argv parsing - no CLI framework (hook spawn cost).
 */

export interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  flags: Map<string, string | boolean>;
}

/**
 * Parse `tailrace <command> [args...] [--flag] [--flag=value]`.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (token === "--") {
      positional.push(...rest.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        flags.set(token.slice(2, eq), token.slice(eq + 1));
        continue;
      }
      const name = token.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        flags.set(name, next);
        i++;
      } else {
        flags.set(name, true);
      }
      continue;
    }
    positional.push(token);
  }

  return { command, positional, flags };
}

export function flagBool(flags: Map<string, string | boolean>, name: string): boolean {
  const v = flags.get(name);
  return v === true || v === "true" || v === "1";
}

export function flagString(flags: Map<string, string | boolean>, name: string): string | undefined {
  const v = flags.get(name);
  if (v === undefined || typeof v === "boolean") return undefined;
  return v;
}
