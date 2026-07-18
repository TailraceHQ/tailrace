> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/recognizer-ner

Optional **Tier 1** recognizer (Node only): OpenAI [Privacy Filter](https://huggingface.co/openai/privacy-filter)
ONNX with BIOES + constrained Viterbi decoding. `@tailrace/core` never depends on this package.

**You must supply weights.** Tailrace does not bundle or auto-download the model (opt-in; large
footprint). Point `modelPath` at a local hub checkout or ONNX file (`model_q4.onnx` preferred).

## Install

```bash
pnpm add @tailrace/recognizer-ner onnxruntime-node
```

Download weights separately (Apache 2.0), e.g. from Hugging Face `openai/privacy-filter`, and keep
the `onnx/` artifacts on disk.

## Quickstart

```ts
import { createTailrace, definePolicy } from "@tailrace/core";
import { nerRecognizer, nerRecommendedPolicy } from "@tailrace/recognizer-ner";

const recommended = nerRecommendedPolicy(); // opt-in; does not auto-merge
const gate = createTailrace({
  recognizers: [nerRecognizer({ modelPath: "./models/privacy-filter" })],
  policy: definePolicy({ entities: { ...recommended.entities } }),
});
```

Without merging `nerRecommendedPolicy()`, Tier 1 `secret` still **blocks** (it is a
`SecretEntityClass` in core defaults). New classes (`account_number`, `private_address`,
`private_url`, `private_date`) and `person` **allow** until you set policy.

If the model file is missing or inference throws, the recognizer logs **one** warning and returns
no spans (fail open to Tier 0).

## Memory

Privacy Filter is ~1.5B parameters (sparse MoE; ~50M active). Quantized ONNX is on the order of
hundreds of MB to ~1.5GB depending on `model_q4` / `model_quantized` / full precision. Prefer
`model_q4.onnx` unless quality requires otherwise.

## Label map

| Model label       | Tailrace entity   | Default action                              |
| ----------------- | ----------------- | ------------------------------------------- |
| `secret`          | `secret`          | `block`                                     |
| `account_number`  | `account_number`  | `allow` (unset)                             |
| `private_person`  | `person`          | `allow` / tokenize via recommended fragment |
| `private_address` | `private_address` | `allow`                                     |
| `private_email`   | `email`           | `tokenize` (Tier 0 default)                 |
| `private_phone`   | `phone`           | `tokenize` (Tier 0 default)                 |
| `private_url`     | `private_url`     | `allow`                                     |
| `private_date`    | `private_date`    | `allow`                                     |

See [`docs/m8-plan.md`](../../docs/m8-plan.md) and [`OPEN_QUESTIONS.md`](../../OPEN_QUESTIONS.md).
