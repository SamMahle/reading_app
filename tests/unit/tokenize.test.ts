import { describe, expect, it } from 'vitest';
import {
  endsPhrase,
  normalizeWord,
  splitSentences,
  stripPunctuation,
  tokenize,
} from '@/engine/tokenize';

describe('tokenize', () => {
  it('splits on whitespace and strips edge punctuation', () => {
    const tokens = tokenize('  "Go, bot, go!"  she  said. ');
    expect(tokens.map((t) => t.word)).toEqual(['Go', 'bot', 'go', 'she', 'said']);
    expect(tokens[0]).toMatchObject({ raw: '"Go,', lead: '"', trail: ',', key: 'go' });
    expect(tokens[2]?.trail).toBe('!"');
  });

  it('keeps inner punctuation and drops punctuation-only tokens', () => {
    expect(tokenize("it's — fine").map((t) => t.word)).toEqual(["it's", 'fine']);
    expect(tokenize('')).toEqual([]);
  });

  it('normalises case so "I" matches the heart word', () => {
    expect(normalizeWord('I')).toBe('i');
    expect(normalizeWord('The.')).toBe('the');
    expect(stripPunctuation('...')).toBe('');
  });

  it('splits sentences and keeps their end marks', () => {
    expect(splitSentences('I see Pam.  She has a cat! Is it big? Yes')).toEqual([
      'I see Pam.',
      'She has a cat!',
      'Is it big?',
      'Yes',
    ]);
    expect(splitSentences(' ... ')).toEqual([]);
  });

  it('detects phrase-ending punctuation', () => {
    const [a, b] = tokenize('Hop, dog');
    expect(a && endsPhrase(a)).toBe(true);
    expect(b && endsPhrase(b)).toBe(false);
  });
});
