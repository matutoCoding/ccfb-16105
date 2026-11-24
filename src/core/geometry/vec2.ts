import type { Vec2 } from '../types'

export const v = (x: number, y: number): Vec2 => ({ x, y })

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })

export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y

export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x

export const length = (a: Vec2): number => Math.hypot(a.x, a.y)

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
})

// 多边形面积（带符号），Shoelace
export const polygonSignedArea = (poly: Vec2[]): number => {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    sum += p.x * q.y - q.x * p.y
  }
  return sum / 2
}

export const polygonArea = (poly: Vec2[]): number =>
  Math.abs(polygonSignedArea(poly))

export const polygonCentroid = (poly: Vec2[]): Vec2 => {
  let sx = 0
  let sy = 0
  for (const p of poly) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / poly.length, y: sy / poly.length }
}

// 点到线段最短距离
export const pointSegmentDist = (p: Vec2, a: Vec2, b: Vec2): number => {
  const ab = sub(b, a)
  const lenSq = dot(ab, ab)
  if (lenSq === 0) return dist(p, a)
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / lenSq))
  return dist(p, lerpVec(a, b, t))
}
