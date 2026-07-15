/**
 * Static regex safety checks for custom pattern recognizers (docs/detection.md §7).
 * Best-effort ReDoS mitigation at registration time; not a proof of safety.
 */

import { RecognizerError } from "../errors";

/** Maximum pattern source length accepted at registration. */
export const MAX_PATTERN_SOURCE_LENGTH = 512;

/** Maximum upper bound for `{n,m}` quantifiers on repeated constructs. */
export const MAX_QUANTIFIER_UPPER = 64;

const BACKREFERENCE_RE = /\\(?:[1-9]|k<[^>]+>|k'[^']+')/;

/**
 * Validate a pattern source string. Throws {@link RecognizerError} naming the pattern index
 * and rule violated; never includes the pattern source in the message.
 */
export function validatePatternSource(source: string, patternIndex: number): void {
  const prefix = `pattern ${patternIndex}`;

  if (source.length > MAX_PATTERN_SOURCE_LENGTH) {
    throw new RecognizerError(`${prefix}: source exceeds max length ${MAX_PATTERN_SOURCE_LENGTH}`);
  }

  if (BACKREFERENCE_RE.test(source)) {
    throw new RecognizerError(`${prefix}: backreferences are not allowed`);
  }

  if (hasNestedQuantifiers(source)) {
    throw new RecognizerError(`${prefix}: nested quantifiers on groups are not allowed`);
  }

  if (hasUnboundedQuantifierUpper(source)) {
    throw new RecognizerError(
      `${prefix}: quantifier upper bound exceeds ${MAX_QUANTIFIER_UPPER} or is unbounded on a repeated group`,
    );
  }

  if (hasQuantifiedLookbehind(source)) {
    throw new RecognizerError(`${prefix}: lookbehind with quantified content is not allowed`);
  }
}

function hasNestedQuantifiers(source: string): boolean {
  /** Per open group: whether a quantifier appears inside (outside char classes). */
  const groupHadQuantifier: boolean[] = [];
  let inClass = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (c === "\\") {
      escaped = true;
      continue;
    }

    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }

    if (c === "[") {
      inClass = true;
      continue;
    }

    if (c === "(") {
      const next = source[i + 1];
      if (next === "?") {
        const third = source[i + 2];
        // Non-capturing / lookahead / lookbehind / atomic - do not push a quantifier-tracking group.
        if (third === ":" || third === "=" || third === "!" || third === "<" || third === ">") {
          i += 2;
          continue;
        }
      }
      groupHadQuantifier.push(false);
      continue;
    }

    if (c === ")") {
      const inner = groupHadQuantifier.pop();
      const after = source[i + 1];
      if (inner === true && after !== undefined && isQuantifierStart(after, source, i + 1)) {
        return true;
      }
      if (inner === true && groupHadQuantifier.length > 0) {
        groupHadQuantifier[groupHadQuantifier.length - 1] = true;
      }
      continue;
    }

    if (groupHadQuantifier.length > 0 && isQuantifierStart(c, source, i)) {
      groupHadQuantifier[groupHadQuantifier.length - 1] = true;
      if (c === "{") {
        i = skipBraceQuantifier(source, i);
      }
    }
  }

  return false;
}

function hasUnboundedQuantifierUpper(source: string): boolean {
  let inClass = false;
  let escaped = false;
  let groupDepth = 0;
  let groupHasQuantifier = false;

  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (c === "\\") {
      escaped = true;
      continue;
    }

    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }

    if (c === "[") {
      inClass = true;
      continue;
    }

    if (c === "(") {
      const next = source[i + 1];
      if (
        next === "?" &&
        (source[i + 2] === ":" || source[i + 2] === "=" || source[i + 2] === "!")
      ) {
        i += 2;
        continue;
      }
      groupDepth++;
      groupHasQuantifier = false;
      continue;
    }

    if (c === ")") {
      if (groupDepth > 0) groupDepth--;
      const after = source[i + 1];
      if (
        groupHasQuantifier &&
        after !== undefined &&
        (after === "*" || after === "+" || isBraceQuantifierUnbounded(source, i + 1))
      ) {
        return true;
      }
      continue;
    }

    if (isQuantifierStart(c, source, i)) {
      if (groupDepth > 0) groupHasQuantifier = true;
      if (c === "{") {
        const brace = readBraceBounds(source, i);
        if (brace.unbounded || (brace.upper !== null && brace.upper > MAX_QUANTIFIER_UPPER)) {
          return true;
        }
        i = skipBraceQuantifier(source, i);
      }
    }
  }

  return false;
}

function readBraceBounds(
  source: string,
  index: number,
): { upper: number | null; unbounded: boolean } {
  const m = source.slice(index).match(/^\{(\d*)(?:,(\d*))?\}/);
  if (!m) return { upper: null, unbounded: false };
  const upperRaw = m[2];
  if (upperRaw === undefined) {
    // Exact {n}
    return { upper: null, unbounded: false };
  }
  if (upperRaw === "") {
    // {n,} unbounded upper
    return { upper: null, unbounded: true };
  }
  return { upper: Number.parseInt(upperRaw, 10), unbounded: false };
}

function hasQuantifiedLookbehind(source: string): boolean {
  let i = 0;
  while (i < source.length) {
    if (
      source[i] === "(" &&
      source[i + 1] === "?" &&
      (source[i + 2] === "<" || source[i + 2] === "!")
    ) {
      const close = findGroupClose(source, i);
      if (close < 0) return false;
      const inner = source.slice(
        i + (source[i + 2] === "<" && source[i + 3] === "=" ? 4 : 3),
        close,
      );
      if (/[*+]|{[0-9]*,\s*}|{[0-9]+,}/.test(inner)) {
        return true;
      }
      i = close + 1;
      continue;
    }
    i++;
  }
  return false;
}

function isQuantifierStart(c: string, source: string, index: number): boolean {
  if (c === "*" || c === "+" || c === "?") return true;
  if (c === "{") return isBraceQuantifier(source, index);
  return false;
}

function isBraceQuantifier(source: string, index: number): boolean {
  const slice = source.slice(index);
  return /^\{\d*(?:,\d*)?\}/.test(slice);
}

function isBraceQuantifierUnbounded(source: string, index: number): boolean {
  const slice = source.slice(index);
  return /^\{\d*,\s*\}/.test(slice);
}

function skipBraceQuantifier(source: string, index: number): number {
  const m = source.slice(index).match(/^\{\d*(?:,\d*)?\}/);
  return m ? index + m[0].length - 1 : index;
}

function findGroupClose(source: string, openIndex: number): number {
  let depth = 0;
  let inClass = false;
  let escaped = false;

  for (let i = openIndex; i < source.length; i++) {
    const c = source[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
