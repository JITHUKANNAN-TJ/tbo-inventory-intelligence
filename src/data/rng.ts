// Deterministic PRNG so every demo build produces the same dataset.
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)]
}

export function pickMany<T>(rand: () => number, items: T[], count: number): T[] {
  const copy = [...items]
  const out: T[] = []
  for (let i = 0; i < count && copy.length > 0; i += 1) {
    const idx = Math.floor(rand() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

export function between(rand: () => number, min: number, max: number) {
  return min + rand() * (max - min)
}

export function round(value: number, step = 1) {
  return Math.round(value / step) * step
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function gaussian(rand: () => number) {
  // Box-Muller transform, clamped to avoid extreme tails.
  const u = Math.max(rand(), 1e-9)
  const v = Math.max(rand(), 1e-9)
  return clamp(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v), -3, 3)
}
