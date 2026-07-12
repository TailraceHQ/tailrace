# Policy Engine Spec

The policy engine answers one question: **given a detected entity span, a boundary, and an identity, what action applies?** Everything else in the product feeds this function or consumes its output.

## 1. Core types

```ts
type Action = "allow" | "mask" | "tokenize" | "block" | "review" | "detokenize";
// review: typed, throws NotImplementedError in v0.1
// detokenize: egress-only; rejected by definePolicy outside egress boundary keys

type EntityClass =
  // secrets (Tier 0, deterministic)
  | "api_key" | "jwt" | "private_key" | "high_entropy_secret" | "connection_string"
  // structured PII (Tier 0)
  | "email" | "phone" | "credit_card" | "iban" | "ssn" | "ip_address" | "url_credentials"
  // free-text PII (Tier 1, NER)
  | "person" | "location" | "organization"
  // user-defined
  | (string & {});

type Boundary =
  | { kind: "model"; provider: string }          // e.g. "openai/gpt-5", matched with glob
  | { kind: "tool"; name: string; direction: "in" | "out" }
  | { kind: "mcp"; server: string; tool: string; direction: "in" | "out" }
  | { kind: "telemetry" }
  | { kind: "egress"; sink: string };            // trusted detokenization points

interface Identity {
  agent: string;                                  // required, "default" if unset
  claims?: Record<string, string | string[]>;     // OIDC-shaped, reserved for adapters
}

interface Decision {
  action: Action;
  entity: EntityClass;
  boundary: Boundary;
  identity: Identity;
  rule: string;          // dotted path of the winning rule, e.g. "identities.support-agent.tools.crm.*"
  span: { path: string; start: number; end: number }; // JSON path + offsets; NEVER the value
  contentHash: string;   // SHA-256 of the raw value, hex — for audit correlation only
}
```

## 2. Policy document shape

Matches the `definePolicy` example in the product spec: top-level `defaults`, `entities` (entity → engine + default action), `boundaries` (per-boundary overrides, with glob keys like `"mcp:salesforce/*"` and `"openai/*"`), and `identities` (per-agent override trees that nest the same `entities`/`boundaries` shape). `definePolicy` validates the document at build time via types and at runtime via a schema check that throws `PolicyValidationError` with a path to the offending key.

### Zero-config default (`createTailrace()` with no args)

Explicit per-entity choices, not a blanket "all PII tokenize":

| Entity class | Default action | Rationale |
|---|---|---|
| All `SecretEntityClass` | `block` | Prime directive |
| `email`, `phone`, `credit_card`, `iban`, `ssn` | `tokenize` | Common structured PII |
| `ip_address` | `allow` | IPs appear in legitimate flows; blanket tokenization is aggressive |
| `url_credentials` | `block` | Credential-in-URL shape is secret-class in practice |
| NER (`person`, `location`, `organization`) | unset → `defaults.action` (`allow`) | Tier 1 optional; no default enforcement |
| `boundaries["egress:*"].entities["*"]` | `detokenize` | Trusted egress restore |

## 3. Resolution algorithm (normative)

For a span with entity `E`, boundary `B`, identity `I`:

1. Collect candidate rules, most specific first:
   a. `identities[I.agent].boundaries[B-match].entities[E]`
   b. `identities[I.agent].entities[E]`
   c. `boundaries[B-match].entities[E]` (a boundary key may also map `"*"` and pseudo-classes like `"block-pii"`)
   d. `entities[E].action`
   e. `defaults.action`
2. B-match: exact key beats glob; longer glob beats shorter; `direction` must match when present. Matching runs **within the boundary kind's keyspace** only: model patterns are bare provider globs (`openai/*`), while tool (`tool:{name}:{direction}`), mcp (`mcp:{server}/{tool}`), egress (`egress:{sink}`), and telemetry (`telemetry`) use prefixed encodings. A model glob cannot match a prefixed tool/mcp key.
3. First candidate found wins **except**: `block` at ANY level for secret-class entities (`api_key`, `jwt`, `private_key`, `high_entropy_secret`, `connection_string`) cannot be overridden to `allow` by a more specific rule unless the rule sets `dangerouslyAllowSecrets: true`. This is deliberate friction; document it loudly.
4. If multiple spans overlap after merging (see detection.md §4), the most restrictive action wins: `block > review > tokenize > mask > allow`.
5. `egress` boundaries invert semantics: the resolved action for a tokenized value at a trusted egress with `"detokenize"` is vault lookup + restore. Detokenize NEVER happens at `model`, `tool(out)`, `mcp(out)`, or `telemetry` boundaries regardless of policy — hard invariant, tested.

Resolution must be pure and synchronous: `resolve(policy, entity, boundary, identity) → ResolvedRule`. Precompile the policy document into lookup structures at `createTailrace()` time; per-span resolution target is < 1µs (it's map lookups, not regex over keys).

## 4. Actions semantics

- **allow** — pass through untouched. Still emits an audit decision.
- **mask** — irreversible: replace value with `[EMAIL]`-style label (configurable per entity). No vault write.
- **tokenize** — reversible: replace with vault token (see vault.md). Format-preserving variants per vault.md §3.
- **block** — throw `PolicyViolationError` with `{ decisions }` attached. Integrations translate this per surface (integrations.md). The error message names entity class and rule path, never the value.
- **review** — v0.1: throw `NotImplementedError("review action ships in v0.2")` at policy compile time, not at request time, so misconfiguration surfaces immediately.

## 5. The `check` primitive

All integrations call one core method:

```ts
tailrace.check(input: string | JsonObject, ctx: { boundary: Boundary; identity: Identity; workflowId?: string })
  : Promise<{ output: typeof input; decisions: Decision[]; blocked: false } >
  // or throws PolicyViolationError (blocked)
```

Plus `tailrace.restore(input, ctx)` for egress boundaries. Integrations contain NO policy logic — they only construct the right `Boundary`/`Identity` and translate errors.
