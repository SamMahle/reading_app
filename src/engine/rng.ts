/** Small seedable random source so engine behaviour is reproducible in tests. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}

/** mulberry32: fast, well-distributed 32-bit generator. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng.next() * maxExclusive);
}

/** Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

function rollIndex(pool: readonly { weight: number }[], roll: number): number {
  let remaining = roll;
  for (let i = 0; i < pool.length; i += 1) {
    remaining -= pool[i]?.weight ?? 0;
    if (remaining < 0) return i;
  }
  return pool.length - 1;
}

/** Up to `count` distinct items, sampled with the given weights. */
export function weightedSample<T>(
  items: readonly T[],
  weight: (item: T) => number,
  count: number,
  rng: Rng,
): T[] {
  const pool = items.map((item) => ({ item, weight: Math.max(weight(item), 0) }));
  const chosen: T[] = [];
  while (chosen.length < count && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    const index = total > 0 ? rollIndex(pool, rng.next() * total) : randomInt(rng, pool.length);
    const [picked] = pool.splice(index, 1);
    if (picked) chosen.push(picked.item);
  }
  return chosen;
}

/** Round to an integer, using the fraction as the chance of rounding up. */
export function stochasticRound(value: number, rng: Rng): number {
  const floor = Math.floor(value);
  return rng.next() < value - floor ? floor + 1 : floor;
}
