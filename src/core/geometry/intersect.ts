import type { FlatSegment, Vec2 } from '../types'
import { dist, sub } from './vec2'

// 端点焊接容差：毫米，小于该距离的丝端点视为已焊为同一节点
export const SNAP_TOLERANCE = 0.1
const EPS = 1e-6

export interface SegIntersection {
  point: Vec2
  // 交点在两条线段上的参数 0-1
  tA: number
  tB: number
  endA: boolean
  endB: boolean
}

// 两线段求交，含端点接触；平行重叠取首交点
export const segmentIntersect = (
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2,
): SegIntersection | null => {
  const r = sub(a2, a1)
  const s = sub(b2, b1)
  const rxs = r.x * s.y - r.y * s.x
  const qp = sub(b1, a1)
  if (Math.abs(rxs) < EPS) {
    // 平行：检查 b1 是否落在 a 上（重叠/端点相接）
    const t = r.x * r.x + r.y * r.y === 0 ? 0 : (qp.x * r.x + qp.y * r.y) / (r.x * r.x + r.y * r.y)
    if (t >= -EPS && t <= 1 + EPS && Math.abs(qp.x * r.y - qp.y * r.x) < EPS) {
      const tt = Math.min(1, Math.max(0, t))
      return {
        point: { x: a1.x + r.x * tt, y: a1.y + r.y * tt },
        tA: tt,
        tB: 0,
        endA: tt <= EPS || tt >= 1 - EPS,
        endB: true,
      }
    }
    return null
  }
  const t = (qp.x * s.y - qp.y * s.x) / rxs
  const u = (qp.x * r.y - qp.y * r.x) / rxs
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null
  const tc = Math.min(1, Math.max(0, t))
  const uc = Math.min(1, Math.max(0, u))
  return {
    point: { x: a1.x + r.x * tc, y: a1.y + r.y * tc },
    tA: tc,
    tB: uc,
    endA: tc <= EPS || tc >= 1 - EPS,
    endB: uc <= EPS || uc >= 1 - EPS,
  }
}

// 均匀网格空间哈希，候选线段对只在同格/邻格内配对
// 整数键替代字符串拼接，万级线段下减少 GC 压力
export class SpatialHash {
  private cell: number
  private buckets = new Map<number, number[]>()

  private static key = (x: number, y: number): number =>
    ((x + 32768) << 16) | (y + 32768)

  constructor(segments: FlatSegment[], cellSize: number) {
    this.cell = cellSize
    segments.forEach((seg, i) => {
      const minX = Math.min(seg.a.x, seg.b.x)
      const maxX = Math.max(seg.a.x, seg.b.x)
      const minY = Math.min(seg.a.y, seg.b.y)
      const maxY = Math.max(seg.a.y, seg.b.y)
      const x0 = Math.floor(minX / cellSize)
      const x1 = Math.floor(maxX / cellSize)
      const y0 = Math.floor(minY / cellSize)
      const y1 = Math.floor(maxY / cellSize)
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = SpatialHash.key(x, y)
          const list = this.buckets.get(key)
          if (list) list.push(i)
          else this.buckets.set(key, [i])
        }
      }
    })
  }

  candidates(i: number, seg: FlatSegment): number[] {
    const x0 = Math.floor(Math.min(seg.a.x, seg.b.x) / this.cell)
    const x1 = Math.floor(Math.max(seg.a.x, seg.b.x) / this.cell)
    const y0 = Math.floor(Math.min(seg.a.y, seg.b.y) / this.cell)
    const y1 = Math.floor(Math.max(seg.a.y, seg.b.y) / this.cell)
    const seen = new Set<number>()
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (const j of this.buckets.get(SpatialHash.key(x, y)) ?? []) {
          if (j > i) seen.add(j)
        }
      }
    }
    return [...seen]
  }
}

// 点是否落在线段上，返回投影参数
export const pointOnSegment = (p: Vec2, a: Vec2, b: Vec2): number | null => {
  const r = sub(b, a)
  const lenSq = r.x * r.x + r.y * r.y
  if (lenSq === 0) return dist(p, a) <= SNAP_TOLERANCE ? 0 : null
  const t = ((p.x - a.x) * r.x + (p.y - a.y) * r.y) / lenSq
  if (t < -EPS || t > 1 + EPS) return null
  const proj = { x: a.x + r.x * t, y: a.y + r.y * t }
  if (dist(p, proj) > SNAP_TOLERANCE) return null
  return Math.min(1, Math.max(0, t))
}
