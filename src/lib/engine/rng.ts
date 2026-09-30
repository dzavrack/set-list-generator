// Small seeded PRNG (mulberry32, same as the old app's rng32) so builds are reproducible.
export type Rand = () => number;

export function makeRng(seed: number): Rand {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
