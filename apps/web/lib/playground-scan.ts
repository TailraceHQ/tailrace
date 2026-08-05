/**
 * Pure scan helpers for the docs playground custom-pattern flow (M6e).
 * Kept separate from the React component so the add → scan → token path is unit-testable.
 */

import {
  createTailrace,
  definePatternRecognizer,
  definePolicy,
  PolicyViolationError,
  RecognizerError,
  SECRET_ENTITY_CLASSES,
  type Action,
  type Decision,
  type EntityClass,
  type EntityRuleValue,
  type PolicyDocument,
  type Recognizer,
} from "@tailrace/core";

export const PLAYGROUND_TOGGLE_ENTITIES = [
  "api_key",
  "jwt",
  "private_key",
  "high_entropy_secret",
  "connection_string",
  "email",
  "phone",
  "credit_card",
  "iban",
  "ssn",
  "ip_address",
  "url_credentials",
] as const;

export type PlaygroundToggleEntity = (typeof PLAYGROUND_TOGGLE_ENTITIES)[number];

export type PlaygroundCustomPattern = {
  id: string;
  entity: string;
  source: string;
  confidence: string;
  action: Action;
};

const SECRET_SET = new Set<string>(SECRET_ENTITY_CLASSES);

const BOUNDARY = { kind: "model" as const, provider: "openai/gpt-4o" };
const IDENTITY = { agent: "default" };

export function buildPlaygroundPolicy(
  actions: Record<PlaygroundToggleEntity, Action>,
  customPatterns: PlaygroundCustomPattern[],
): PolicyDocument {
  const entities: Partial<Record<EntityClass, EntityRuleValue>> = {};
  for (const entity of PLAYGROUND_TOGGLE_ENTITIES) {
    const action = actions[entity];
    if (SECRET_SET.has(entity) && action === "allow") {
      entities[entity] = { action: "allow", dangerouslyAllowSecrets: true };
    } else {
      entities[entity] = action;
    }
  }
  for (const pattern of customPatterns) {
    entities[pattern.entity] = pattern.action;
  }
  return definePolicy({
    defaults: { action: "allow" },
    entities,
  });
}

export function compilePlaygroundRecognizers(patterns: PlaygroundCustomPattern[]): {
  recognizers: Recognizer[];
  errors: Record<string, string>;
} {
  const recognizers: Recognizer[] = [];
  const errors: Record<string, string> = {};
  for (const pattern of patterns) {
    try {
      const confidence = pattern.confidence.trim() === "" ? undefined : Number(pattern.confidence);
      recognizers.push(
        definePatternRecognizer({
          id: pattern.id,
          entity: pattern.entity,
          tier: 0,
          patterns: [
            {
              source: pattern.source,
              ...(confidence !== undefined && !Number.isNaN(confidence) ? { confidence } : {}),
            },
          ],
        }),
      );
    } catch (err) {
      const msg =
        err instanceof RecognizerError
          ? err.message.split(" → ")[0]!
          : err instanceof Error
            ? err.message
            : "invalid pattern";
      errors[pattern.id] = msg;
    }
  }
  return { recognizers, errors };
}

export type PlaygroundScanOk = { status: "ok"; output: string; decisions: Decision[] };
export type PlaygroundScanError = { status: "error"; message: string };
export type PlaygroundScanResult = PlaygroundScanOk | PlaygroundScanError;

/**
 * Runs the same check path the playground useEffect uses after a pattern is added.
 */
export async function runPlaygroundScan(options: {
  text: string;
  actions: Record<PlaygroundToggleEntity, Action>;
  customPatterns: PlaygroundCustomPattern[];
}): Promise<PlaygroundScanResult> {
  const { recognizers } = compilePlaygroundRecognizers(options.customPatterns);
  try {
    const policy = buildPlaygroundPolicy(options.actions, options.customPatterns);
    const tailrace = createTailrace({
      policy,
      ...(recognizers.length > 0 ? { recognizers } : {}),
    });
    const result = await tailrace.check(
      options.text,
      {
        boundary: BOUNDARY,
        identity: IDENTITY,
        workflowId: "playground",
      },
      { applyBlockAs: "mask" },
    );
    return {
      status: "ok",
      output: result.output,
      decisions: result.decisions,
    };
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      return {
        status: "ok",
        output: options.text,
        decisions: err.decisions,
      };
    }
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Scan failed",
    };
  }
}
