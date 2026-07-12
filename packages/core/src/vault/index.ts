/**
 * Vault adapters and token helpers. Internal to core - public factories re-exported
 * from the package entry point.
 */

export {
  bytesToTokenId,
  FORMAT_PRESERVE_ENTITIES,
  TOKEN_ID_ALPHABET,
  TOKEN_ID_CHAR_CLASS,
  TOKEN_ID_LENGTH,
} from "./alphabet";
export {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  decryptAtRest,
  encryptAtRest,
  hmacSha256,
  randomBytes,
  resolveMasterKey,
  sha256Hex,
} from "./crypto";
export { getVaultKey, registerVaultKey } from "./keys";
export { kvVault } from "./kv";
export { memoryVault } from "./memory";
export { assertNoCollision, decodeRecord, encodeRecord, storageKey } from "./shared";
export {
  deriveTokenId,
  deriveWorkflowKey,
  entityLabel,
  formatToken,
  FPE_CARD_RE,
  FPE_EMAIL_RE,
  FPE_PHONE_RE,
  LABEL_RE,
  labelToken,
  maskLabel,
  normalizeValue,
} from "./token";
