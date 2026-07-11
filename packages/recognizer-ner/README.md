# @tailrace/recognizer-ner

Optional **Tier 1** recognizer for Tailrace: a quantized GLiNER-class ONNX model emitting `person`,
`location`, and `organization` spans. Node only. Install it explicitly and pass it into
`createTailrace({ recognizers: [nerRecognizer()] })`; `@tailrace/core` never depends on it.

If the model is unavailable at runtime, the recognizer logs one warning and disables itself -
detection degrades to Tier 0, the host app never crashes.

> **M0 skeleton.** `nerRecognizer` throws `NotImplementedError` until Tier 1 lands
> (see [`docs/detection.md`](../../docs/detection.md)).

`onnxruntime-node` is an optional peer dependency.
