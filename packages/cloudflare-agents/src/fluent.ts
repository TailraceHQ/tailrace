/**
 * withCloudflareAgents — Compose @tailrace/ai-sdk wraps for chat agents.
 */

import { wrapModel, wrapTools } from "@tailrace/ai-sdk";
import type { AiSdkWrapOptions } from "@tailrace/ai-sdk";
import type { Tailrace } from "@tailrace/core";
import type { ToolSet } from "ai";

import {
  asCheckable,
  checkWithOpts,
  formatToolBlockError,
  unwrapCheckable,
} from "@tailrace/adapter";
import { PolicyViolationError } from "@tailrace/core";

import type {
  AddToolOutput,
  CloudflareAgentsApi,
  CloudflareChatWrapOptions,
  CloudflareChatWrapped,
  CloudflareTailraceOptions,
  OnToolCallHandler,
} from "./types";
import { resolveCfAgent, resolveCfWorkflowId } from "./create";

function mergeWrapOpts(
  defaults: { agent: string; workflowId: string },
  opts?: AiSdkWrapOptions,
): AiSdkWrapOptions {
  const out: AiSdkWrapOptions = {
    agent: opts?.agent ?? defaults.agent,
    workflowId: opts?.workflowId ?? defaults.workflowId,
  };
  if (opts?.streamBlockBehavior !== undefined) {
    out.streamBlockBehavior = opts.streamBlockBehavior;
  }
  if (opts?.onDecision !== undefined) {
    out.onDecision = opts.onDecision;
  }
  return out;
}

/**
 * Attach Compose helpers to a Tailrace instance (usually from {@link createCloudflareTailrace}).
 *
 * @example
 * ```ts
 * const api = withCloudflareAgents(tr, { agent: this.name, workflowId: this.name });
 * const { model, tools } = api.forChat({ model: base, tools: { crm } });
 * ```
 */
export function withCloudflareAgents(
  tailrace: Tailrace,
  identity: CloudflareTailraceOptions = {},
): CloudflareAgentsApi {
  const defaults = {
    agent: resolveCfAgent(identity),
    workflowId: resolveCfWorkflowId(identity),
  };

  return {
    tailrace,
    agent: defaults.agent,
    resolveWorkflowId: () =>
      typeof identity.workflowId === "function"
        ? identity.workflowId()
        : (identity.workflowId ?? defaults.workflowId),

    forChat(opts: CloudflareChatWrapOptions): CloudflareChatWrapped {
      const wrapOpts = mergeWrapOpts(defaults, opts);
      const model = wrapModel(tailrace, opts.model, wrapOpts);
      const tools = opts.tools !== undefined ? wrapTools(tailrace, opts.tools, wrapOpts) : {};
      return { model, tools };
    },

    wrapOnToolCall(handler: OnToolCallHandler, opts?: AiSdkWrapOptions): OnToolCallHandler {
      const wrapOpts = mergeWrapOpts(defaults, opts);
      return async ({ toolCall, addToolOutput }) => {
        const name = toolCall.toolName;
        const rawArgs = toolCall.args ?? toolCall.input ?? {};

        let checkedArgs: unknown = rawArgs;
        try {
          const { output } = await checkWithOpts(
            tailrace,
            asCheckable(rawArgs),
            { kind: "tool", name, direction: "out" },
            wrapOpts,
          );
          checkedArgs = unwrapCheckable(rawArgs, output);
        } catch (err) {
          if (err instanceof PolicyViolationError) {
            await addToolOutput({
              toolCallId: toolCall.toolCallId,
              output: formatToolBlockError(err),
            });
            return;
          }
          throw err;
        }

        const governedAddToolOutput: AddToolOutput = async ({ toolCallId, output }) => {
          try {
            const { output: checked } = await checkWithOpts(
              tailrace,
              asCheckable(output),
              { kind: "tool", name, direction: "in" },
              wrapOpts,
            );
            await addToolOutput({
              toolCallId,
              output: unwrapCheckable(output, checked),
            });
          } catch (err) {
            if (err instanceof PolicyViolationError) {
              await addToolOutput({
                toolCallId,
                output: formatToolBlockError(err),
              });
              return;
            }
            throw err;
          }
        };

        const nextCall = {
          ...toolCall,
          args: checkedArgs,
          input: checkedArgs,
        };

        await handler({ toolCall: nextCall, addToolOutput: governedAddToolOutput });
      };
    },
  };
}

/** Re-export ToolSet for callers typing forChat tools. */
export type { ToolSet };
