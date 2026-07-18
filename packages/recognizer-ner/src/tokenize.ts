/**
 * Tokenization with UTF-16 offset mapping for Privacy Filter-class models.
 *
 * Default path uses `js-tiktoken` o200k_base (vocab size matches the hub config).
 * Callers may inject a custom tokenizer via NerRecognizerOptions.
 */

export interface TokenizedText {
  inputIds: number[];
  /** Inclusive UTF-16 start offset per token. */
  charStarts: number[];
  /** Exclusive UTF-16 end offset per token. */
  charEnds: number[];
}

export type TokenizerFn = (text: string) => TokenizedText | Promise<TokenizedText>;

type TiktokenEncoding = {
  encode: (text: string) => number[];
  decode: (tokens: number[]) => string;
};

let encodingPromise: Promise<TiktokenEncoding> | null = null;

async function loadO200k(): Promise<TiktokenEncoding> {
  if (encodingPromise === null) {
    encodingPromise = import("js-tiktoken/ranks/o200k_base").then(async (mod) => {
      const { Tiktoken } = await import("js-tiktoken/lite");
      // why: js-tiktoken lite + rank table avoids pulling the full encodings bundle
      return new Tiktoken(mod.default) as TiktokenEncoding;
    });
  }
  return encodingPromise;
}

/**
 * Map token ids back to UTF-16 ranges by decoding growing prefixes of the token sequence
 * and diffing against the previous prefix.
 *
 * Decoding a *single* token in isolation can split a multi-byte UTF-8 character across a
 * token boundary (common for emoji and other supplementary-plane code points), producing an
 * invalid/undecodable piece that can't be found in the source text. Decoding a growing prefix
 * instead means the byte sequence is always complete up to the current token, so once a
 * multi-token character finishes decoding cleanly, the whole recovered piece is assigned to
 * every token that contributed to it.
 */
export function offsetsForTokens(
  text: string,
  tokenIds: readonly number[],
  decodePrefix: (ids: readonly number[]) => string,
): {
  charStarts: number[];
  charEnds: number[];
} {
  const charStarts: number[] = new Array(tokenIds.length).fill(-1);
  const charEnds: number[] = new Array(tokenIds.length).fill(-1);
  let cursor = 0;
  let prevDecoded = "";
  let pendingStart = -1;
  for (let i = 0; i < tokenIds.length; i++) {
    const decoded = decodePrefix(tokenIds.slice(0, i + 1));
    const piece = decoded.slice(prevDecoded.length);
    const idx = piece.length === 0 ? cursor : text.indexOf(piece, cursor);
    if (idx < 0) {
      // Prefix ends mid multi-byte character; buffer this token until it resolves.
      if (pendingStart < 0) pendingStart = i;
      continue;
    }
    const start = pendingStart < 0 ? idx : cursor;
    const end = idx + piece.length;
    for (let j = pendingStart < 0 ? i : pendingStart; j <= i; j++) {
      charStarts[j] = start;
      charEnds[j] = end;
    }
    pendingStart = -1;
    cursor = end;
    prevDecoded = decoded;
  }
  // Trailing tokens that never resolved (fully misaligned tokenizer vs text) get a zero-width
  // span at the cursor so decode can continue.
  if (pendingStart >= 0) {
    for (let j = pendingStart; j < tokenIds.length; j++) {
      charStarts[j] = cursor;
      charEnds[j] = cursor;
    }
  }
  return { charStarts, charEnds };
}

/** Default tokenizer: o200k_base via js-tiktoken. */
export async function tokenizeO200k(text: string): Promise<TokenizedText> {
  const enc = await loadO200k();
  const inputIds = enc.encode(text);
  const { charStarts, charEnds } = offsetsForTokens(text, inputIds, (ids) =>
    enc.decode(ids as number[]),
  );
  return { inputIds, charStarts, charEnds };
}
