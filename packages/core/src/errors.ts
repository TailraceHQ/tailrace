/**
 * Typed error taxonomy (docs/conventions.md §Error taxonomy).
 *
 * Every Tailrace error carries a stable string `code`. Error messages MUST NEVER
 * contain a detected value - only entity classes, rule paths, and hashes. This is
 * enforced by a test that greps thrown messages against fixture values.
 */

import type { Decision } from "./types";
import { withDocsUrl } from "./errors-docs";

/** Base class for every error thrown by Tailrace. */
export class TailraceError extends Error {
  /** Stable, machine-readable error code. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(withDocsUrl(code, message));
    this.name = new.target.name;
    this.code = code;
    // Restore prototype chain when targeting ES5-ish down-level output.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A `block` policy matched. Integrations translate this into their host framework's
 * native failure mode. Carries the decisions that triggered the block; never a value.
 */
export class PolicyViolationError extends TailraceError {
  readonly decisions: Decision[];

  constructor(message: string, decisions: Decision[]) {
    super("POLICY_VIOLATION", message);
    this.decisions = decisions;
  }
}

/** A policy document failed schema validation. `path` points at the offending key. */
export class PolicyValidationError extends TailraceError {
  readonly path: string;

  constructor(message: string, path: string) {
    super("POLICY_INVALID", message);
    this.path = path;
  }
}

/** An internal contract was breached, e.g. a restore requested at a non-egress boundary. */
export class InvariantViolationError extends TailraceError {
  constructor(message: string) {
    super("INVARIANT", message);
  }
}

/** A vault adapter failed (storage, encryption, or lookup). */
export class VaultError extends TailraceError {
  constructor(message: string) {
    super("VAULT", message);
  }
}

/** A recognizer threw while scanning. */
export class RecognizerError extends TailraceError {
  constructor(message: string) {
    super("RECOGNIZER", message);
  }
}

/** A surface that is specified but not yet implemented in this milestone. */
export class NotImplementedError extends TailraceError {
  constructor(message: string) {
    super("NOT_IMPLEMENTED", message);
  }
}
