/**
 * `nerRecognizer()` - Tier 1 Privacy Filter ONNX recognizer.
 */

import { RecognizerError } from "@tailrace/core";
import type { Recognizer, Span } from "@tailrace/core";

import { decodePrivacyFilterLogits } from "./decode";
import { NER_RECOGNIZER_ENTITIES, NER_RECOGNIZER_ID, PRIVACY_FILTER_ID2LABEL } from "./labels";
import {
  createOnnxSession,
  resolveModelPaths,
  runTokenClassifier,
  type OrtModule,
  type OrtSession,
} from "./session";
import { tokenizeO200k, type TokenizedText, type TokenizerFn } from "./tokenize";

export interface NerRecognizerOptions {
  /**
   * Local path to an ONNX file or a directory containing official hub exports
   * (`model_q4.onnx` preferred). Required for real inference unless `inferLogits` is set.
   */
  modelPath?: string;
  /** ONNX filename inside `modelPath` when it is a directory. Default: try q4 → quantized → … */
  onnxFile?: string;
  /** HF-hub revision to pin when download support lands. Reserved for API stability. */
  revision?: string;
  /** Local cache directory for downloaded models. Reserved for API stability. */
  cacheDir?: string;
  /** Override tokenizer (tests / custom encodings). */
  tokenize?: TokenizerFn;
  /**
   * Inject logits for tests or alternate runtimes. When set, ONNX is not loaded.
   * Return flat [seqLen * numClasses] logits for the tokenized input.
   */
  inferLogits?: (
    tokens: TokenizedText,
    text: string,
  ) => Promise<ArrayLike<number>> | ArrayLike<number>;
}

function warnOnce(state: { warned: boolean }, message: string): void {
  if (state.warned) return;
  state.warned = true;
  // why: package tsconfig has no DOM lib; console exists on Node
  const c = (globalThis as { console?: { warn: (...args: unknown[]) => void } }).console;
  c?.warn(message);
}

/**
 * Build the Tier 1 NER recognizer to pass into `createTailrace({ recognizers: [...] })`.
 *
 * Lazy-loads the ONNX session on first `scan`. If the model is missing or inference throws,
 * logs one warning and returns no spans thereafter (fail open to Tier 0).
 *
 * @example
 * ```ts
 * const gate = createTailrace({
 *   recognizers: [nerRecognizer({ modelPath: "./models/privacy-filter" })],
 * });
 * ```
 */
export function nerRecognizer(opts: NerRecognizerOptions = {}): Recognizer {
  const tokenize = opts.tokenize ?? tokenizeO200k;
  const disabled = { warned: false, value: false };
  let session: OrtSession | null = null;
  let ort: OrtModule | null = null;
  let loadPromise: Promise<void> | null = null;

  const ensureSession = async (): Promise<void> => {
    if (session !== null || opts.inferLogits !== undefined) return;
    if (opts.modelPath === undefined) {
      throw new RecognizerError(
        "nerRecognizer requires modelPath (local ONNX file or directory); hub auto-download is not enabled yet",
      );
    }
    if (loadPromise === null) {
      loadPromise = (async () => {
        const paths = await resolveModelPaths(opts.modelPath!, opts.onnxFile);
        const loaded = await createOnnxSession(paths.onnxPath);
        session = loaded.session;
        ort = loaded.ort;
      })();
    }
    await loadPromise;
  };

  const scan = async (text: string): Promise<Span[]> => {
    if (disabled.value) return [];
    try {
      if (opts.inferLogits === undefined && opts.modelPath === undefined) {
        throw new RecognizerError(
          "nerRecognizer requires modelPath (local ONNX file or directory); hub auto-download is not enabled yet",
        );
      }

      const tokens = await tokenize(text);
      if (tokens.inputIds.length === 0) return [];

      let logits: ArrayLike<number>;
      let seqLen = tokens.inputIds.length;
      let numClasses = PRIVACY_FILTER_ID2LABEL.length;

      if (opts.inferLogits !== undefined) {
        logits = await opts.inferLogits(tokens, text);
      } else {
        await ensureSession();
        if (session === null || ort === null) {
          throw new RecognizerError("ONNX session failed to initialize");
        }
        const ran = await runTokenClassifier(session, ort, tokens.inputIds);
        logits = ran.logits;
        seqLen = ran.seqLen;
        numClasses = ran.numClasses;
      }

      return decodePrivacyFilterLogits({
        logits,
        seqLen,
        numClasses,
        text,
        tokens,
      });
    } catch (err) {
      disabled.value = true;
      const reason = err instanceof Error ? err.message : "unknown error";
      warnOnce(
        disabled,
        `[tailrace] recognizer "${NER_RECOGNIZER_ID}" disabled (fail open): ${reason}`,
      );
      return [];
    }
  };

  return {
    id: NER_RECOGNIZER_ID,
    entities: [...NER_RECOGNIZER_ENTITIES],
    tier: 1,
    scan,
  };
}
