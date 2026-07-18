/**
 * Lazy ONNX session load via onnxruntime-node. Failures surface as thrown errors;
 * the recognizer catches them once and disables itself (fail open).
 */

import { access } from "node:fs/promises";
import { dirname, join } from "node:path";

import { RecognizerError } from "@tailrace/core";

export const DEFAULT_ONNX_FILE = "model_q4.onnx";
export const DEFAULT_HUB_REPO = "openai/privacy-filter";

export interface ResolvedModelPaths {
  onnxPath: string;
  modelDir: string;
}

/**
 * Resolve `modelPath` (file or directory) to an ONNX file path.
 * Directory default: `model_q4.onnx`, then `model_quantized.onnx`, then `model.onnx`.
 */
export async function resolveModelPaths(
  modelPath: string,
  onnxFile?: string,
): Promise<ResolvedModelPaths> {
  const looksLikeOnnx = modelPath.endsWith(".onnx");
  if (looksLikeOnnx) {
    await access(modelPath);
    return { onnxPath: modelPath, modelDir: dirname(modelPath) };
  }

  const candidates = onnxFile
    ? [onnxFile]
    : [DEFAULT_ONNX_FILE, "model_quantized.onnx", "model_fp16.onnx", "model.onnx"];

  for (const name of candidates) {
    const onnxPath = join(modelPath, name);
    try {
      await access(onnxPath);
      return { onnxPath, modelDir: modelPath };
    } catch {
      // try next
    }
    // Official hub layout nests under onnx/
    const nested = join(modelPath, "onnx", name);
    try {
      await access(nested);
      return { onnxPath: nested, modelDir: modelPath };
    } catch {
      // try next
    }
  }

  throw new RecognizerError(
    `no ONNX model found under modelPath (tried ${candidates.join(", ")} and onnx/…)`,
  );
}

export type OrtSession = {
  run: (
    feeds: Record<string, unknown>,
  ) => Promise<Record<string, { data: Float32Array | Float64Array | number[]; dims: number[] }>>;
};

export type OrtTensorCtor = new (
  type: string,
  data: BigInt64Array | Int32Array | Float32Array,
  dims: number[],
) => unknown;

export interface OrtModule {
  InferenceSession: {
    create: (path: string) => Promise<OrtSession>;
  };
  Tensor: OrtTensorCtor;
}

export async function loadOrt(): Promise<OrtModule> {
  try {
    // why: optional peer; dynamic import keeps package importable without onnxruntime installed
    return (await import("onnxruntime-node")) as unknown as OrtModule;
  } catch {
    throw new RecognizerError(
      "onnxruntime-node is required for nerRecognizer(); install it as a dependency",
    );
  }
}

export async function createOnnxSession(onnxPath: string): Promise<{
  session: OrtSession;
  ort: OrtModule;
}> {
  const ort = await loadOrt();
  const session = await ort.InferenceSession.create(onnxPath);
  return { session, ort };
}

/** Run token-classification ONNX; returns flat logits [seq * numClasses] and dims. */
export async function runTokenClassifier(
  session: OrtSession,
  ort: OrtModule,
  inputIds: number[],
): Promise<{ logits: Float32Array; seqLen: number; numClasses: number }> {
  const seqLen = inputIds.length;
  const ids = BigInt64Array.from(inputIds, (n) => BigInt(n));
  const mask = BigInt64Array.from({ length: seqLen }, () => 1n);

  const feeds: Record<string, unknown> = {
    input_ids: new ort.Tensor("int64", ids, [1, seqLen]),
    attention_mask: new ort.Tensor("int64", mask, [1, seqLen]),
  };

  let results: Record<string, { data: Float32Array | Float64Array | number[]; dims: number[] }>;
  try {
    results = await session.run(feeds);
  } catch {
    // Some exports use int32 inputs
    const ids32 = Int32Array.from(inputIds);
    const mask32 = Int32Array.from({ length: seqLen }, () => 1);
    results = await session.run({
      input_ids: new ort.Tensor("int32", ids32, [1, seqLen]),
      attention_mask: new ort.Tensor("int32", mask32, [1, seqLen]),
    });
  }

  const logitsTensor = results.logits ?? results["output"] ?? results[Object.keys(results)[0]!]!;
  const dims = logitsTensor.dims;
  // Expected [1, seq, numClasses] or [seq, numClasses]
  let outSeq: number;
  let numClasses: number;
  if (dims.length === 3) {
    outSeq = dims[1]!;
    numClasses = dims[2]!;
  } else if (dims.length === 2) {
    outSeq = dims[0]!;
    numClasses = dims[1]!;
  } else {
    throw new RecognizerError(`unexpected logits dims: ${dims.join("x")}`);
  }

  const data = logitsTensor.data;
  const logits = data instanceof Float32Array ? data : Float32Array.from(data as ArrayLike<number>);

  return { logits, seqLen: outSeq, numClasses };
}
