import { describe, expect, it } from 'vitest';
import { readStatus } from '@/engine/repeatedReading';
import { DAY, T0 } from './helpers';

describe('repeated reading (spec §9.4)', () => {
  it('has no stars and nothing due before the first read', () => {
    expect(readStatus([], T0)).toEqual({ stars: 0, nextRead: 1, due: false });
  });

  it('makes read 2 due straight after read 1', () => {
    expect(readStatus([T0], T0 + 1000)).toEqual({ stars: 1, nextRead: 2, due: true });
    expect(readStatus([T0], T0 + DAY)).toMatchObject({ stars: 1, due: true });
  });

  it('holds read 3 until later in the week', () => {
    const reads = [T0 - DAY, T0];
    expect(readStatus(reads, T0 + 1000)).toEqual({
      stars: 2,
      nextRead: 3,
      due: false,
      dueTs: T0 + 2 * DAY,
    });
    expect(readStatus(reads, T0 + DAY)).toMatchObject({ due: false });
    expect(readStatus([T0, T0 - DAY], T0 + 2 * DAY)).toEqual({ stars: 2, nextRead: 3, due: true });
  });

  it('caps at three stars', () => {
    expect(readStatus([T0, T0 + 1, T0 + 2, T0 + 3], T0 + 9 * DAY)).toEqual({
      stars: 3,
      due: false,
    });
  });
});
