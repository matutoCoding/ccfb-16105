// 种子化伪随机：同种子同结果，砂眼分布可复现
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 格子砂眼数量：釉层越薄、格越大，砂眼越多
export const pinholeCount = (
  area: number,
  coatScale: number,
  seed: number,
): number => {
  const rnd = mulberry32(seed)
  const base = area * 0.004 * Math.max(0.2, 1.4 - coatScale)
  return Math.floor(base) + (rnd() < base % 1 ? 1 : 0)
}
