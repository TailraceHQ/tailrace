/**
 * Tier 0 secret recognizers (docs/detection.md §2, "Secrets"). All synchronous.
 * Confidence is 1.0 for a distinctive prefix or a passed validator, 0.8 for a weaker signal.
 */

import type { Recognizer, Span } from "../../types";
import { decodeBase64UrlJson, hasBase62Charset, isJwtHeader, shannonEntropy } from "../primitives";
import { scanPatterns, type Pattern } from "./shared";

/** Known API-key shapes, keyed by provider prefix. */
const API_KEY_PATTERNS: readonly Pattern[] = [
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/g, confidence: 1 }, // Anthropic
  { re: /sk-[A-Za-z0-9]{20,}/g, confidence: 1 }, // OpenAI (legacy)
  { re: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g, confidence: 1 }, // Stripe secret
  { re: /pk_(?:live|test)_[0-9A-Za-z]{16,}/g, confidence: 0.8 }, // Stripe publishable (low-confidence)
  { re: /gh[opsur]_[A-Za-z0-9]{36,}/g, confidence: 1 }, // GitHub token
  { re: /github_pat_[A-Za-z0-9_]{22,}/g, confidence: 1 }, // GitHub fine-grained PAT
  { re: /AKIA[0-9A-Z]{16}/g, confidence: 1 }, // AWS access key id
  { re: /xox[bpars]-[A-Za-z0-9-]{10,}/g, confidence: 1 }, // Slack
  { re: /AIza[0-9A-Za-z_-]{35}/g, confidence: 1 }, // Google
  { re: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g, confidence: 1 }, // SendGrid
  { re: /key-[0-9a-zA-Z]{32}/g, confidence: 0.8 }, // Mailgun
  { re: /glpat-[A-Za-z0-9_-]{20}/g, confidence: 1 }, // GitLab
  { re: /npm_[A-Za-z0-9]{36}/g, confidence: 1 }, // npm
  { re: /dop_v1_[0-9a-f]{64}/g, confidence: 1 }, // DigitalOcean
];

export const apiKeyRecognizer: Recognizer = {
  id: "api_key",
  entities: ["api_key"],
  tier: 0,
  scan: (text) => scanPatterns(text, API_KEY_PATTERNS, "api_key", "api_key"),
};

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export const jwtRecognizer: Recognizer = {
  id: "jwt",
  entities: ["jwt"],
  tier: 0,
  scan: (text) => {
    const spans: Span[] = [];
    JWT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = JWT_RE.exec(text)) !== null) {
      const header = decodeBase64UrlJson(m[0].slice(0, m[0].indexOf(".")));
      if (header !== null && isJwtHeader(header)) {
        spans.push({
          entity: "jwt",
          start: m.index,
          end: m.index + m[0].length,
          confidence: 1,
          recognizer: "jwt",
        });
      }
    }
    return spans;
  },
};

const PEM_PATTERNS: readonly Pattern[] = [
  {
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----(?:[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----)?/g,
    confidence: 1,
  },
];

export const privateKeyRecognizer: Recognizer = {
  id: "private_key",
  entities: ["private_key"],
  tier: 0,
  scan: (text) => scanPatterns(text, PEM_PATTERNS, "private_key", "private_key"),
};

// Note: `=` is intentionally excluded so an assignment like `API_SECRET=<token>` splits into
// the key and the value rather than matching as one run that starts before the keyword. Base64
// `=` only ever appears as trailing padding, so excluding it just trims padding from the span.
const TOKEN_RE = /[A-Za-z0-9+/_-]{20,64}/g;
const KEYWORD_RE =
  /(?:secret|token|password|passwd|pwd|api[_-]?key|apikey|auth|credential|bearer)/gi;
const ASSIGN_QUOTED_RE = /[=:]\s*["'`]([A-Za-z0-9+/=_-]{20,64})["'`]/g;
const ENTROPY_THRESHOLD = 4.0;
/** A candidate must sit within this many chars after a keyword to pass the context gate. */
const KEYWORD_WINDOW = 40;

export const highEntropySecretRecognizer: Recognizer = {
  id: "high_entropy_secret",
  entities: ["high_entropy_secret"],
  tier: 0,
  scan: (text) => {
    const spans: Span[] = [];

    // Context gate part 1: end offsets of nearby keywords.
    const keywordEnds: number[] = [];
    KEYWORD_RE.lastIndex = 0;
    let k: RegExpExecArray | null;
    while ((k = KEYWORD_RE.exec(text)) !== null) keywordEnds.push(k.index + k[0].length);

    // Context gate part 2: start offsets of tokens inside a quoted assignment.
    const quotedStarts = new Set<number>();
    ASSIGN_QUOTED_RE.lastIndex = 0;
    let q: RegExpExecArray | null;
    while ((q = ASSIGN_QUOTED_RE.exec(text)) !== null) {
      quotedStarts.add(q.index + q[0].indexOf(q[1]!));
    }

    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      const tok = m[0];
      if (!hasBase62Charset(tok)) continue;
      if (shannonEntropy(tok) <= ENTROPY_THRESHOLD) continue;
      const start = m.index;
      const nearKeyword = keywordEnds.some((end) => start >= end && start - end <= KEYWORD_WINDOW);
      if (!nearKeyword && !quotedStarts.has(start)) continue;
      spans.push({
        entity: "high_entropy_secret",
        start,
        end: start + tok.length,
        confidence: 0.8,
        recognizer: "high_entropy_secret",
      });
    }
    return spans;
  },
};

const CONNECTION_STRING_PATTERNS: readonly Pattern[] = [
  {
    // URI schemes with user:pass@ userinfo.
    re: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqp):\/\/[^\s:@/]+:[^\s@/]+@[^\s"'<>]+/gi,
    confidence: 1,
  },
  {
    // ADO-style "Server=...;Password=...;".
    re: /(?:Server|Data Source)=[^;]+;(?:[^;]*;)*?\s*Password=[^;\s"']+/gi,
    confidence: 1,
  },
];

export const connectionStringRecognizer: Recognizer = {
  id: "connection_string",
  entities: ["connection_string"],
  tier: 0,
  scan: (text) =>
    scanPatterns(text, CONNECTION_STRING_PATTERNS, "connection_string", "connection_string"),
};

/** All Tier 0 secret recognizers. */
export const SECRET_RECOGNIZERS: readonly Recognizer[] = [
  apiKeyRecognizer,
  jwtRecognizer,
  privateKeyRecognizer,
  highEntropySecretRecognizer,
  connectionStringRecognizer,
];
