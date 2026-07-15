/**
 * `definePatternRecognizer` - validated, bounded regex scanning for custom entities.
 */

import { getConsole } from "../console";
import { RecognizerError } from "../errors";
import {
  NER_ENTITY_CLASSES,
  PII_ENTITY_CLASSES,
  SECRET_ENTITY_CLASSES,
  type EntityClass,
  type Recognizer,
} from "../types";
import { validatePatternSource } from "./regex-safety";
import { scanPatterns, type Pattern, type ScanPatternsLimits } from "./recognizers/shared";

/** A regex pattern source with optional confidence (defaults to 0.8). */
export interface PatternDefinition {
  source: string;
  confidence?: number;
}

export interface PatternRecognizerOptions {
  id: string;
  entity: EntityClass;
  tier: 0;
  patterns: readonly PatternDefinition[];
}

const ENTITY_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;

const RESERVED_ENTITIES = new Set<string>([
  ...SECRET_ENTITY_CLASSES,
  ...PII_ENTITY_CLASSES,
  ...NER_ENTITY_CLASSES,
]);

const DEFAULT_PATTERN_CONFIDENCE = 0.8;

const PATTERN_SCAN_LIMITS: ScanPatternsLimits = {
  maxMatchesPerPattern: 256,
  budgetMs: 2,
};

const budgetWarnedIds = new Set<string>();

function onPatternBudgetExceeded(recognizerId: string): void {
  if (budgetWarnedIds.has(recognizerId)) return;
  budgetWarnedIds.add(recognizerId);
  getConsole()?.warn(
    `[tailrace] pattern recognizer "${recognizerId}" exceeded scan budget (remaining matches skipped)`,
  );
}

function validateEntityName(entity: string): void {
  if (!ENTITY_NAME_RE.test(entity)) {
    throw new RecognizerError(`entity "${entity}" must match ^[a-z][a-z0-9_]{0,63}$`);
  }
  if (RESERVED_ENTITIES.has(entity)) {
    throw new RecognizerError(
      `entity "${entity}" is reserved for built-in recognizers; choose a custom name`,
    );
  }
}

function compilePatterns(patterns: readonly PatternDefinition[]): Pattern[] {
  if (patterns.length === 0) {
    throw new RecognizerError("patterns must contain at least one entry");
  }

  const compiled: Pattern[] = [];
  for (let i = 0; i < patterns.length; i++) {
    const def = patterns[i]!;
    validatePatternSource(def.source, i);
    try {
      compiled.push({
        re: new RegExp(def.source, "gu"),
        confidence: def.confidence ?? DEFAULT_PATTERN_CONFIDENCE,
      });
    } catch {
      throw new RecognizerError(`pattern ${i}: invalid regular expression`);
    }
  }

  return compiled;
}

/**
 * Define a Tier 0 pattern recognizer with static validation and bounded scanning.
 *
 * @example
 * ```ts
 * const employeeId = definePatternRecognizer({
 *   id: "employee-id",
 *   entity: "employee_id",
 *   tier: 0,
 *   patterns: [{ source: String.raw`\\bEMP-\\d{5}\\b`, confidence: 1 }],
 * });
 * ```
 */
export function definePatternRecognizer(opts: PatternRecognizerOptions): Recognizer {
  if (opts.tier !== 0) {
    throw new RecognizerError("definePatternRecognizer only supports tier 0");
  }

  const entity = String(opts.entity);
  validateEntityName(entity);

  const compiled = compilePatterns(opts.patterns);

  return {
    id: opts.id,
    entities: [entity],
    tier: 0,
    scan(text: string) {
      return scanPatterns(text, compiled, entity, opts.id, {
        ...PATTERN_SCAN_LIMITS,
        onBudgetExceeded: () => onPatternBudgetExceeded(opts.id),
      });
    },
  };
}
