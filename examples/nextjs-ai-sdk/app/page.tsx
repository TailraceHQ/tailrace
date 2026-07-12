"use client";

import { useState } from "react";

const FAKE_KEY = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const SAMPLE_EMAIL = "customer@example.com";

type ChatResponse =
  | { text: string; workflowId: string; modelSaw: string }
  | { error: { type: string; entity: string; rule: string; message: string } };

export default function Page() {
  const [prompt, setPrompt] = useState(`Please email ${SAMPLE_EMAIL} about the invoice.`);
  const [result, setResult] = useState<string>("");
  const [meta, setMeta] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function send(nextPrompt: string) {
    setBusy(true);
    setResult("");
    setMeta("");
    try {
      const workflowId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `wf-${Date.now()}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workflow-id": workflowId,
        },
        body: JSON.stringify({ prompt: nextPrompt }),
      });
      const data = (await res.json()) as ChatResponse;
      if ("error" in data) {
        setResult(`Blocked (${res.status}): ${data.error.entity} - ${data.error.message}`);
        setMeta(`rule: ${data.error.rule}`);
      } else {
        setResult(data.text);
        setMeta(`workflowId=${data.workflowId}\nmodel saw (tokenized): ${data.modelSaw}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem" }}>Tailrace Demo 1</h1>
      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Run A blocks a fake Stripe key before it reaches the (mock) provider. Run B tokenizes an
        email outbound, then restores it at egress so the UI shows the real address.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const p = `Use key ${FAKE_KEY} and email ${SAMPLE_EMAIL}`;
            setPrompt(p);
            void send(p);
          }}
        >
          Run A - block secret
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const p = `Please email ${SAMPLE_EMAIL} about the invoice.`;
            setPrompt(p);
            void send(p);
          }}
        >
          Run B - tokenize + restore
        </button>
      </div>

      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Prompt
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <button type="button" disabled={busy} onClick={() => void send(prompt)}>
        {busy ? "Sending…" : "Send"}
      </button>

      {result ? (
        <pre
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            background: "#f6f6f6",
            whiteSpace: "pre-wrap",
          }}
        >
          {result}
        </pre>
      ) : null}
      {meta ? (
        <pre style={{ marginTop: "0.5rem", color: "#666", whiteSpace: "pre-wrap", fontSize: 12 }}>
          {meta}
        </pre>
      ) : null}
    </main>
  );
}
