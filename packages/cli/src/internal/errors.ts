/**
 * Map unexpected errors to stderr-safe messages (never include detected values).
 */

export function formatCliError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
