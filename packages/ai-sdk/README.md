# @tailrace/ai-sdk

Tailrace middleware for the [Vercel AI SDK](https://sdk.vercel.ai). Wrap a model so sensitive values
in prompts and completions pass through policy, and wrap tools so their arguments and results do too.

> **M0 skeleton.** `wrapModel` / `wrapTools` throw `NotImplementedError` until milestone M3
> (see [`docs/milestones.md`](../../docs/milestones.md)).

```ts
import { createTailrace } from "@tailrace/core";
import { wrapModel, wrapTools } from "@tailrace/ai-sdk";
import { openai } from "@ai-sdk/openai";

const tailrace = createTailrace();
const model = wrapModel(tailrace, openai("gpt-4o"));
```

`ai` is a peer dependency.
