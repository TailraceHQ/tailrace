/**
 * Request auth: Bearer API key → environment.
 */

import { lookLikeApiKey } from "./api-key";
import { getStore } from "./store/index";
import type { Environment } from "./store/types";

export async function authenticateRequest(req: Request): Promise<Environment | null> {
  const header = req.headers.get("authorization");
  if (header === null || !header.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const apiKey = header.slice("bearer ".length).trim();
  if (!lookLikeApiKey(apiKey)) return null;
  return getStore().resolveEnvironmentByApiKey(apiKey);
}
