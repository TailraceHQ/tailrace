/**
 * Public type surface for @tailrace/core.
 *
 * These types are the contract every integration builds against. They are specified
 * by docs/policy-engine.md, docs/detection.md, and docs/vault.md - those docs are
 * normative when a detail here is ambiguous.
 */

/** What the policy engine decides to do with a detected span. */
export type Action = "allow" | "mask" | "tokenize" | "block" | "review" | "detokenize";

/** Deterministic, Tier 0 secret classes. `block` on these cannot be relaxed to `allow`
 * without `dangerouslyAllowSecrets` (docs/policy-engine.md §3.3). */
export type SecretEntityClass =
  "api_key" | "jwt" | "private_key" | "high_entropy_secret" | "connection_string";

/** Structured PII, detected deterministically in Tier 0. */
export type PiiEntityClass =
  "email" | "phone" | "credit_card" | "iban" | "ssn" | "ip_address" | "url_credentials";

/** Free-text PII, detected by the optional Tier 1 NER recognizer. */
export type NerEntityClass = "person" | "location" | "organization";

/**
 * Any entity class. The `string & {}` member keeps literal autocomplete for the known
 * classes while still admitting user-defined classes from custom recognizers.
 */
export type EntityClass =
  | SecretEntityClass
  | PiiEntityClass
  | NerEntityClass
  // `string & {}` preserves literal autocomplete for the known classes while still admitting
  // user-defined classes from custom recognizers.
  | (string & {});

/** The set of secret classes, as a runtime value, for the secrets-cannot-be-allowed rule. */
export const SECRET_ENTITY_CLASSES: readonly SecretEntityClass[] = [
  "api_key",
  "jwt",
  "private_key",
  "high_entropy_secret",
  "connection_string",
];

/** Structured PII classes (Tier 0). */
export const PII_ENTITY_CLASSES: readonly PiiEntityClass[] = [
  "email",
  "phone",
  "credit_card",
  "iban",
  "ssn",
  "ip_address",
  "url_credentials",
];

/** Free-text PII classes (Tier 1 NER). */
export const NER_ENTITY_CLASSES: readonly NerEntityClass[] = ["person", "location", "organization"];

/** A trust boundary a value is about to cross. */
export type Boundary =
  | { kind: "model"; provider: string }
  | { kind: "tool"; name: string; direction: "in" | "out" }
  | { kind: "mcp"; server: string; tool: string; direction: "in" | "out" }
  | { kind: "telemetry" }
  | { kind: "egress"; sink: string };

/** Who is acting. `agent` is required ("default" if unset). */
export interface Identity {
  agent: string;
  claims?: Record<string, string | string[]>;
}

/** A detected region of the input. Offsets are UTF-16 code units. */
export interface Span {
  entity: EntityClass;
  /** Inclusive start offset (UTF-16 code units). */
  start: number;
  /** Exclusive end offset (UTF-16 code units). */
  end: number;
  /** 1.0 = validator-confirmed, 0.8 = pattern-only (docs/detection.md §1). */
  confidence: number;
  /** Id of the emitting recognizer. */
  recognizer: string;
  /** RFC 6901 JSON Pointer when the span came from an object leaf; absent for plain strings. */
  path?: string;
}

/** A detection engine. Tier 0 recognizers MUST be synchronous. */
export interface Recognizer {
  id: string;
  entities: EntityClass[];
  tier: 0 | 1 | 2;
  scan(text: string): Span[] | Promise<Span[]>;
}

/** One resolved policy outcome for one span. Never carries the raw value. */
export interface Decision {
  action: Action | "restore_miss";
  entity: EntityClass;
  boundary: Boundary;
  identity: Identity;
  /** Dotted path of the winning rule, e.g. `identities.support-agent.tools.crm.*`. */
  rule: string;
  /** JSON path + offsets, never the value. */
  span: { path: string; start: number; end: number };
  /** SHA-256 of the raw value, hex - for audit correlation only. */
  contentHash: string;
  /**
   * When {@link CheckOptions.applyBlockAs} remaps a `block` to another applied action,
   * the resolved policy action stays `block` and this records what was applied.
   */
  appliedAs?: "mask";
}

/**
 * Per-call options for {@link Tailrace.check}. Integration-only knobs; does not change
 * policy resolution (docs/policy-engine.md §5).
 */
export interface CheckOptions {
  /**
   * When policy resolves to `block`, apply this action instead of throwing.
   * Default: throw. Used by `@tailrace/ai-sdk` for `streamBlockBehavior: "redact"`.
   */
  applyBlockAs?: "mask";
}

/** A per-entity rule; either a bare action or an action with modifiers. */
export interface EntityRule {
  action: Action;
  /** Tokenization output shape (docs/vault.md §3). */
  format?: "preserve" | "label";
  /** Required to relax a secret class away from `block` (docs/policy-engine.md §3.3). */
  dangerouslyAllowSecrets?: boolean;
}

export type EntityRuleValue = Action | EntityRule;

/** A scope that maps entities and per-boundary overrides; reused at top level and per identity. */
export interface PolicyScope {
  entities?: Partial<Record<EntityClass, EntityRuleValue>>;
  boundaries?: Record<string, { entities?: Partial<Record<string, EntityRuleValue>> }>;
}

/** A full policy document (docs/policy-engine.md §2). */
export interface PolicyDocument extends PolicyScope {
  defaults?: { action?: Action };
  identities?: Record<string, PolicyScope>;
  /** Global escape hatch for the secrets-cannot-be-allowed rule. */
  dangerouslyAllowSecrets?: boolean;
}

/**
 * Where a policy comes from. v0.1 ships `staticPolicy`; a hosted plane can slot in later
 * without a core API change (docs/architecture.md §5).
 */
export interface PolicySource {
  load(): Promise<PolicyDocument>;
  subscribe?(cb: (p: PolicyDocument) => void): () => void;
}

/** A single stored token record. */
export interface VaultRecord {
  value: string;
  entity: EntityClass;
}

export interface VaultPutInput {
  workflowId: string;
  token: string;
  entity: EntityClass;
  value: string;
  expiresAt?: number;
}

/** Reversible token storage (docs/vault.md §2). Values are stored encrypted at rest. */
export interface Vault {
  put(input: VaultPutInput): Promise<void>;
  get(workflowId: string, token: string): Promise<VaultRecord | null>;
  purge(workflowId: string): Promise<void>;
}

/** Minimal KV surface backing `kvVault`; structurally compatible with Cloudflare KV. */
export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** One audit record emitted per check/restore. */
export interface AuditEvent {
  type: "check" | "restore";
  workflowId: string;
  timestamp: number;
  decisions: Decision[];
}

/** A destination for audit events (console, JSONL, otel, custom). */
export interface AuditSink {
  emit(event: AuditEvent): void | Promise<void>;
}

/**
 * Line writer for {@link jsonlSink}. Callers supply filesystem or remote adapters;
 * core never touches the filesystem.
 */
export interface AuditWriter {
  write(line: string): void | Promise<void>;
}

/** Master-key and TTL options for the built-in vaults. */
export interface VaultOptions {
  /** Master key; falls back to `TAILRACE_VAULT_KEY`, then a random per-process key. */
  key?: string;
  /** Default token TTL in seconds (docs/vault.md §2). */
  ttlSeconds?: number;
}

/** Options for {@link createTailrace}. Every field has a sensible default. */
export interface TailraceOptions {
  policy?: PolicyDocument | PolicySource;
  recognizers?: Recognizer[];
  vault?: Vault | VaultOptions;
  audit?: { sinks?: AuditSink[] };
  /** Emit spans for private/reserved IP ranges (docs/detection.md §2). */
  includePrivateIps?: boolean;
  /** Notified with every decision, regardless of configured audit sinks. */
  onDecision?: (decisions: Decision[]) => void;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
export type JsonObject = { [k: string]: JsonValue };

export interface CheckContext {
  boundary: Boundary;
  identity: Identity;
  workflowId?: string;
}

export interface CheckResult<T> {
  output: T;
  decisions: Decision[];
  blocked: false;
}

/**
 * The core primitive every integration calls. Integrations construct the right
 * `Boundary`/`Identity` and translate errors; they contain no policy logic.
 */
export interface Tailrace {
  /**
   * Detect + resolve + apply. Throws {@link PolicyViolationError} on a `block`
   * unless {@link CheckOptions.applyBlockAs} remaps the block.
   */
  check<T extends string | JsonObject>(
    input: T,
    ctx: CheckContext,
    options?: CheckOptions,
  ): Promise<CheckResult<T>>;
  /** Restore tokens at a trusted `egress` boundary. Throws at any other boundary. */
  restore<T extends string | JsonObject>(input: T, ctx: CheckContext): Promise<CheckResult<T>>;
}
