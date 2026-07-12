/**
 * Edge-safe console access without relying on DOM lib typings.
 */

interface MinimalConsole {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export function getConsole(): MinimalConsole | undefined {
  // why: core tsconfig lib is ES2022 only (no DOM); console exists on Node/Workers/browsers
  const c = (globalThis as { console?: MinimalConsole }).console;
  return c;
}
