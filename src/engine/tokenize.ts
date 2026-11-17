/**
 * Tokenizing for the decodability checker and the readers (spec §6.4):
 * split on whitespace, strip leading and trailing punctuation, compare
 * case-insensitively.
 */

export interface Token {
  /** The token exactly as written, punctuation included ("mat."). */
  raw: string;
  /** Punctuation before the word (an opening quote, for example). */
  lead: string;
  /** The word with its original capitalisation ("The"). */
  word: string;
  /** Punctuation after the word ("." or "!"). */
  trail: string;
  /** Lowercase lookup key ("the"). */
  key: string;
}

const EDGE_PUNCTUATION = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u;

/** Lowercase lookup key for one word. "I" and "i" share the key "i". */
export function normalizeWord(word: string): string {
  return stripPunctuation(word).toLowerCase();
}

export function stripPunctuation(raw: string): string {
  const match = EDGE_PUNCTUATION.exec(raw);
  return match?.[2] ?? '';
}

/**
 * Split text into word tokens. Tokens that are punctuation only (a lone dash)
 * carry no word and are dropped.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const raw of text.split(/\s+/u)) {
    if (raw === '') continue;
    const match = EDGE_PUNCTUATION.exec(raw);
    const word = match?.[2] ?? '';
    if (word === '') continue;
    tokens.push({
      raw,
      lead: match?.[1] ?? '',
      word,
      trail: match?.[3] ?? '',
      key: word.toLowerCase(),
    });
  }
  return tokens;
}

/** Split running text into sentences, keeping the end punctuation. */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  const pattern = /[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/gu;
  for (const match of text.replace(/\s+/gu, ' ').matchAll(pattern)) {
    const sentence = match[0].trim();
    if (tokenize(sentence).length > 0) sentences.push(sentence);
  }
  return sentences;
}

/** True when a token ends a phrase (it carries trailing punctuation). */
export function endsPhrase(token: Token): boolean {
  return /[,.;:!?]/u.test(token.trail);
}
